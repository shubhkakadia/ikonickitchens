import { NextResponse } from "next/server";

import {
  authenticateClockPunchRequest,
  isClockPunchReviewer,
  MINIMUM_BREAK_MINUTES,
  normalizeClockPunchAction,
} from "@/lib/clockPunch";
import { createClockPunch } from "@/lib/clockPunchService";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/withLogging";

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

export async function POST(request) {
  try {
    const { error: authError, session } =
      await authenticateClockPunchRequest(request);
    if (authError) return authError;

    const { body, error: bodyError } = await readJsonBody(request);
    if (bodyError) return bodyError;

    const action = normalizeClockPunchAction(body?.action);
    if (!action) {
      return NextResponse.json(
        {
          status: false,
          message:
            "action must be one of CLOCK_IN, BREAK_IN, BREAK_OUT, or CLOCK_OUT",
        },
        { status: 400 },
      );
    }

    if (body?.punch_type !== undefined) {
      return NextResponse.json(
        {
          status: false,
          message:
            "punch_type is assigned by the server and cannot be provided",
        },
        { status: 400 },
      );
    }

    const hasRequestedEmployee = body?.employee_id !== undefined;
    const requestedEmployeeId =
      typeof body?.employee_id === "string" ? body.employee_id.trim() : "";

    if (hasRequestedEmployee && !requestedEmployeeId) {
      return NextResponse.json(
        { status: false, message: "employee_id must be a non-empty string" },
        { status: 400 },
      );
    }

    const isManualPunch = hasRequestedEmployee;
    if (isManualPunch && !isClockPunchReviewer(session.userType)) {
      return NextResponse.json(
        {
          status: false,
          message: "Only administrators can create punches for an employee",
        },
        { status: 403 },
      );
    }

    const actor = await prisma.users.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        employee: {
          select: {
            employee_id: true,
            is_active: true,
            is_deleted: true,
          },
        },
      },
    });

    if (!actor) {
      return NextResponse.json(
        { status: false, message: "User not found" },
        { status: 404 },
      );
    }

    if (!isManualPunch && !actor.employee) {
      return NextResponse.json(
        {
          status: false,
          message: "Your user account is not linked to an employee",
        },
        { status: 400 },
      );
    }

    const targetEmployee = isManualPunch
      ? await prisma.employees.findUnique({
          where: { employee_id: requestedEmployeeId },
          select: {
            employee_id: true,
            is_active: true,
            is_deleted: true,
          },
        })
      : actor.employee;

    if (!targetEmployee) {
      return NextResponse.json(
        { status: false, message: "Employee not found" },
        { status: 404 },
      );
    }

    if (!targetEmployee.is_active || targetEmployee.is_deleted) {
      return NextResponse.json(
        {
          status: false,
          message: "The linked employee is not active",
        },
        { status: 403 },
      );
    }

    const result = await createClockPunch({
      employeeId: targetEmployee.employee_id,
      userId: actor.id,
      action,
      punchType: isManualPunch ? "MANUAL" : "EMPLOYEE",
    });

    if (result.conflict) {
      const isMinimumBreakConflict =
        result.conflict.code === "MINIMUM_BREAK_NOT_MET";

      return NextResponse.json(
        {
          status: false,
          message: isMinimumBreakConflict
            ? `Break-out is available after the minimum ${MINIMUM_BREAK_MINUTES}-minute break`
            : result.conflict.allowedActions.length === 0
              ? "This day is already clocked out. Only one shift can be recorded per day."
              : `Invalid punch sequence. Allowed next action${
                  result.conflict.allowedActions.length === 1 ? " is" : "s are"
                }: ${result.conflict.allowedActions.join(", ")}`,
          data: result.conflict,
        },
        { status: 409 },
      );
    }

    const logged = await withLogging(
      request,
      "clock_punch",
      result.punch.id,
      "CREATE",
      `Clock punch recorded: ${action} (${result.punch.punch_type})`,
    );

    return NextResponse.json(
      {
        status: true,
        message: "Clock punch recorded successfully",
        data: result.punch,
        ...(logged
          ? {}
          : { warning: "Punch recorded but audit logging failed" }),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/v1/clock_punch/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
