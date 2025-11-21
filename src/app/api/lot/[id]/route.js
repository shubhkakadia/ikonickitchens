import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
  processDateTimeField,
} from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";

export async function GET(request, { params }) {
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
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

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
      return NextResponse.json(
        { status: false, message: "Failed to log lot deletion" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { status: true, message: "Lot deleted successfully", data: lot },
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
      return NextResponse.json(
        { status: false, message: "Failed to log lot update" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { status: true, message: "Lot updated successfully", data: lot },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
