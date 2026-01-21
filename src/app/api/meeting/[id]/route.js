import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
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

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { id } = await params;
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

    // Check if meeting exists
    const existingMeeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!existingMeeting) {
      return NextResponse.json(
        { status: false, message: "Meeting not found" },
        { status: 404 },
      );
    }

    // Check for overlapping meetings (excluding current one)
    const newStart = adelaideLocalToUTC(date_time);
    const newEnd = date_time_end ? adelaideLocalToUTC(date_time_end) : newStart;

    const overlappingMeeting = await prisma.meeting.findFirst({
      where: {
        id: { not: id },
        // Check for overlap: Existing.Start < New.End AND Existing.End > New.Start
        AND: [
          { date_time: { lt: newEnd } },
          { date_time_end: { gt: newStart } },
        ],
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

    // Update meeting
    const updatedMeeting = await prisma.meeting.update({
      where: { id },
      data: {
        title,
        date_time: newStart,
        date_time_end: date_time_end ? newEnd : null,
        notes: notes || null,
        remainder: remainder || null,
        participants: {
          set: participant_ids.map((pid) => ({ id: pid })),
        },
        lots: {
          set: lot_ids.map((lid) => ({ lot_id: lid })),
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

    // Log update
    await withLogging(
      request,
      "meeting",
      updatedMeeting.id,
      "UPDATE",
      `Meeting updated: ${updatedMeeting.title}`,
    );

    // Send meeting notifications to participants
    try {
      // Fetch additional data for notification
      const meetingWithDetails = await prisma.meeting.findUnique({
        where: { id: updatedMeeting.id },
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
      // Don't fail the meeting update if notifications fail
    }

    return NextResponse.json({
      status: true,
      message: "Meeting updated successfully",
      data: updatedMeeting,
    });
  } catch (error) {
    console.error(`Error in PATCH /api/meeting/${params.id}:`, error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { id } = params;

    // Check if meeting exists
    const existingMeeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!existingMeeting) {
      return NextResponse.json(
        { status: false, message: "Meeting not found" },
        { status: 404 },
      );
    }

    // Delete meeting
    await prisma.meeting.delete({
      where: { id },
    });

    // Log deletion
    await withLogging(
      request,
      "meeting",
      id,
      "DELETE",
      `Meeting deleted: ${existingMeeting.title}`,
    );

    return NextResponse.json({
      status: true,
      message: "Meeting deleted successfully",
    });
  } catch (error) {
    console.error(`Error in DELETE /api/meeting/${params.id}:`, error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
