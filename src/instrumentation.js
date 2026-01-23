/**
 * Next.js Instrumentation
 * This file runs when the Next.js server initializes
 * Used to start background services like cron jobs
 */

export async function register() {
  // Only run cron jobs on server-side
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeMeetingReminderCron } = await import("@/lib/cron-jobs");

    // Initialize meeting reminder cron job
    initializeMeetingReminderCron();
  }
}
