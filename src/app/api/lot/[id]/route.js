import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  validateAdminAuth,
  processDateTimeField,
} from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const lot = await prisma.lot.findFirst({
      where: {
        id: id,
        is_deleted: false,
      },
      include: {
        installer: {
          select: {
            employee_id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
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
              include: {
                maintenance_checklist: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        },
      },
    });

    if (!lot) {
      return NextResponse.json(
        { status: false, message: "Lot not found" },
        { status: 404 }
      );
    }

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
    const { name, startDate, installationDueDate, notes, status, installer_id } =
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

    if (installer_id !== undefined) {
      if (installer_id === null || installer_id === "") {
        updateData.installer_id = null;
      } else {
        const installerExists = await prisma.employees.findUnique({
          where: { employee_id: installer_id },
          select: { employee_id: true },
        });
        if (!installerExists) {
          return NextResponse.json(
            { status: false, message: "Invalid installer selected" },
            { status: 400 }
          );
        }
        updateData.installer_id = installer_id;
      }
    }

    // Update the lot only if there are fields to update
    const lot = await prisma.lot.update({
      where: { id: id },
      data: updateData,
      include: {
        project: true,
        installer: {
          select: {
            employee_id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
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

    // Fetch lot with project before soft deleting
    const lotToDelete = await prisma.lot.findUnique({
      where: { id: id },
      include: {
        project: true,
      },
    });

    if (!lotToDelete) {
      return NextResponse.json(
        { status: false, message: "Lot not found" },
        { status: 404 }
      );
    }

    if (lotToDelete.is_deleted) {
      return NextResponse.json(
        { status: false, message: "Lot already deleted" },
        { status: 400 }
      );
    }

    // Soft delete the lot record (set is_deleted flag)
    const lot = await prisma.lot.update({
      where: { id: id },
      data: { is_deleted: true },
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
