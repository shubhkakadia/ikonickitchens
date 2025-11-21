import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
  processDateTimeField,
} from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";

export async function DELETE(request, { params }) {
  try {
    const admin = await isAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { status: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    if (await isSessionExpired(request)) {
      return NextResponse.json(
        { status: false, message: "Session expired" },
        { status: 401 }
      );
    }
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
      return NextResponse.json(
        { status: false, message: "Failed to log stage deletion" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { status: true, message: "Stage deleted successfully", data: stage },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const admin = await isAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { status: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    if (await isSessionExpired(request)) {
      return NextResponse.json(
        { status: false, message: "Session expired" },
        { status: 401 }
      );
    }
    const { id } = await params;
    const { name, status, notes, startDate, endDate, assigned_to } =
      await request.json();

    // Update the stage basic information
    const stage = await prisma.stage.update({
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
    await prisma.stage_employee.deleteMany({
      where: { stage_id: id },
    });

    // Then create new assignments if any
    if (assigned_to && assigned_to.length > 0) {
      await prisma.stage_employee.createMany({
        data: assigned_to.map((employee_id) => ({
          stage_id: id,
          employee_id: employee_id,
        })),
        skipDuplicates: true, // Safety check, though should be unnecessary after delete
      });
    }

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
      return NextResponse.json(
        { status: false, message: "Failed to log stage update" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Stage updated successfully",
        data: updatedStage,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
