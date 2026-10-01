import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
import { sendNotification } from "@/lib/notification";
import { checkAndUpdateMTOStatus } from "@/lib/mtoStatusHelper";

// Errors thrown inside the transaction that should reach the client as a 400
function mtoEditError(message) {
  return Object.assign(new Error(message), { isClientError: true });
}

// Delete reservations and return their unused part to item stock. The used
// part was already consumed, so only quantity - used_quantity goes back.
async function releaseReservations(tx, reservationIds) {
  for (const reservationId of reservationIds) {
    const deleted = await tx.reserve_item_stock.delete({
      where: { id: reservationId },
    });

    const unusedQuantity = Math.max(
      deleted.quantity - (deleted.used_quantity || 0),
      0,
    );

    if (unusedQuantity > 0) {
      await tx.item.update({
        where: { item_id: deleted.item_id },
        data: { quantity: { increment: unusedQuantity } },
      });
    }
  }
}

// Diff the submitted items against the existing MTO items instead of
// delete-and-recreate, so reservations, quantity_used, quantity_ordered_po and
// purchase_order_item.mto_item_id links survive an edit. When locked, an
// unchanged item list is accepted (autosave) but any change is rejected.
async function syncMtoItems(tx, mtoId, items, { locked = false } = {}) {
  const existing = await tx.materials_to_order_item.findMany({
    where: { mto_id: mtoId },
    select: {
      id: true,
      item_id: true,
      quantity: true,
      notes: true,
      quantity_used: true,
      _count: { select: { ordered_items: true } },
    },
  });

  const unclaimed = new Map(existing.map((row) => [row.id, row]));
  const toUpdate = [];
  const toCreate = [];
  const withoutMatch = [];

  // Match by MTO item id first; a row whose item was swapped is treated as a
  // removal plus a new row
  for (const incoming of items) {
    const row = incoming.id ? unclaimed.get(incoming.id) : undefined;
    if (row && row.item_id === incoming.item_id) {
      unclaimed.delete(row.id);
      toUpdate.push({ row, incoming });
    } else {
      withoutMatch.push(incoming);
    }
  }

  // Rows sent without an id (e.g. added since the editor last loaded) fall
  // back to matching an unclaimed existing row for the same item
  for (const incoming of withoutMatch) {
    const row = [...unclaimed.values()].find(
      (r) => r.item_id === incoming.item_id,
    );
    if (row) {
      unclaimed.delete(row.id);
      toUpdate.push({ row, incoming });
    } else {
      toCreate.push(incoming);
    }
  }

  const removed = [...unclaimed.values()];
  const changedUpdates = toUpdate.filter(
    ({ row, incoming }) =>
      row.quantity !== incoming.quantity ||
      (row.notes ?? null) !== (incoming.notes ?? null),
  );

  if (!removed.length && !toCreate.length && !changedUpdates.length) {
    return;
  }

  if (locked) {
    throw mtoEditError(
      "Items cannot be edited after used material has been completed for this MTO.",
    );
  }

  for (const { row, incoming } of changedUpdates) {
    const used = row.quantity_used || 0;
    if (incoming.quantity < used) {
      throw mtoEditError(
        `Quantity for item ${row.item_id} cannot be less than the already used quantity (${used})`,
      );
    }
  }

  for (const row of removed) {
    if ((row.quantity_used || 0) > 0 || row._count.ordered_items > 0) {
      throw mtoEditError(
        `Item ${row.item_id} cannot be removed because it has already been used or added to a purchase order`,
      );
    }
  }

  if (removed.length > 0) {
    const removedIds = removed.map((row) => row.id);
    const reservations = await tx.reserve_item_stock.findMany({
      where: { mto_id: { in: removedIds } },
      select: { id: true },
    });
    await releaseReservations(
      tx,
      reservations.map((r) => r.id),
    );
    await tx.materials_to_order_item.deleteMany({
      where: { id: { in: removedIds } },
    });
  }

  for (const { row, incoming } of changedUpdates) {
    await tx.materials_to_order_item.update({
      where: { id: row.id },
      data: { quantity: incoming.quantity, notes: incoming.notes ?? null },
    });
  }

  if (toCreate.length > 0) {
    await tx.materials_to_order_item.createMany({
      data: toCreate.map((incoming) => ({
        mto_id: mtoId,
        item_id: incoming.item_id,
        quantity: incoming.quantity,
        notes: incoming.notes ?? null,
      })),
    });
  }
}

export async function GET(request, { params }) {
  try {
    const authError = await requireAuth(request, {
      modules: ["project_details"],
    });
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

    if (!mto || mto.is_deleted) {
      return NextResponse.json(
        { status: false, message: "Materials to order not found" },
        { status: 404 },
      );
    }

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
    console.error("Error in GET /api/v1/materials_to_order/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authError = await requireAuth(request, {
      modules: ["project_details", "usedmaterial"],
    });
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

    // Validate items; they are applied by diffing inside the transaction below
    let normalizedItems;
    if (items !== undefined) {
      const invalid =
        !Array.isArray(items) ||
        items.some(
          (item) =>
            !item?.item_id ||
            !Number.isInteger(Number(item.quantity)) ||
            Number(item.quantity) <= 0,
        );
      if (invalid) {
        return NextResponse.json(
          {
            status: false,
            message:
              "items must be an array of { item_id, quantity > 0 } entries",
          },
          { status: 400 },
        );
      }
      normalizedItems = items.map((item) => ({
        id: item.id,
        item_id: item.item_id,
        quantity: Number(item.quantity),
        notes: item.notes,
      }));
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
        select: { used_material_completed: true, is_deleted: true },
      });

      if (!prev || prev.is_deleted) {
        throw new Error("Materials to order not found");
      }

      // One-way process: once completed, it cannot be reverted
      if (used_material_completed === false) {
        throw new Error("USED_MATERIAL_COMPLETION_CANNOT_BE_REVERTED");
      }

      if (normalizedItems) {
        // Completion has already consumed the stock for every item
        await syncMtoItems(tx, id, normalizedItems, {
          locked: prev.used_material_completed,
        });
      }

      // Update MTO
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

    // Removing rows releases reservations, which can change order coverage
    if (normalizedItems && mto.items.length > 0) {
      const statusChanged = await checkAndUpdateMTOStatus(mto.items[0].id);
      if (statusChanged) {
        mto = await prisma.materials_to_order.findUnique({
          where: { id },
          include: includeMto,
        });
      }
    }

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

    if (error?.isClientError) {
      return NextResponse.json(
        { status: false, message: msg },
        { status: 400 },
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
    const authError = await requireAuth(request, {
      modules: ["project_details", "materialstoorder"],
    });
    if (authError) return authError;
    const { id } = await params;

    // Fetch MTO with project info before deletion for logging
    const mtoForLogging = await prisma.materials_to_order.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!mtoForLogging || mtoForLogging.is_deleted) {
      return NextResponse.json(
        { status: false, message: "Materials to order not found" },
        { status: 404 },
      );
    }

    // Soft delete: items, purchase order links and stock history are kept.
    // Reservations are released so their unused stock goes back to inventory.
    const mto = await prisma.$transaction(async (tx) => {
      const reservations = await tx.reserve_item_stock.findMany({
        where: { mto: { mto_id: id } },
        select: { id: true },
      });
      await releaseReservations(
        tx,
        reservations.map((r) => r.id),
      );

      // Update lots to remove reference to this MTO so they can get a new one
      await tx.lot.updateMany({
        where: { materials_to_orders_id: id },
        data: { materials_to_orders_id: null },
      });

      // Mark media as deleted (soft delete)
      await tx.media.updateMany({
        where: { materials_to_orderId: id },
        data: { is_deleted: true },
      });

      return tx.materials_to_order.update({
        where: { id },
        data: { is_deleted: true },
      });
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
    console.error("Error in DELETE /api/v1/materials_to_order/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
