import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const logs = await prisma.logs.findMany({
      include: {
        user: { select: { username: true } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(
      { status: true, message: "Logs fetched successfully", data: logs },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/logs:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
