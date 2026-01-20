import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
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
