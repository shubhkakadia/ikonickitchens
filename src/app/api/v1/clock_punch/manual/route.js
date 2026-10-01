import { NextResponse } from "next/server";

import {
  authenticateClockPunchRequest,
  canAddClockPunches,
  clockPunchInclude,
  getClockPunchDayBounds,
  getClockPunchInstant,
  isClockPunchReviewer,
  normalizeClockPunchAction,
} from "@/lib/clockPunch";
import {
  findSequenceViolation,
  formatClockPunchAction,
} from "@/lib/clockPunchSequence";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/withLogging";

const MAX_MANUAL_PUNCHES = 20;
const MAX_TRANSACTION_ATTEMPTS = 3;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
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

function badRequest(message) {
  return NextResponse.json({ status: false, message }, { status: 400 });
}

// Turns the submitted rows into UTC instants and rejects anything malformed or
// out of order before the transaction runs.
function buildRequestedPunches(date, punches) {
  const requested = [];

  for (let index = 0; index < punches.length; index += 1) {
    const entry = punches[index];
    const position = index + 1;
    const action = normalizeClockPunchAction(entry?.action);
    const time = typeof entry?.time === "string" ? entry.time.trim() : "";

    if (!action) {
      return {
        error: `Punch ${position}: action must be one of CLOCK_IN, BREAK_IN, BREAK_OUT, or CLOCK_OUT`,
        requested: null,
      };
    }

    if (!TIME_PATTERN.test(time)) {
      return {
        error: `Punch ${position}: time must be in HH:mm format`,
        requested: null,
      };
    }

    const punchedAt = getClockPunchInstant(date, time);
    if (!punchedAt) {
      return {
        error: `Punch ${position}: ${time} is not a valid time on ${date}`,
        requested: null,
      };
    }

    const previous = requested.at(-1);
    if (previous && punchedAt.getTime() <= previous.punchedAt.getTime()) {
      return {
        error: `Punch ${position}: ${time} must be later than the previous punch at ${previous.time}`,
        requested: null,
      };
    }

    requested.push({ action, time, punchedAt });
  }

  return { error: null, requested };
}

async function createManualPunches({
  employeeId,
  userId,
  requested,
  reviewStatus,
}) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const dayBounds = getClockPunchDayBounds(requested[0].punchedAt);
          const existingPunches = await tx.clock_punch.findMany({
            where: {
              employee_id: employeeId,
              review_status: { not: "REJECTED" },
              punched_at: {
                gte: dayBounds.start,
                lt: dayBounds.end,
              },
            },
            orderBy: [
              { punched_at: "asc" },
              { createdAt: "asc" },
              { id: "asc" },
            ],
            select: { id: true, action: true, punched_at: true },
          });

          const lastExisting = existingPunches.at(-1) || null;

          if (
            lastExisting &&
            requested[0].punchedAt.getTime() <=
              new Date(lastExisting.punched_at).getTime()
          ) {
            return {
              conflict: {
                code: "PUNCH_OUT_OF_ORDER",
                message:
                  "New punches must be later than the last punch already recorded for this day",
                lastPunch: lastExisting,
              },
              punches: null,
            };
          }

          const violation = findSequenceViolation(
            requested.map((entry) => entry.action),
            lastExisting?.action || null,
          );

          if (violation) {
            return {
              conflict: {
                code: "INVALID_PUNCH_SEQUENCE",
                message:
                  violation.allowedActions.length === 0
                    ? `Punch ${violation.index + 1} (${formatClockPunchAction(
                        violation.action,
                      )}) cannot be added: this day is already clocked out and only one shift can be recorded per day.`
                    : `Punch ${violation.index + 1} (${formatClockPunchAction(
                        violation.action,
                      )}) is not valid here. Allowed action${
                        violation.allowedActions.length === 1 ? " is" : "s are"
                      }: ${violation.allowedActions
                        .map(formatClockPunchAction)
                        .join(", ")}`,
                allowedActions: violation.allowedActions,
                index: violation.index,
              },
              punches: null,
            };
          }

          const createdPunches = [];
          for (const entry of requested) {
            createdPunches.push(
              await tx.clock_punch.create({
                data: {
                  employee_id: employeeId,
                  user_id: userId,
                  action: entry.action,
                  punch_type: "MANUAL",
                  punched_at: entry.punchedAt,
                  review_status: reviewStatus,
                  ...(reviewStatus === "APPROVED"
                    ? { reviewed_by_id: userId, reviewed_at: new Date() }
                    : {}),
                },
                include: clockPunchInclude,
              }),
            );
          }

          return { conflict: null, punches: createdPunches };
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

export async function POST(request) {
  try {
    const { error: authError, session } =
      await authenticateClockPunchRequest(request);
    if (authError) return authError;

    const canAdd = await canAddClockPunches(session.userId, session.userType);
    if (!canAdd) {
      return NextResponse.json(
        {
          status: false,
          message: "You do not have permission to add clock punches",
        },
        { status: 403 },
      );
    }

    const { body, error: bodyError } = await readJsonBody(request);
    if (bodyError) return bodyError;

    const employeeId =
      typeof body?.employee_id === "string" ? body.employee_id.trim() : "";
    if (!employeeId) {
      return badRequest("employee_id is required");
    }

    const date = typeof body?.date === "string" ? body.date.trim() : "";
    if (!DATE_PATTERN.test(date)) {
      return badRequest("date is required in YYYY-MM-DD format");
    }

    if (!Array.isArray(body?.punches) || body.punches.length === 0) {
      return badRequest("At least one punch is required");
    }

    if (body.punches.length > MAX_MANUAL_PUNCHES) {
      return badRequest(
        `A maximum of ${MAX_MANUAL_PUNCHES} punches can be added at once`,
      );
    }

    const approve = body?.approve === true;
    if (approve && !isClockPunchReviewer(session.userType)) {
      return NextResponse.json(
        {
          status: false,
          message: "Only administrators can approve clock punches",
        },
        { status: 403 },
      );
    }

    const { error: punchError, requested } = buildRequestedPunches(
      date,
      body.punches,
    );
    if (punchError) return badRequest(punchError);

    const employee = await prisma.employees.findUnique({
      where: { employee_id: employeeId },
      select: {
        employee_id: true,
        first_name: true,
        last_name: true,
        is_active: true,
        is_deleted: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { status: false, message: "Employee not found" },
        { status: 404 },
      );
    }

    if (!employee.is_active || employee.is_deleted) {
      return NextResponse.json(
        { status: false, message: "The selected employee is not active" },
        { status: 403 },
      );
    }

    const result = await createManualPunches({
      employeeId: employee.employee_id,
      userId: session.userId,
      requested,
      reviewStatus: approve ? "APPROVED" : "PENDING",
    });

    if (result.conflict) {
      return NextResponse.json(
        {
          status: false,
          message: result.conflict.message,
          data: result.conflict,
        },
        { status: 409 },
      );
    }

    for (const punch of result.punches) {
      await withLogging(
        request,
        "clock_punch",
        punch.id,
        "CREATE",
        `Manual clock punch added for ${employee.first_name || ""} ${
          employee.last_name || ""
        }`.trim() + `: ${punch.action} on ${date} (${punch.review_status})`,
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: `${result.punches.length} clock punch${
          result.punches.length === 1 ? "" : "es"
        } added successfully${approve ? " and approved" : ""}`,
        data: result.punches,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/v1/clock_punch/manual:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
