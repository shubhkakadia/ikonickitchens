import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/validators/authFromToken";
import { UPDATE_TYPES, feedWhere } from "@/lib/updates";

// Marks every unread update the caller can see as read.
// Optional JSON body { type } limits it to one update type.
export async function POST(request) {
  try {
    const { error, auth } = await authorizeRequest(request);
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const type = UPDATE_TYPES.includes(body?.type) ? body.type : null;

    const result = await prisma.update_recipient.updateMany({
      where: feedWhere(auth, { unread: true, type }),
      data: { read_at: new Date() },
    });

    return NextResponse.json({
      status: true,
      message: "Updates marked as read",
      data: { count: result.count },
    });
  } catch (error) {
    console.error("Error in POST /api/v1/updates/read-all:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
