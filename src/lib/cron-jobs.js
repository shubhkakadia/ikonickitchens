import cron from "node-cron";
import { prisma } from "@/lib/db";
import { sendNotification } from "@/lib/notification";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Meeting Reminder Cron Job
 * Runs every 5 minutes to check for meetings starting in 55-65 minutes
 * Sends WhatsApp reminders to participants who have meeting notifications enabled
 */
export function initializeMeetingReminderCron() {
  // Run every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      const now = new Date();

      // Calculate time window: 55-65 minutes from now
      const windowStart = new Date(now.getTime() + 55 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 65 * 60 * 1000);

      console.log(
        `[Cron] Checking for meetings between ${dayjs(windowStart).tz("Australia/Adelaide").format("YYYY-MM-DD HH:mm")} and ${dayjs(windowEnd).tz("Australia/Adelaide").format("YYYY-MM-DD HH:mm")}`,
      );

      // Find meetings in the time window that haven't had 1h reminder sent
      const meetings = await prisma.meeting.findMany({
        where: {
          date_time: {
            gte: windowStart,
            lte: windowEnd,
          },
          remainder_1h_sent: false,
        },
        include: {
          participants: {
            include: {
              employee: {
                select: {
                  first_name: true,
                  last_name: true,
                  phone: true,
                },
              },
              notification_config: {
                select: {
                  meeting: true,
                },
              },
            },
          },
          lots: {
            include: {
              project: {
                select: {
                  name: true,
                  client: {
                    select: {
                      client_name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (meetings.length === 0) {
        console.log("[Cron] No meetings found for reminders.");
        return;
      }

      console.log(
        `[Cron] Found ${meetings.length} meeting(s) requiring 1h reminders.`,
      );

      // Process each meeting
      for (const meeting of meetings) {
        try {
          // Format project names
          const projectNames =
            [
              ...new Set(
                meeting.lots.map((lot) => lot.project?.name).filter(Boolean),
              ),
            ].join(", ") || "No projects";

          // Format lot IDs with client names
          const lotIdClient =
            meeting.lots
              .map((lot) => {
                const clientName =
                  lot.project?.client?.client_name || "Unknown Client";
                return `${lot.lot_id} (${clientName})`;
              })
              .join(", ") || "No lots";

          // Format date (DD/MM/YYYY)
          const formattedDate = dayjs(meeting.date_time)
            .tz("Australia/Adelaide")
            .format("DD/MM/YYYY");

          // Format time (HH:MM AM/PM)
          const formattedTime = dayjs(meeting.date_time)
            .tz("Australia/Adelaide")
            .format("h:mm A");

          // Format participants
          const participants = meeting.participants
            .map((p) =>
              `${p.employee?.first_name || ""} ${p.employee?.last_name || ""}`.trim(),
            )
            .filter(Boolean);

          const participant1 = participants[0] || "No participants";
          const participant2Plus =
            participants.length > 1 ? participants.slice(1).join(", ") : "";

          // Build notification record
          const notificationRecord = {
            title: meeting.title,
            project_names: projectNames,
            lot_id_client: lotIdClient,
            date: formattedDate,
            time: formattedTime,
            participant1,
            participant2_plus: participant2Plus,
            notes: meeting.notes || "No notes provided",
          };

          // Send WhatsApp reminder to participants
          const result = await sendNotification(
            notificationRecord,
            "meeting_confirmation",
          );

          console.log(
            `[Cron] Reminder sent for meeting "${meeting.title}":`,
            result,
          );

          // Mark reminder as sent
          await prisma.meeting.update({
            where: { id: meeting.id },
            data: { remainder_1h_sent: true },
          });

          console.log(
            `[Cron] Marked meeting "${meeting.title}" as reminder_1h_sent.`,
          );
        } catch (meetingError) {
          console.error(
            `[Cron] Error processing meeting ${meeting.id}:`,
            meetingError,
          );
          // Continue processing other meetings even if one fails
        }
      }
    } catch (err) {
      console.error("[Cron] 1h meeting reminder cron failed:", err);
    }
  });

  console.log("✓ Cron job initialized: Meeting reminder (1h before)");
}
