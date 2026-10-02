import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/validators/authFromToken";
import { actorName } from "@/lib/updates";

// Who has (and hasn't) read an update. Admin and master-admin only.
export async function GET(request, { params }) {
  try {
    const { error } = await authorizeRequest(request, {
      roles: ["master-admin", "admin"],
    });
    if (error) return error;

    const { id } = await params;

    const rows = await prisma.update_recipient.findMany({
      where: { update_id: id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            employee: { select: { first_name: true, last_name: true } },
          },
        },
      },
      orderBy: [{ read_at: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      status: true,
      message: "Readers fetched successfully",
      data: {
        readers: rows.map((row) => ({
          user_id: row.user.id,
          name: actorName(row.user),
          read_at: row.read_at,
          is_read: Boolean(row.read_at),
        })),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/v1/updates/[id]/readers:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
