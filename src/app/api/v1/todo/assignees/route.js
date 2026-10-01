import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/validators/authFromToken";
import { presentUser } from "@/lib/todoData";

// Users that can be tagged on a task. Separate from /user/all, which needs the
// calendar module — anyone who can use the dashboard can tag.
export async function GET(request) {
  try {
    const authError = await requireAuth(request, { modules: ["dashboard"] });
    if (authError) return authError;

    const users = await prisma.users.findMany({
      where: { is_active: true },
      select: {
        id: true,
        username: true,
        employee: { select: { first_name: true, last_name: true } },
      },
      orderBy: { username: "asc" },
    });

    return NextResponse.json({
      status: true,
      message: "Users fetched successfully",
      data: users.map(presentUser),
    });
  } catch (error) {
    console.error("Error in GET /api/v1/todo/assignees:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
