import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  validateAdminAuth,
  getUserFromToken,
} from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
import { sendNotification } from "@/lib/notification";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

function adelaideLocalToUTC(dateString) {
  const cleanDateString = dateString.replace("Z", "");
  const adelaideDate = dayjs.tz(cleanDateString, "Australia/Adelaide");
  return adelaideDate.utc().toDate();
}

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const {
      participant_ids = [],
      lot_ids = [],
      title,
      date_time,
      date_time_end,
      notes,
      remainder,
    } = body;

    // Validate required fields
    if (!title || !date_time) {
      return NextResponse.json(
        { status: false, message: "Title and date_time are required" },
        { status: 400 },
      );
    }

    // Check for overlapping meetings
    const newStart = adelaideLocalToUTC(date_time);
    const newEnd = date_time_end ? adelaideLocalToUTC(date_time_end) : newStart;

    const overlappingMeeting = await prisma.meeting.findFirst({
      where: {
        // Check for overlap: Existing.Start < New.End AND Existing.End > New.Start
        AND: [
          { date_time: { lt: newEnd } },
          { date_time_end: { gt: newStart } },
        ],
      },
      select: {
        id: true,
        title: true,
        date_time: true,
        date_time_end: true,
      },
    });

    if (overlappingMeeting) {
      return NextResponse.json(
        {
          status: false,
          message: `Meeting time overlaps with existing meeting`,
          overlappingMeeting,
        },
        { status: 409 },
      );
    }

    // Get the current user's ID from the session and ensure they're included as a participant
    const session = await getUserFromToken(request);
    const creatorUserId = session?.user_id;

    // Create a unique list of participant IDs, always including the creator
    const allParticipantIds = [
      ...new Set([
        ...participant_ids,
        ...(creatorUserId ? [creatorUserId] : []),
      ]),
    ];

    // Create the meeting with connected participants and lots
    const meeting = await prisma.meeting.create({
      data: {
        title,
        date_time: newStart,
        date_time_end: date_time_end ? newEnd : null,
        notes: notes || null,
        remainder: remainder || null,
        participants: {
          connect: allParticipantIds.map((id) => ({ id })),
        },
        lots: {
          connect: lot_ids.map((lot_id) => ({ lot_id })),
        },
      },
      include: {
        participants: {
          select: {
            id: true,
            username: true,
            employee: {
              select: { first_name: true, last_name: true },
            },
          },
        },
        lots: {
          select: { lot_id: true, name: true },
        },
      },
    });

    // Log the creation
    const logged = await withLogging(
      request,
      "meeting",
      meeting.id,
      "CREATE",
      `Meeting created successfully: ${meeting.title}`,
    );
    if (!logged) {
      console.error(
        `Failed to log meeting creation: ${meeting.id} - ${meeting.title}`,
      );
    }

    // Send meeting notifications to participants
    try {
      // Fetch additional data for notification
      const meetingWithDetails = await prisma.meeting.findUnique({
        where: { id: meeting.id },
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

      if (meetingWithDetails) {
        // Format project names
        const projectNames =
          [
            ...new Set(
              meetingWithDetails.lots
                .map((lot) => lot.project?.name)
                .filter(Boolean),
            ),
          ].join(", ") || "No projects";

        // Format lot IDs with client names
        const lotIdClient =
          meetingWithDetails.lots
            .map((lot) => {
              const clientName =
                lot.project?.client?.client_name || "Unknown Client";
              return `${lot.lot_id} (${clientName})`;
            })
            .join(", ") || "No lots";

        // Format date (DD/MM/YYYY)
        const formattedDate = dayjs(meetingWithDetails.date_time)
          .tz("Australia/Adelaide")
          .format("DD/MM/YYYY");

        // Format time (HH:MM AM/PM)
        const formattedTime = dayjs(meetingWithDetails.date_time)
          .tz("Australia/Adelaide")
          .format("h:mm A");

        // Format participants
        const participants = meetingWithDetails.participants
          .map((p) =>
            `${p.employee?.first_name || ""} ${p.employee?.last_name || ""}`.trim(),
          )
          .filter(Boolean);

        const participant1 = participants[0] || "No participants";
        const participant2Plus =
          participants.length > 1 ? participants.slice(1).join(", ") : "";

        // Build notification record
        const notificationRecord = {
          title: meetingWithDetails.title,
          project_names: projectNames,
          lot_id_client: lotIdClient,
          date: formattedDate,
          time: formattedTime,
          participant1,
          participant2_plus: participant2Plus,
          notes: meetingWithDetails.notes || "No notes provided",
        };

        // Send notification
        await sendNotification(notificationRecord, "meeting_confirmation");
      }
    } catch (notificationError) {
      console.error("Error sending meeting notifications:", notificationError);
      // Don't fail the meeting creation if notifications fail
    }

    return NextResponse.json({
      status: true,
      message: "Meeting created successfully",
      ...(logged
        ? {}
        : { warning: "Note: Creation succeeded but logging failed" }),
      data: meeting,
    });
  } catch (error) {
    console.error("Error in POST /api/meeting/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
