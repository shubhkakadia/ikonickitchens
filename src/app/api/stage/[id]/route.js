import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  validateAdminAuth,
  processDateTimeField,
} from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const { name, status, notes, startDate, endDate, assigned_to } =
      await request.json();

    // Use transaction to ensure atomicity - all operations succeed or all fail
    const stage = await prisma.$transaction(async (tx) => {
      // Update the stage basic information
      const updatedStage = await tx.stage.update({
        where: { stage_id: id },
        data: {
          name: name ? name.toLowerCase() : undefined,
          status,
          notes,
          startDate:
            startDate && startDate.trim() !== ""
              ? processDateTimeField(startDate)
              : null,
          endDate:
            endDate && endDate.trim() !== ""
              ? processDateTimeField(endDate)
              : null,
        },
      });

      // Handle employee assignments: delete all existing, then create new ones
      // First, delete all existing assignments for this stage
      await tx.stage_employee.deleteMany({
        where: { stage_id: id },
      });

      // Then create new assignments if any
      // If this fails, the entire transaction (including stage update and delete) will roll back
      if (assigned_to && assigned_to.length > 0) {
        await tx.stage_employee.createMany({
          data: assigned_to.map((employee_id) => ({
            stage_id: id,
            employee_id: employee_id,
          })),
          skipDuplicates: true, // Safety check, though should be unnecessary after delete
        });
      }

      return updatedStage;
    });

    // Fetch the updated stage with all relationships
    const updatedStage = await prisma.stage.findUnique({
      where: { stage_id: id },
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

    const logged = await withLogging(
      request,
      "stage",
      id,
      "UPDATE",
      `Stage updated successfully: ${updatedStage.name} for lot: ${updatedStage.lot_id} and project: ${updatedStage.lot?.project?.name}`
    );
    if (!logged) {
      console.error(`Failed to log stage update: ${id} - ${updatedStage.name}`);
    }
    return NextResponse.json(
      {
        status: true,
        message: "Stage updated successfully",
        data: updatedStage,
        ...(logged ? {} : { warning: "Note: Update succeeded but logging failed" })
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in PATCH /api/stage/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const stage = await prisma.stage.delete({
      where: { stage_id: id },
      include: {
        lot: {
          select: {
            project: { select: { project_id: true, name: true } },
          },
        },
      },
    });
    const logged = await withLogging(
      request,
      "stage",
      id,
      "DELETE",
      `Stage deleted successfully: ${stage.name} for lot: ${stage.lot_id} and project: ${stage.lot?.project?.name}`
    );
    if (!logged) {
      console.error(`Failed to log stage deletion: ${id} - ${stage.name}`);
      return NextResponse.json(
        { 
          status: true, 
          message: "Stage deleted successfully", 
          data: stage,
          warning: "Note: Deletion succeeded but logging failed"
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { status: true, message: "Stage deleted successfully", data: stage },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in DELETE /api/stage/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
