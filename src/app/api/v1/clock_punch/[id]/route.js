import { NextResponse } from "next/server";

import {
  authenticateClockPunchRequest,
  canViewAllClockPunches,
  clockPunchInclude,
  getClockPunchDayBounds,
  groupClockPunchesByDate,
  isClockPunchReviewer,
  normalizeClockPunchReviewStatus,
} from "@/lib/clockPunch";
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
    if (!hasReviewStatus && !hasReviewNotes) {
      return NextResponse.json(
        {
          status: false,
          message: "review_status or review_notes is required",
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
      ...(hasReviewNotes
        ? { review_notes: body.review_notes?.trim() || null }
        : {}),
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
