import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const activeLots = await prisma.lot.findMany({
      where: {
        status: "ACTIVE",
      },
      include: {
        project: {
          select: {
            name: true,
            project_id: true,
          },
        },
        stages: {
          select: {
            stage_id: true,
            name: true,
            status: true,
            notes: true,
            startDate: true,
            endDate: true,
            assigned_to: {
              select: {
                employee_id: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Active lots fetched successfully",
        data: activeLots,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/lot/active:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
