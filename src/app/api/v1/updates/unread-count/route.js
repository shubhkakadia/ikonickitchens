import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/validators/authFromToken";
import { feedWhere } from "@/lib/updates";

// Cheap endpoint for the sidebar bell to poll.
export async function GET(request) {
  try {
    const { error, auth } = await authorizeRequest(request);
    if (error) return error;

    const unreadCount = await prisma.update_recipient.count({
      where: feedWhere(auth, { unread: true }),
    });

    return NextResponse.json({
      status: true,
      message: "Unread count fetched successfully",
      data: { unread_count: unreadCount },
    });
  } catch (error) {
    console.error("Error in GET /api/v1/updates/unread-count:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
