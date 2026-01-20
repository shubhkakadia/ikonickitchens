import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const users = await prisma.users.findMany({
      where: {
        is_active: true,
      },
      select: {
        id: true,
        username: true,
        user_type: true,
        employee: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        username: "asc",
      },
    });

    // Transform data to include display name
    const transformedUsers = users.map((user) => ({
      id: user.id,
      username: user.username,
      user_type: user.user_type,
      name: user.employee
        ? `${user.employee.first_name || ""} ${user.employee.last_name || ""}`.trim()
        : user.username,
    }));

    return NextResponse.json(
      {
        status: true,
        message: "Users fetched successfully",
        data: transformedUsers,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/user/all:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
