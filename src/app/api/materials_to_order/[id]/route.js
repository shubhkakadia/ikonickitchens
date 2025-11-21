import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
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
    const mto = await prisma.materials_to_order.findUnique({
      where: { id },
      include: {
        lots: {
          include: {
            project: true,
          },
        },
        items: {
          include: {
            item: {
              include: {
                sheet: true,
                handle: true,
                hardware: true,
                accessory: true,
                edging_tape: true,
                image: true,
              },
            },
          },
        },
        project: {
          include: {
            lots: true,
          },
        },
      },
    });

    // Fetch media separately to avoid Prisma client issues
    const media = await prisma.media.findMany({
      where: {
        materials_to_orderId: id,
        is_deleted: false,
      },
    });

    // Add media to the response
    const mtoWithMedia = {
      ...mto,
      media: media,
    };

    return NextResponse.json(
      {
        status: true,
        message: "Materials to order fetched successfully",
        data: mtoWithMedia,
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
    const data = await request.json();
    const { status, notes, items } = data;

    // Build the update data object
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    // Handle items updates
    if (items !== undefined) {
      updateData.items = {
        // Delete all existing items first, then create new ones
        deleteMany: {},
        create: items.map((item) => ({
          item_id: item.item_id,
          quantity: item.quantity,
          notes: item.notes,
        })),
      };
    }

    const mto = await prisma.materials_to_order.update({
      where: { id },
      data: updateData,
      include: {
        lots: {
          include: {
            project: true,
          },
        },
        items: {
          include: {
            item: {
              include: {
                sheet: true,
                handle: true,
                hardware: true,
                accessory: true,
                edging_tape: true,
                image: true,
              },
            },
          },
        },
        project: {
          include: {
            lots: true,
          },
        },
      },
    });

    // Fetch media separately
    const media = await prisma.media.findMany({
      where: {
        materials_to_orderId: id,
        is_deleted: false,
      },
    });

    // Add media to the response
    const mtoWithMedia = {
      ...mto,
      media: media,
    };

    const logged = await withLogging(request, "materials_to_order", id, "UPDATE", `Materials to order updated successfully for project: ${mto.project.name}`);
    if (!logged) {
      return NextResponse.json(
        { status: false, message: "Failed to log materials to order update" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Materials to order updated successfully",
        data: mtoWithMedia,
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

    // Update lots to remove reference to this MTO
    await prisma.lot.updateMany({
      where: { materials_to_orders_id: id },
      data: { materials_to_orders_id: null },
    });

    // Mark media as deleted (soft delete)
    await prisma.media.updateMany({
      where: { materials_to_orderId: id },
      data: { is_deleted: true },
    });

    const mto = await prisma.materials_to_order.delete({
      where: { id },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Materials to order deleted successfully",
        data: mto,
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
