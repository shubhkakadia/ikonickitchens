import { NextResponse } from "next/server";

import {
  authenticateClockPunchRequest,
  canViewAllClockPunches,
  clockPunchInclude,
  getClockPunchDateBoundary,
  groupClockPunchesByDate,
  normalizeClockPunchAction,
  normalizeClockPunchBreakStatus,
  normalizeClockPunchGroupReviewStatus,
  normalizeClockPunchReviewStatus,
  normalizeClockPunchType,
  normalizeClockPunchWorkingStatus,
} from "@/lib/clockPunch";
import { prisma } from "@/lib/db";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function parsePositiveInteger(value, fallback) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseDate(value, boundary) {
  if (!value) return null;

  // Plain YYYY-MM-DD values are treated as Adelaide calendar days; anything else
  // is parsed as an absolute instant.
  const zonedBoundary = getClockPunchDateBoundary(value, boundary);
  if (zonedBoundary !== undefined) return zonedBoundary;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// Group-level filters arrive as comma separated lists, e.g. "ON_BREAK,NO_BREAK".
function parseFilterList(rawValue, normalize) {
  if (!rawValue) return { values: null, invalid: false };

  const parts = rawValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return { values: null, invalid: false };

  const normalized = parts.map(normalize);
  if (normalized.some((value) => !value)) {
    return { values: null, invalid: true };
  }

  return { values: new Set(normalized), invalid: false };
}

// Break/working/review statuses are derived per employee while grouping, so they
// are filtered after the fact and the date group totals are recalculated.
function applyGroupFilters(
  dateGroups,
  { breakStatuses, workingStatuses, reviewStatuses },
) {
  if (!breakStatuses && !workingStatuses && !reviewStatuses) return dateGroups;

  const filteredGroups = [];

  for (const dateGroup of dateGroups) {
    const employeeGroups = (dateGroup.employee_groups || []).filter(
      (employeeGroup) =>
        (!breakStatuses || breakStatuses.has(employeeGroup.break_status)) &&
        (!workingStatuses ||
          workingStatuses.has(employeeGroup.working_status)) &&
        (!reviewStatuses || reviewStatuses.has(employeeGroup.review_status)),
    );

    if (employeeGroups.length === 0) continue;

    filteredGroups.push({
      ...dateGroup,
      employee_groups: employeeGroups,
      punches: employeeGroups.flatMap((employeeGroup) => employeeGroup.punches),
      count: employeeGroups.reduce(
        (sum, employeeGroup) => sum + employeeGroup.count,
        0,
      ),
      hours: Number(
        employeeGroups
          .reduce((sum, employeeGroup) => sum + employeeGroup.hours, 0)
          .toFixed(2),
      ),
    });
  }

  return filteredGroups;
}

export async function GET(request) {
  try {
    const { error: authError, session } =
      await authenticateClockPunchRequest(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const requestedLimit = parsePositiveInteger(
      searchParams.get("limit"),
      DEFAULT_PAGE_SIZE,
    );

    if (page === null || requestedLimit === null) {
      return NextResponse.json(
        { status: false, message: "page and limit must be positive integers" },
        { status: 400 },
      );
    }

    const limit = Math.min(requestedLimit, MAX_PAGE_SIZE);
    const actionParam = searchParams.get("action");
    const reviewStatusParam = searchParams.get("review_status");
    const punchTypeParam = searchParams.get("punch_type");
    const action = actionParam ? normalizeClockPunchAction(actionParam) : null;
    const reviewStatus = reviewStatusParam
      ? normalizeClockPunchReviewStatus(reviewStatusParam)
      : null;
    const punchType = punchTypeParam
      ? normalizeClockPunchType(punchTypeParam)
      : null;

    if (actionParam && !action) {
      return NextResponse.json(
        { status: false, message: "Invalid action filter" },
        { status: 400 },
      );
    }

    if (reviewStatusParam && !reviewStatus) {
      return NextResponse.json(
        { status: false, message: "Invalid review_status filter" },
        { status: 400 },
      );
    }

    if (punchTypeParam && !punchType) {
      return NextResponse.json(
        { status: false, message: "Invalid punch_type filter" },
        { status: 400 },
      );
    }

    const breakStatusFilter = parseFilterList(
      searchParams.get("break_status"),
      normalizeClockPunchBreakStatus,
    );
    const workingStatusFilter = parseFilterList(
      searchParams.get("working_status"),
      normalizeClockPunchWorkingStatus,
    );
    const groupReviewStatusFilter = parseFilterList(
      searchParams.get("group_review_status"),
      normalizeClockPunchGroupReviewStatus,
    );

    if (breakStatusFilter.invalid) {
      return NextResponse.json(
        { status: false, message: "Invalid break_status filter" },
        { status: 400 },
      );
    }

    if (workingStatusFilter.invalid) {
      return NextResponse.json(
        { status: false, message: "Invalid working_status filter" },
        { status: 400 },
      );
    }

    if (groupReviewStatusFilter.invalid) {
      return NextResponse.json(
        { status: false, message: "Invalid group_review_status filter" },
        { status: 400 },
      );
    }

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

    const canViewAll = await canViewAllClockPunches(
      session.userId,
      session.userType,
    );
    const where = {
      ...(canViewAll
        ? searchParams.get("employee_id")
          ? { employee_id: searchParams.get("employee_id") }
          : {}
        : { user_id: session.userId }),
      ...(action ? { action } : {}),
      ...(reviewStatus ? { review_status: reviewStatus } : {}),
      ...(punchType ? { punch_type: punchType } : {}),
      ...(from || to
        ? {
            punched_at: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const punches = await prisma.clock_punch.findMany({
      where,
      include: clockPunchInclude,
      orderBy: [{ punched_at: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });

    const dateGroups = applyGroupFilters(groupClockPunchesByDate(punches), {
      breakStatuses: breakStatusFilter.values,
      workingStatuses: workingStatusFilter.values,
      reviewStatuses: groupReviewStatusFilter.values,
    });

    const totalPunches = dateGroups.reduce(
      (sum, dateGroup) => sum + dateGroup.count,
      0,
    );
    const paginate = searchParams.get("paginate") !== "false";
    const paginatedDateGroups = paginate
      ? dateGroups.slice((page - 1) * limit, page * limit)
      : dateGroups;

    return NextResponse.json({
      status: true,
      message: "Clock punches fetched successfully by date",
      data: paginatedDateGroups,
      pagination: {
        page: paginate ? page : 1,
        limit: paginate ? limit : dateGroups.length,
        total_punches: totalPunches,
        total_dates: dateGroups.length,
        total_pages: paginate ? Math.ceil(dateGroups.length / limit) : 1,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/v1/clock_punch/all:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
