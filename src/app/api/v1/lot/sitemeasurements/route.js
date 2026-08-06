import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    // Fetch all active lots with stages
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

    // Helper function to get stage status
    const getStageStatus = (lot, stageName) => {
      const stage = lot.stages?.find(
        (s) => s.name.toLowerCase() === stageName.toLowerCase(),
      );
      return stage ? stage.status : "NOT_STARTED";
    };

    // Filter pending measurements
    const pendingLots = activeLots.filter((lot) => {
      const siteMeasurementsStatus = getStageStatus(lot, "Site Measurements");
      const finalDesignApprovalStatus = getStageStatus(
        lot,
        "Final Design Approval",
      );

      return (
        (siteMeasurementsStatus === "NOT_STARTED" ||
          siteMeasurementsStatus === "IN_PROGRESS") &&
        finalDesignApprovalStatus === "DONE"
      );
    });

    // Filter done measurements
    const doneLots = activeLots.filter((lot) => {
      const siteMeasurementsStatus = getStageStatus(lot, "Site Measurements");
      const finalApprovalForProductionStatus = getStageStatus(
        lot,
        "Final Approval for production",
      );

      return (
        siteMeasurementsStatus === "DONE" &&
        finalApprovalForProductionStatus !== "DONE"
      );
    });

    return NextResponse.json(
      {
        status: true,
        message: "Site measurements fetched successfully",
        data: {
          pending: pendingLots,
          done: doneLots,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/lot/sitemeasurements:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
