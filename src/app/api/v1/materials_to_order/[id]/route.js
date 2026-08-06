import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
import { sendNotification } from "@/lib/notification";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
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
                itemSuppliers: {
                  include: {
                    supplier: true,
                  },
                },
              },
            },
            reserve_item_stock: true,
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
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/materials_to_order/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const data = await request.json();
    const { status, notes, items, used_material_completed } = data;

    // Build the update data object
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (used_material_completed !== undefined) {
      updateData.used_material_completed = used_material_completed;
    }

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

    const includeMto = {
      lots: {
        include: {
          project: {
            include: {
              client: {
                select: {
                  client_name: true,
                },
              },
            },
          },
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
              itemSuppliers: {
                include: {
                  supplier: true,
                },
              },
            },
          },
        },
      },
      project: {
        include: {
          client: {
            select: {
              client_name: true,
            },
          },
          lots: true,
        },
      },
    };

    let mto;
    await prisma.$transaction(async (tx) => {
      const prev = await tx.materials_to_order.findUnique({
        where: { id },
        select: { used_material_completed: true },
      });

      if (!prev) {
        throw new Error("Materials to order not found");
      }

      // One-way process: once completed, it cannot be reverted
      if (used_material_completed === false) {
        throw new Error("USED_MATERIAL_COMPLETION_CANNOT_BE_REVERTED");
      }

      // Update MTO (including optional items update)
      mto = await tx.materials_to_order.update({
        where: { id },
        data: updateData,
        include: includeMto,
      });

      const turningCompleted =
        used_material_completed === true && !prev.used_material_completed;

      // When marking completed, create USED stock transactions for remaining qty
      if (turningCompleted) {
        const mtoItems = await tx.materials_to_order_item.findMany({
          where: { mto_id: id },
          select: {
            id: true,
            item_id: true,
            quantity: true,
            quantity_used: true,
          },
        });

        for (const it of mtoItems) {
          const used = it.quantity_used || 0;
          const total = it.quantity || 0;
          const remaining = total - used;
          if (remaining <= 0) continue;

          // Decrement inventory for remaining qty (guard against negative)
          const dec = await tx.item.updateMany({
            where: {
              item_id: it.item_id,
              quantity: { gte: remaining },
            },
            data: { quantity: { decrement: remaining } },
          });

          if (dec.count === 0) {
            const current = await tx.item.findUnique({
              where: { item_id: it.item_id },
              select: { quantity: true },
            });
            const available = current?.quantity ?? 0;
            throw new Error(
              `INSUFFICIENT_INVENTORY:${it.item_id}:${remaining}:${available}`,
            );
          }

          // Mark item fully used
          await tx.materials_to_order_item.update({
            where: { id: it.id },
            data: { quantity_used: total },
          });

          // Create USED stock transaction for remaining qty
          await tx.stock_transaction.create({
            data: {
              item_id: it.item_id,
              quantity: remaining,
              type: "USED",
              materials_to_order_id: id,
              notes: `Auto USED on marking MTO completed (${id})`,
            },
          });
        }

        // Re-fetch MTO so response shows updated quantity_used values
        mto = await tx.materials_to_order.findUnique({
          where: { id },
          include: includeMto,
        });
      }
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

    const projectName = mto.project?.name || "Unknown";
    const logged = await withLogging(
      request,
      "materials_to_order",
      id,
      "UPDATE",
      `Materials to order updated successfully for project: ${projectName}`,
    );

    // Send notification for MTO update (only if items or status changed)
    if (data.items !== undefined || data.status !== undefined) {
      try {
        // Get lot names
        const lotNames =
          mto.lots && mto.lots.length > 0
            ? mto.lots.length === 1
              ? mto.lots[0].lot_id
              : mto.lots.map((l) => l.lot_id).join(", ")
            : "Unknown Lot";

        await sendNotification(
          {
            type: "material_to_order",
            materials_to_order_id: id,
            project_id: mto.project_id,
            project_name: mto.project?.name || "Unknown Project",
            client_name: mto.project?.client?.name || "Unknown Client",
            lot_name: lotNames,
            is_new: false,
          },
          "materials_to_order_list_update",
        );
      } catch (notificationError) {
        console.error(
          "Failed to send MTO update notification:",
          notificationError,
        );
        // Don't fail the request if notification fails
      }
    }

    if (!logged) {
      console.error(`Failed to log materials to order update: ${id}`);
    }
    return NextResponse.json(
      {
        status: true,
        message: "Materials to order updated successfully",
        data: mtoWithMedia,
        ...(logged
          ? {}
          : { warning: "Note: Update succeeded but logging failed" }),
      },
      { status: 200 },
    );
  } catch (error) {
    const msg = error?.message || "";
    if (msg.startsWith("INSUFFICIENT_INVENTORY:")) {
      const [, , requested, available] = msg.split(":");
      return NextResponse.json(
        {
          status: false,
          message: `Not enough quantity in inventory. Available: ${available}, Requested: ${requested}`,
        },
        { status: 400 },
      );
    }

    if (msg === "USED_MATERIAL_COMPLETION_CANNOT_BE_REVERTED") {
      return NextResponse.json(
        {
          status: false,
          message:
            "This MTO is already completed for used material and cannot be moved back to active.",
        },
        { status: 400 },
      );
    }

    if (msg === "Materials to order not found") {
      return NextResponse.json(
        { status: false, message: msg },
        { status: 404 },
      );
    }

    console.error("Error in PATCH /api/materials_to_order/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;

    // Fetch MTO with project info before deletion for logging
    const mtoForLogging = await prisma.materials_to_order.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

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

    const logged = await withLogging(
      request,
      "materials_to_order",
      id,
      "DELETE",
      `Materials to order deleted successfully for project: ${mtoForLogging?.project?.name || "Unknown"}`,
    );
    if (!logged) {
      console.error(`Failed to log materials to order deletion: ${id}`);
    }

    return NextResponse.json(
      {
        status: true,
        message: "Materials to order deleted successfully",
        data: mto,
        ...(logged
          ? {}
          : { warning: "Note: Deletion succeeded but logging failed" }),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in DELETE /api/materials_to_order/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
