import { NextResponse } from "next/server";

import {
  authenticateClockPunchRequest,
  canViewAllClockPunches,
  clockPunchInclude,
  getClockPunchDayBounds,
  getClockPunchInstant,
  getClockPunchLocalDate,
  getClockPunchLocalTime,
  groupClockPunchesByDate,
  isClockPunchReviewer,
  isClockPunchTimeEditor,
  normalizeClockPunchReviewStatus,
} from "@/lib/clockPunch";
import {
  findSequenceViolation,
  formatClockPunchAction,
} from "@/lib/clockPunchSequence";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/withLogging";

const IMMUTABLE_PUNCH_FIELDS = [
  "action",
  "punch_type",
  "punched_at",
  "employee_id",
  "user_id",
];
const MAX_REVIEW_NOTES_LENGTH = 5000;
const MAX_TRANSACTION_ATTEMPTS = 3;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

async function readJsonBody(request) {
  try {
    return { body: await request.json(), error: null };
  } catch {
    return {
      body: null,
      error: NextResponse.json(
        { status: false, message: "A valid JSON body is required" },
        { status: 400 },
      ),
    };
  }
}

function validateReviewNotes(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return "review_notes must be a string or null";
  if (value.length > MAX_REVIEW_NOTES_LENGTH) {
    return `review_notes cannot exceed ${MAX_REVIEW_NOTES_LENGTH} characters`;
  }

  return null;
}

// A master admin can overwrite when a punch happened - an employee who clocked
// out 30 minutes late, for example. The punch keeps the Adelaide day it was
// recorded on so it stays in the same shift group, and the day's action
// sequence still has to hold once the punch moves.
async function overridePunchTime({ punchId, time, notes, hasNotes }) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existingPunch = await tx.clock_punch.findUnique({
            where: { id: punchId },
            select: {
              id: true,
              employee_id: true,
              action: true,
              punched_at: true,
              review_status: true,
            },
          });

          if (!existingPunch) return { notFound: true };

          const localDate = getClockPunchLocalDate(existingPunch.punched_at);
          const punchedAt = localDate
            ? getClockPunchInstant(localDate, time)
            : null;

          if (!punchedAt) {
            return {
              conflict: `${time} is not a valid time on ${localDate || "this punch's date"}`,
            };
          }

          // Rejected punches sit outside the day's sequence, so moving one
          // cannot invalidate it.
          if (existingPunch.review_status !== "REJECTED") {
            const dayBounds = getClockPunchDayBounds(existingPunch.punched_at);
            const otherPunches = await tx.clock_punch.findMany({
              where: {
                employee_id: existingPunch.employee_id,
                review_status: { not: "REJECTED" },
                id: { not: existingPunch.id },
                punched_at: {
                  gte: dayBounds.start,
                  lt: dayBounds.end,
                },
              },
              select: { id: true, action: true, punched_at: true },
            });

            const clash = otherPunches.find(
              (other) =>
                new Date(other.punched_at).getTime() === punchedAt.getTime(),
            );

            if (clash) {
              return {
                conflict: `A ${formatClockPunchAction(
                  clash.action,
                )} punch is already recorded at ${time}`,
              };
            }

            const reordered = [
              ...otherPunches,
              { ...existingPunch, punched_at: punchedAt },
            ].sort(
              (first, second) =>
                new Date(first.punched_at).getTime() -
                new Date(second.punched_at).getTime(),
            );

            const violation = findSequenceViolation(
              reordered.map((entry) => entry.action),
            );

            if (violation) {
              return {
                conflict: `Moving this punch to ${time} would put the day out of order: ${formatClockPunchAction(
                  violation.action,
                )} cannot follow ${
                  violation.lastAction
                    ? formatClockPunchAction(violation.lastAction)
                    : "the start of the day"
                }`,
              };
            }
          }

          const punch = await tx.clock_punch.update({
            where: { id: punchId },
            data: {
              punched_at: punchedAt,
              ...(hasNotes ? { review_notes: notes } : {}),
            },
            include: clockPunchInclude,
          });

          return {
            punch,
            previousTime: getClockPunchLocalTime(existingPunch.punched_at),
            localDate,
          };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (error?.code === "P2034" && attempt < MAX_TRANSACTION_ATTEMPTS) {
        continue;
      }

      throw error;
    }
  }
}

async function requireReviewer(request) {
  const auth = await authenticateClockPunchRequest(request);
  if (auth.error) return auth;

  if (!isClockPunchReviewer(auth.session.userType)) {
    return {
      error: NextResponse.json(
        {
          status: false,
          message: "Only administrators can review clock punches",
        },
        { status: 403 },
      ),
      session: auth.session,
    };
  }

  return auth;
}

export async function GET(request, { params }) {
  try {
    const { error: authError, session } =
      await authenticateClockPunchRequest(request);
    if (authError) return authError;

    const { id } = await params;
    const referencePunch = await prisma.clock_punch.findUnique({
      where: { id },
      select: {
        id: true,
        employee_id: true,
        action: true,
        punched_at: true,
      },
    });

    if (!referencePunch) {
      return NextResponse.json(
        { status: false, message: "Clock punch not found" },
        { status: 404 },
      );
    }

    const canViewAll = await canViewAllClockPunches(
      session.userId,
      session.userType,
    );

    if (!canViewAll) {
      const currentUser = await prisma.users.findUnique({
        where: { id: session.userId },
        select: { employee_id: true },
      });

      if (currentUser?.employee_id !== referencePunch.employee_id) {
        return NextResponse.json(
          {
            status: false,
            message: "You can only access your own clock punches",
          },
          { status: 403 },
        );
      }
    }

    if (referencePunch.action !== "CLOCK_IN") {
      return NextResponse.json(
        {
          status: false,
          message: "The reference punch must be a CLOCK_IN",
        },
        { status: 400 },
      );
    }

    const dayBounds = getClockPunchDayBounds(referencePunch.punched_at);
    const punches = await prisma.clock_punch.findMany({
      where: {
        employee_id: referencePunch.employee_id,
        punched_at: {
          gte: dayBounds.start,
          lt: dayBounds.end,
        },
      },
      include: clockPunchInclude,
      orderBy: [{ punched_at: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });

    const [dateGroup] = groupClockPunchesByDate(punches);

    return NextResponse.json({
      status: true,
      message: "Clock punch group fetched successfully",
      data: dateGroup,
    });
  } catch (error) {
    console.error("Error in GET /api/v1/clock_punch/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { error: authError, session } = await requireReviewer(request);
    if (authError) return authError;

    const { id } = await params;
    const { body, error: bodyError } = await readJsonBody(request);
    if (bodyError) return bodyError;

    const immutableField = IMMUTABLE_PUNCH_FIELDS.find(
      (field) => body?.[field] !== undefined,
    );
    if (immutableField) {
      return NextResponse.json(
        {
          status: false,
          message: `${immutableField} is immutable after a punch is recorded`,
        },
        { status: 400 },
      );
    }

    const hasReviewStatus = body?.review_status !== undefined;
    const hasReviewNotes = body?.review_notes !== undefined;
    const hasTimeOverride = body?.punched_at_time !== undefined;

    if (!hasReviewStatus && !hasReviewNotes && !hasTimeOverride) {
      return NextResponse.json(
        {
          status: false,
          message: "review_status, review_notes or punched_at_time is required",
        },
        { status: 400 },
      );
    }

    if (hasTimeOverride && !isClockPunchTimeEditor(session.userType)) {
      return NextResponse.json(
        {
          status: false,
          message: "Only master administrators can edit a punch time",
        },
        { status: 403 },
      );
    }

    if (hasTimeOverride && hasReviewStatus) {
      return NextResponse.json(
        {
          status: false,
          message:
            "review_status cannot be changed in the same request as a punch time",
        },
        { status: 400 },
      );
    }

    const reviewStatus = hasReviewStatus
      ? normalizeClockPunchReviewStatus(body.review_status)
      : null;
    if (hasReviewStatus && !reviewStatus) {
      return NextResponse.json(
        {
          status: false,
          message:
            "review_status must be one of PENDING, APPROVED, or REJECTED",
        },
        { status: 400 },
      );
    }

    const notesError = validateReviewNotes(body.review_notes);
    if (notesError) {
      return NextResponse.json(
        { status: false, message: notesError },
        { status: 400 },
      );
    }

    const reviewNotes = hasReviewNotes
      ? body.review_notes?.trim() || null
      : undefined;

    if (hasTimeOverride) {
      const time =
        typeof body.punched_at_time === "string"
          ? body.punched_at_time.trim()
          : "";

      if (!TIME_PATTERN.test(time)) {
        return NextResponse.json(
          {
            status: false,
            message: "punched_at_time must be in HH:mm format",
          },
          { status: 400 },
        );
      }

      const result = await overridePunchTime({
        punchId: id,
        time,
        notes: reviewNotes,
        hasNotes: hasReviewNotes,
      });

      if (result.notFound) {
        return NextResponse.json(
          { status: false, message: "Clock punch not found" },
          { status: 404 },
        );
      }

      if (result.conflict) {
        return NextResponse.json(
          { status: false, message: result.conflict },
          { status: 409 },
        );
      }

      await withLogging(
        request,
        "clock_punch",
        id,
        "UPDATE",
        `${formatClockPunchAction(result.punch.action)} punch on ${
          result.localDate
        } moved from ${result.previousTime} to ${time} by a master admin`,
      );

      return NextResponse.json({
        status: true,
        message: "Clock punch time updated successfully",
        data: result.punch,
      });
    }

    const existingPunch = await prisma.clock_punch.findUnique({
      where: { id },
      select: { id: true, review_status: true },
    });

    if (!existingPunch) {
      return NextResponse.json(
        { status: false, message: "Clock punch not found" },
        { status: 404 },
      );
    }

    const updateData = {
      ...(hasReviewNotes ? { review_notes: reviewNotes } : {}),
    };

    if (hasReviewStatus) {
      updateData.review_status = reviewStatus;
      updateData.reviewed_by_id =
        reviewStatus === "PENDING" ? null : session.userId;
      updateData.reviewed_at = reviewStatus === "PENDING" ? null : new Date();
    }

    const punch = await prisma.clock_punch.update({
      where: { id },
      data: updateData,
      include: clockPunchInclude,
    });

    await withLogging(
      request,
      "clock_punch",
      id,
      hasReviewStatus ? "STATUS_CHANGE" : "UPDATE",
      hasReviewStatus
        ? `Clock punch review changed from ${existingPunch.review_status} to ${reviewStatus}`
        : "Clock punch review notes updated",
    );

    return NextResponse.json({
      status: true,
      message: "Clock punch review updated successfully",
      data: punch,
    });
  } catch (error) {
    console.error("Error in PATCH /api/v1/clock_punch/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { error: authError, session } = await requireReviewer(request);
    if (authError) return authError;

    const { id } = await params;
    const existingPunch = await prisma.clock_punch.findUnique({
      where: { id },
    });

    if (!existingPunch) {
      return NextResponse.json(
        { status: false, message: "Clock punch not found" },
        { status: 404 },
      );
    }

    const punch =
      existingPunch.review_status === "REJECTED"
        ? await prisma.clock_punch.findUnique({
            where: { id },
            include: clockPunchInclude,
          })
        : await prisma.clock_punch.update({
            where: { id },
            data: {
              review_status: "REJECTED",
              reviewed_by_id: session.userId,
              reviewed_at: new Date(),
            },
            include: clockPunchInclude,
          });

    if (existingPunch.review_status !== "REJECTED") {
      await withLogging(
        request,
        "clock_punch",
        id,
        "STATUS_CHANGE",
        "Clock punch rejected; audit history retained",
      );
    }

    return NextResponse.json({
      status: true,
      message: "Clock punch rejected successfully; audit history retained",
      data: punch,
    });
  } catch (error) {
    console.error("Error in DELETE /api/v1/clock_punch/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
