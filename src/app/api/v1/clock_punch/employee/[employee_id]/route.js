import { NextResponse } from "next/server";

import {
  authenticateClockPunchRequest,
  canViewAllClockPunches,
  clockPunchInclude,
  getClockPunchDateBoundary,
  groupClockPunchesByDate,
} from "@/lib/clockPunch";
import { prisma } from "@/lib/db";

// Plain YYYY-MM-DD values describe Adelaide calendar days; anything else is
// parsed as an absolute instant. Mirrors /api/v1/clock_punch/all.
function parseDate(value, boundary) {
  if (!value) return null;

  const zonedBoundary = getClockPunchDateBoundary(value, boundary);
  if (zonedBoundary !== undefined) return zonedBoundary;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function GET(request, { params }) {
  try {
    const { error: authError, session } =
      await authenticateClockPunchRequest(request);
    if (authError) return authError;

    const { employee_id } = await params;
    const canReadAnyEmployee = await canViewAllClockPunches(
      session.userId,
      session.userType,
    );

    if (!canReadAnyEmployee) {
      const currentUser = await prisma.users.findUnique({
        where: { id: session.userId },
        select: { employee_id: true },
      });

      if (!currentUser?.employee_id) {
        return NextResponse.json(
          {
            status: false,
            message: "Your user account is not linked to an employee",
          },
          { status: 403 },
        );
      }

      if (currentUser.employee_id !== employee_id) {
        return NextResponse.json(
          {
            status: false,
            message: "You can only access your own clock punches",
          },
          { status: 403 },
        );
      }
    }

    const employee = await prisma.employees.findUnique({
      where: { employee_id },
      select: { employee_id: true },
    });

    if (!employee) {
      return NextResponse.json(
        { status: false, message: "Employee not found" },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);
    const from = parseDate(searchParams.get("from"), "start");
    const to = parseDate(searchParams.get("to"), "end");

    if (from === undefined || to === undefined) {
      return NextResponse.json(
        { status: false, message: "from and to must be valid dates" },
        { status: 400 },
      );
    }

    if (from && to && from > to) {
      return NextResponse.json(
        { status: false, message: "from cannot be later than to" },
        { status: 400 },
      );
    }

    const punches = await prisma.clock_punch.findMany({
      where: {
        employee_id,
        ...(from || to
          ? {
              punched_at: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: clockPunchInclude,
      orderBy: [{ punched_at: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });

    const dateGroups = groupClockPunchesByDate(punches);

    return NextResponse.json({
      status: true,
      message: "Employee clock punches fetched successfully by date",
      data: dateGroups,
    });
  } catch (error) {
    console.error(
      "Error in GET /api/v1/clock_punch/employee/[employee_id]:",
      error,
    );
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
