import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  validateAdminAuth,
  processDateTimeField,
} from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { lot_id, name, status, notes, startDate, endDate, assigned_to } =
      await request.json();

    // Use transaction to ensure atomicity - stage creation and employee assignments succeed or fail together
    const stageId = await prisma.$transaction(async (tx) => {
      // Create the stage
      const newStage = await tx.stage.create({
        data: {
          lot_id: lot_id.toLowerCase(),
          name: name.toLowerCase(),
          status,
          notes,
          startDate: processDateTimeField(startDate),
          endDate: processDateTimeField(endDate),
        },
      });

      // Create the stage_employee relationships if assigned_to is provided
      // If this fails, the stage creation will be rolled back
      if (assigned_to && assigned_to.length > 0) {
        await tx.stage_employee.createMany({
          data: assigned_to.map((employee_id) => ({
            stage_id: newStage.stage_id,
            employee_id: employee_id,
          })),
          skipDuplicates: true, // Skip if the relationship already exists
        });
      }

      return newStage.stage_id;
    });

    // Fetch the complete stage with all relationships for response
    const stage = await prisma.stage.findUnique({
      where: { stage_id: stageId },
      include: {
        lot: {
          select: {
            project: { select: { project_id: true, name: true } },
          },
        },
        assigned_to: {
          include: {
            employee: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });

    // lot id and project name for logging
    const logged = await withLogging(
      request,
      "stage",
      stage.stage_id,
      "CREATE",
      `Stage created successfully: ${stage.name} for lot: ${stage.lot_id} and project: ${stage.lot?.project?.name}`
    );
    if (!logged) {
      console.error(`Failed to log stage creation: ${stage.stage_id} - ${stage.name}`);
      return NextResponse.json(
        { 
          status: true, 
          message: "Stage created successfully", 
          data: stage,
          warning: "Note: Creation succeeded but logging failed"
        },
        { status: 201 }
      );
    }
    return NextResponse.json(
      { status: true, message: "Stage created successfully", data: stage },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/stage/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
