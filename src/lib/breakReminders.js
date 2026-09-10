import "server-only";

import { CLOCK_PUNCH_MINIMUM_BREAK_MINUTES } from "@/lib/clockPunchSequence";
import { prisma } from "@/lib/db";
import { sendPushToUsers } from "@/lib/pushNotifications";

// How long before the break is due the heads-up goes out.
export const BREAK_WARNING_MINUTES = 5;

// A break that started longer ago than this is never reminded about. Without a
// cap, a shift that was left without a BREAK_OUT would page the employee the
// next time the worker sees it, hours after the break actually ended.
const MAX_REMINDER_AGE_MINUTES = 4 * 60;

const MINUTE_MS = 60 * 1000;

function minutesElapsedSince(date, now) {
  return (now.getTime() - new Date(date).getTime()) / MINUTE_MS;
}

function employeeFirstName(punch) {
  return punch.employee?.first_name?.trim() || null;
}

/**
 * Break reminders are only useful while the employee is still on break, so a
 * BREAK_IN that already has a later punch (the BREAK_OUT, or an admin-added
 * correction) is skipped.
 */
async function isStillOnBreak(punch) {
  const laterPunch = await prisma.clock_punch.findFirst({
    where: {
      employee_id: punch.employee_id,
      review_status: { not: "REJECTED" },
      punched_at: { gt: punch.punched_at },
    },
    select: { id: true },
  });

  return laterPunch === null;
}

async function sendBreakPush(punch, { title, body, kind }) {
  return sendPushToUsers({
    userWhere: { id: punch.user_id, is_active: true },
    title,
    body,
    channelId: "clock-punch",
    data: { screen: "clock-punch", kind, punch_id: punch.id },
    auditEntityId: punch.id,
    scope: `break-reminder:${kind}`,
  });
}

function buildWarningMessage(punch, minutesLeft) {
  const name = employeeFirstName(punch);

  return {
    kind: "BREAK_ENDING_SOON",
    title: "Break ending soon",
    body: `${name ? `${name}, you` : "You"} have ${minutesLeft} minute${
      minutesLeft === 1 ? "" : "s"
    } left on your break.`,
  };
}

function buildBreakOverMessage(punch) {
  const name = employeeFirstName(punch);

  return {
    kind: "BREAK_OVER",
    title: "Your break is over",
    body: `${name ? `${name}, your` : "Your"} ${CLOCK_PUNCH_MINIMUM_BREAK_MINUTES} minute break has ended. Please punch out of your break.`,
  };
}

/**
 * Sends the two break reminders for every employee currently on break: a
 * heads-up BREAK_WARNING_MINUTES before the break is due, then the break-over
 * notice once the full break has elapsed.
 *
 * Each reminder is stamped on the BREAK_IN punch, so a worker that runs late,
 * twice, or after a restart never re-sends one. A break that passes its due
 * time without the warning having gone out (the worker was down through the
 * warning window) sends only the break-over notice and marks the warning
 * suppressed rather than delivering a "5 minutes left" that is already wrong.
 */
export async function processBreakReminders(now = new Date()) {
  const warningAfterMinutes =
    CLOCK_PUNCH_MINIMUM_BREAK_MINUTES - BREAK_WARNING_MINUTES;

  const candidates = await prisma.clock_punch.findMany({
    where: {
      action: "BREAK_IN",
      review_status: { not: "REJECTED" },
      punched_at: {
        gte: new Date(now.getTime() - MAX_REMINDER_AGE_MINUTES * MINUTE_MS),
        lte: new Date(now.getTime() - warningAfterMinutes * MINUTE_MS),
      },
      OR: [{ break_warning_sent_at: null }, { break_over_sent_at: null }],
    },
    select: {
      id: true,
      employee_id: true,
      user_id: true,
      punched_at: true,
      break_warning_sent_at: true,
      break_over_sent_at: true,
      employee: { select: { first_name: true } },
    },
    orderBy: { punched_at: "asc" },
  });

  const summary = { candidates: candidates.length, warned: 0, expired: 0 };

  for (const punch of candidates) {
    try {
      if (!(await isStillOnBreak(punch))) continue;

      const elapsedMinutes = minutesElapsedSince(punch.punched_at, now);
      const isDue = elapsedMinutes >= CLOCK_PUNCH_MINIMUM_BREAK_MINUTES;

      if (isDue) {
        if (punch.break_over_sent_at) continue;

        await sendBreakPush(punch, buildBreakOverMessage(punch));
        await prisma.clock_punch.update({
          where: { id: punch.id },
          data: {
            break_over_sent_at: now,
            ...(punch.break_warning_sent_at
              ? {}
              : { break_warning_sent_at: now }),
          },
        });
        summary.expired += 1;
        continue;
      }

      if (punch.break_warning_sent_at) continue;

      const minutesLeft = Math.max(
        1,
        Math.ceil(CLOCK_PUNCH_MINIMUM_BREAK_MINUTES - elapsedMinutes),
      );

      await sendBreakPush(punch, buildWarningMessage(punch, minutesLeft));
      await prisma.clock_punch.update({
        where: { id: punch.id },
        data: { break_warning_sent_at: now },
      });
      summary.warned += 1;
    } catch (error) {
      // One employee's failed reminder must not stop the rest of the run.
      console.error(
        `[BreakReminder] Failed to process punch ${punch.id}:`,
        error,
      );
    }
  }

  return summary;
}
