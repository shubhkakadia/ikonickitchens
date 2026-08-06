import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const projects = await prisma.project.findMany({
      where: {
        is_deleted: false,
      },
      include: {
        client: true,
        lots: {
          where: {
            is_deleted: false,
          },
        },
      },
      orderBy: {
        client: {
          client_name: "asc",
        },
      },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Projects fetched successfully",
        data: projects,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/project/all:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
