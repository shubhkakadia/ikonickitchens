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
        is_deleted: false,
      },
      include: {
        project: {
          select: {
            name: true,
            project_id: true,
            client: {
              select: {
                client_id: true,
                client_name: true,
              },
            },
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
              include: {
                employee: {
                  select: {
                    employee_id: true,
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        project: {
          client: {
            client_name: "asc",
          },
        },
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
