import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/validators/authFromToken";

// Read receipt: stamps read_at on the caller's own row for this update.
// Idempotent, and a second read never overwrites the first read time.
export async function PATCH(request, { params }) {
  try {
    const { error, auth } = await authorizeRequest(request);
    if (error) return error;

    const { id } = await params;

    const result = await prisma.update_recipient.updateMany({
      where: { update_id: id, user_id: auth.user.id, read_at: null },
      data: { read_at: new Date() },
    });

    if (result.count === 0) {
      const existing = await prisma.update_recipient.findFirst({
        where: { update_id: id, user_id: auth.user.id },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { status: false, message: "Update not found" },
          { status: 404 },
        );
      }
    }

    return NextResponse.json({
      status: true,
      message: "Update marked as read",
    });
  } catch (error) {
    console.error("Error in PATCH /api/v1/updates/[id]/read:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
