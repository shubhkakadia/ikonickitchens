import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { status: false, message: "User ID is required" },
        { status: 400 },
      );
    }

    // Get all meetings where the user is a participant
    const meetings = await prisma.meeting.findMany({
      where: {
        participants: {
          some: {
            id: id,
          },
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
          select: {
            lot_id: true,
            name: true,
            project: {
              select: { name: true, project_id: true },
            },
          },
        },
      },
      orderBy: {
        date_time: "asc",
      },
    });

    return NextResponse.json({
      status: true,
      message: "Meetings fetched successfully",
      data: meetings,
    });
  } catch (error) {
    console.error("Error in GET /api/meeting/all/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
