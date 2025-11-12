import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
  processDateTimeField,
} from "../../../../../lib/validators/authFromToken";

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
    });
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
