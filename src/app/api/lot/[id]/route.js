import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  validateAdminAuth,
  processDateTimeField,
} from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const lot = await prisma.lot.findUnique({
      where: { lot_id: id },
      include: {
        project: {
          include: {
            client: true,
          },
        },
        stages: {
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
        },
        tabs: {
          include: {
            files: {
              where: {
                is_deleted: false,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        },
      },
    });
    return NextResponse.json(
      { status: true, message: "Lot fetched successfully", data: lot },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/lot/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const { name, startDate, installationDueDate, notes, status } =
      await request.json();

    // Build update data object with only provided fields
    const updateData = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (startDate !== undefined) {
      updateData.startDate = startDate ? processDateTimeField(startDate) : null;
    }

    if (installationDueDate !== undefined) {
      updateData.installationDueDate = installationDueDate
        ? processDateTimeField(installationDueDate)
        : null;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    // Update the lot only if there are fields to update
    const lot = await prisma.lot.update({
      where: { lot_id: id },
      data: updateData,
      include: {
        project: true,
      },
    });
    const logged = await withLogging(
      request,
      "lot",
      id,
      "UPDATE",
      `Lot updated successfully: ${lot.name} for project: ${lot.project.name}`
    );
    if (!logged) {
      console.error(`Failed to log lot update: ${id} - ${lot.name}`);
    }
    return NextResponse.json(
      { 
        status: true, 
        message: "Lot updated successfully", 
        data: lot,
        ...(logged ? {} : { warning: "Note: Update succeeded but logging failed" })
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in PATCH /api/lot/[id]:", error);
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
    // Fetch lot with project before deleting
    const lotToDelete = await prisma.lot.findUnique({
      where: { lot_id: id },
      include: {
        project: true,
      },
    });
    const lot = await prisma.lot.delete({
      where: { lot_id: id },
    });
    const logged = await withLogging(
      request,
      "lot",
      id,
      "DELETE",
      `Lot deleted successfully: ${lotToDelete.name} for project: ${lotToDelete.project.name}`
    );
    if (!logged) {
      console.error(`Failed to log lot deletion: ${id} - ${lotToDelete.name}`);
      return NextResponse.json(
        { 
          status: true, 
          message: "Lot deleted successfully", 
          data: lot,
          warning: "Note: Deletion succeeded but logging failed"
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { status: true, message: "Lot deleted successfully", data: lot },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in DELETE /api/lot/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
