import "server-only";

import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/session";
import { calculateClockPunchHours } from "@/lib/clockPunchMetrics";
import { CLOCK_PUNCH_ACTION_LIST } from "@/lib/clockPunchSequence";
import { prisma } from "@/lib/db";

export { getAllowedNextActions } from "@/lib/clockPunchSequence";

dayjs.extend(utc);
dayjs.extend(timezone);

export const CLOCK_PUNCH_TIME_ZONE = "Australia/Adelaide";
export const MINIMUM_BREAK_MINUTES = 30;

const CLOCK_PUNCH_ACTIONS = new Set(CLOCK_PUNCH_ACTION_LIST);

const CLOCK_PUNCH_REVIEW_STATUSES = new Set([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

const CLOCK_PUNCH_TYPES = new Set(["EMPLOYEE", "MANUAL"]);

const CLOCK_PUNCH_BREAK_STATUSES = new Set([
  "ON_BREAK",
  "BREAK_COMPLETED",
  "NO_BREAK",
]);

const CLOCK_PUNCH_WORKING_STATUSES = new Set(["WORKING", "NOT_WORKING"]);

const CLOCK_PUNCH_GROUP_REVIEW_STATUSES = new Set([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "MIXED",
]);

const REVIEWER_USER_TYPES = new Set(["admin", "master-admin"]);

export const clockPunchInclude = {
  employee: {
    select: {
      employee_id: true,
      first_name: true,
      last_name: true,
      role: true,
    },
  },
  user: {
    select: {
      id: true,
      username: true,
    },
  },
  reviewed_by: {
    select: {
      id: true,
      username: true,
    },
  },
};

function normalizeEnumValue(value) {
  if (typeof value !== "string") return null;

  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizeClockPunchAction(value) {
  const normalized = normalizeEnumValue(value);
  return CLOCK_PUNCH_ACTIONS.has(normalized) ? normalized : null;
}

export function normalizeClockPunchReviewStatus(value) {
  const normalized = normalizeEnumValue(value);
  return CLOCK_PUNCH_REVIEW_STATUSES.has(normalized) ? normalized : null;
}

export function normalizeClockPunchType(value) {
  const normalized = normalizeEnumValue(value);
  return CLOCK_PUNCH_TYPES.has(normalized) ? normalized : null;
}

export function normalizeClockPunchBreakStatus(value) {
  const normalized = normalizeEnumValue(value);
  return CLOCK_PUNCH_BREAK_STATUSES.has(normalized) ? normalized : null;
}

export function normalizeClockPunchWorkingStatus(value) {
  const normalized = normalizeEnumValue(value);
  return CLOCK_PUNCH_WORKING_STATUSES.has(normalized) ? normalized : null;
}

export function normalizeClockPunchGroupReviewStatus(value) {
  const normalized = normalizeEnumValue(value);
  return CLOCK_PUNCH_GROUP_REVIEW_STATUSES.has(normalized) ? normalized : null;
}

export function getClockPunchDayBounds(date = new Date()) {
  const localDate = dayjs(date).tz(CLOCK_PUNCH_TIME_ZONE);

  return {
    start: localDate.startOf("day").utc().toDate(),
    end: localDate.add(1, "day").startOf("day").utc().toDate(),
  };
}

// Calendar dates (YYYY-MM-DD) sent by the admin UI describe Adelaide days, so
// they are converted to the matching UTC instants before hitting the database.
export function getClockPunchDateBoundary(value, boundary = "start") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return undefined;

  const localDate = dayjs.tz(value, CLOCK_PUNCH_TIME_ZONE);
  if (!localDate.isValid()) return undefined;

  return boundary === "end"
    ? localDate.endOf("day").utc().toDate()
    : localDate.startOf("day").utc().toDate();
}

// Combines an Adelaide calendar date with a HH:mm wall clock time into the UTC
// instant the punch actually happened at.
export function getClockPunchInstant(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ""))) return null;

  const instant = dayjs.tz(`${date}T${time}:00`, CLOCK_PUNCH_TIME_ZONE);
  return instant.isValid() ? instant.toDate() : null;
}

export function getMinimumBreakEnd(breakStartedAt) {
  return new Date(
    new Date(breakStartedAt).getTime() + MINIMUM_BREAK_MINUTES * 60 * 1000,
  );
}

export function groupClockPunchesByDate(punches, currentTime = new Date()) {
  const groups = new Map();

  for (const punch of punches) {
    const date = dayjs(punch.punched_at)
      .tz(CLOCK_PUNCH_TIME_ZONE)
      .format("YYYY-MM-DD");

    if (!groups.has(date)) {
      groups.set(date, {
        date,
        count: 0,
        hours: 0,
        punches: [],
      });
    }

    const group = groups.get(date);
    group.punches.push(punch);
    group.count += 1;
  }

  const dateGroups = Array.from(groups.values());

  for (const group of dateGroups) {
    const punchesByEmployee = new Map();

    for (const punch of group.punches) {
      const employeeKey = punch.employee_id || punch.user_id;
      const employeePunches = punchesByEmployee.get(employeeKey) || [];
      employeePunches.push(punch);
      punchesByEmployee.set(employeeKey, employeePunches);
    }

    group.employee_groups = Array.from(punchesByEmployee.values()).map(
      (employeePunches) => {
        const orderedPunches = [...employeePunches].sort(
          (first, second) =>
            new Date(first.punched_at).getTime() -
            new Date(second.punched_at).getTime(),
        );
        const activePunches = orderedPunches.filter(
          (punch) => punch.review_status !== "REJECTED",
        );
        const reviewStatuses = new Set(
          employeePunches.map((punch) => punch.review_status),
        );
        const lastAction = activePunches.at(-1)?.action;
        const hasCompletedBreak = activePunches.some(
          (punch) => punch.action === "BREAK_OUT",
        );
        const hasClockOut = activePunches.some(
          (punch) => punch.action === "CLOCK_OUT",
        );
        const referencePunch = activePunches.find(
          (punch) => punch.action === "CLOCK_IN",
        );

        let reviewStatus = "MIXED";
        if (reviewStatuses.size === 1) {
          reviewStatus = reviewStatuses.values().next().value;
        } else if (reviewStatuses.has("PENDING")) {
          reviewStatus = "PENDING";
        }

        return {
          date: group.date,
          employee_id: employeePunches[0]?.employee_id,
          employee: employeePunches[0]?.employee || null,
          count: employeePunches.length,
          hours: Number(
            calculateClockPunchHours(employeePunches, currentTime).toFixed(2),
          ),
          break_status:
            lastAction === "BREAK_IN"
              ? "ON_BREAK"
              : hasCompletedBreak
                ? "BREAK_COMPLETED"
                : "NO_BREAK",
          review_status: reviewStatus,
          working_status: hasClockOut ? "NOT_WORKING" : "WORKING",
          reference_punch_id: referencePunch?.id || null,
          punches: employeePunches,
        };
      },
    );

    const totalHours = group.employee_groups.reduce(
      (sum, employeeGroup) => sum + employeeGroup.hours,
      0,
    );

    group.hours = Number(totalHours.toFixed(2));
  }

  return dateGroups;
}

export function isClockPunchReviewer(userType) {
  return REVIEWER_USER_TYPES.has(String(userType || "").toLowerCase());
}

export async function canViewAllClockPunches(userId, userType) {
  if (isClockPunchReviewer(userType)) return true;

  const moduleAccess = await prisma.module_access.findUnique({
    where: { user_id: userId },
    select: { all_clock_punches: true },
  });

  return moduleAccess?.all_clock_punches === true;
}

export async function canAddClockPunches(userId, userType) {
  if (isClockPunchReviewer(userType)) return true;

  const moduleAccess = await prisma.module_access.findUnique({
    where: { user_id: userId },
    select: { add_clock_punch: true },
  });

  return moduleAccess?.add_clock_punch === true;
}

export async function authenticateClockPunchRequest(request) {
  const authResult = await authenticateRequest(request);

  if (!authResult.success) {
    return {
      error: NextResponse.json(
        { status: false, message: authResult.error },
        { status: authResult.statusCode },
      ),
      session: null,
    };
  }

  return { error: null, session: authResult.sessionData };
}
