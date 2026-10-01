import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
import { sendNotification } from "@/lib/notification";
import { TransactionError } from "@/lib/transactionError";
import {
  fetchReceivedPurchaseOrder,
  normalizeReceiveItems,
  receivePurchaseOrderItems,
} from "@/lib/receivePurchaseOrder";

/**
 * Handle USED transaction (from Materials To Order)
 * Updates materials_to_order_item's quantity_used
 * Decreases item inventory quantity
 * Creates stock_transaction with type USED
 */
async function handleUsedTransaction(data) {
  const { item_id, materials_to_order_id, notes } = data;

  // quantity_used and the ledger quantity are integer columns
  const quantity = Number(data.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return {
      status: false,
      message: "quantity must be a positive whole number",
      statusCode: 400,
    };
  }

  // Find the materials_to_order_item by mto_id and item_id
  const mtoItem = await prisma.materials_to_order_item.findFirst({
    where: {
      mto_id: materials_to_order_id,
      item_id: item_id,
    },
    include: {
      mto: true,
      item: true,
    },
  });

  if (!mtoItem || mtoItem.mto?.is_deleted) {
    return {
      status: false,
      message: "Materials to order item not found",
      statusCode: 404,
    };
  }

  // Verify item exists
  const itemExists = await prisma.item.findUnique({
    where: { item_id: item_id },
    select: { item_id: true },
  });

  if (!itemExists) {
    return {
      status: false,
      message: "Item not found",
      statusCode: 404,
    };
  }

  // Wrap all database writes in a transaction to ensure atomicity
  let updatedMtoItem;
  try {
    await prisma.$transaction(async (tx) => {
      // Serialise everything that touches this MTO line (usage, reservations)
      // so the checks below can't go stale before we write.
      await tx.$queryRaw`
        SELECT id FROM materials_to_order_item
        WHERE id = ${mtoItem.id}
        FOR UPDATE
      `;

      const line = await tx.materials_to_order_item.findUnique({
        where: { id: mtoItem.id },
        select: { quantity: true, quantity_used: true },
      });
      if (!line) {
        throw new TransactionError("Materials to order item not found", 404);
      }
      const currentUsed = line.quantity_used || 0;
      const totalQuantity = line.quantity || 0;

      // Prevent quantity_used from exceeding total required quantity
      if (currentUsed + quantity > totalQuantity) {
        throw new TransactionError(
          `Used quantity cannot exceed total quantity. Total: ${totalQuantity}, Current used: ${currentUsed}, Requested: ${quantity}`,
          400,
        );
      }

      // Claim the usage atomically: the write only applies while there is
      // still room, and increments rather than overwriting.
      const claimed = await tx.materials_to_order_item.updateMany({
        where: {
          id: mtoItem.id,
          quantity_used: { lte: totalQuantity - quantity },
        },
        data: { quantity_used: { increment: quantity } },
      });
      if (claimed.count === 0) {
        throw new TransactionError(
          "Used quantity was changed by someone else. Reload and try again.",
          409,
        );
      }

      let remainingQuantity = quantity;

      // Check if there are any reservations for this item from this specific MTO
      const reservations = await tx.reserve_item_stock.findMany({
        where: {
          item_id: item_id,
          mto_id: mtoItem.id, // Only get reservations for this specific MTO item
        },
        orderBy: {
          createdAt: "asc", // Use oldest reservations first (FIFO)
        },
      });

      // Use from reservations first - consume entire reservation and delete it
      for (const reservation of reservations) {
        if (remainingQuantity <= 0) break;

        // Calculate available quantity in this reservation (total - already used)
        const availableInReservation =
          reservation.quantity - reservation.used_quantity;

        if (availableInReservation <= 0) {
          // This reservation is already fully consumed, delete it
          await tx.reserve_item_stock.delete({
            where: { id: reservation.id },
          });
          continue;
        }

        // Use as much as we can from this reservation
        const quantityToUseFromReservation = Math.min(
          availableInReservation,
          remainingQuantity,
        );

        // If we're using all the available quantity, delete the reservation
        // Otherwise, update the used_quantity
        if (quantityToUseFromReservation >= availableInReservation) {
          // Fully consumed - delete the reservation entry
          await tx.reserve_item_stock.delete({
            where: { id: reservation.id },
          });
        } else {
          // Partially consumed - update used_quantity
          await tx.reserve_item_stock.update({
            where: { id: reservation.id },
            data: {
              used_quantity: {
                increment: quantityToUseFromReservation,
              },
            },
          });
        }

        remainingQuantity -= quantityToUseFromReservation;
      }

      // If still need more quantity, use from regular stock
      if (remainingQuantity > 0) {
        const dec = await tx.item.updateMany({
          where: {
            item_id: item_id,
            quantity: { gte: remainingQuantity },
          },
          data: {
            quantity: { decrement: remainingQuantity },
          },
        });

        if (dec.count === 0) {
          const current = await tx.item.findUnique({
            where: { item_id: item_id },
            select: { quantity: true },
          });
          const available = current?.quantity ?? 0;
          throw new TransactionError(
            `Not enough quantity in inventory. Available: ${available}, Requested: ${remainingQuantity}`,
            400,
          );
        }
      }

      // Re-read the line (quantity_used was incremented above) for the response
      updatedMtoItem = await tx.materials_to_order_item.findUnique({
        where: { id: mtoItem.id },
        include: {
          item: true,
          mto: true,
        },
      });

      // Create stock transaction
      await tx.stock_transaction.create({
        data: {
          item_id: item_id,
          quantity: quantity,
          type: "USED",
          materials_to_order_id: materials_to_order_id,
          notes: notes || `Used from MTO ${materials_to_order_id}`,
        },
      });

      // If all items are fully used, mark MTO as completed for used material
      if (materials_to_order_id) {
        const updatedMto = await tx.materials_to_order.findUnique({
          where: { id: materials_to_order_id },
          select: {
            id: true,
            used_material_completed: true,
            items: {
              select: {
                quantity: true,
                quantity_used: true,
              },
            },
          },
        });

        if (updatedMto) {
          const allItemsUsed = (updatedMto.items || []).every(
            (it) => (it.quantity_used || 0) >= it.quantity,
          );

          if (allItemsUsed && !updatedMto.used_material_completed) {
            await tx.materials_to_order.update({
              where: { id: materials_to_order_id },
              data: { used_material_completed: true },
            });
          }
        }
      }
    });
  } catch (err) {
    if (err instanceof TransactionError) {
      return { status: false, message: err.message, statusCode: err.status };
    }
    console.error("Error in handleUsedTransaction:", err);
    return {
      status: false,
      message: "Internal server error",
      statusCode: 500,
    };
  }

  return {
    status: true,
    message: "Quantity used updated successfully",
    data: updatedMtoItem,
    statusCode: 200,
  };
}

/**
 * Handle ADDED transaction (from Purchase Order)
 * Goes through the same locked logic as POST /purchase_order/received_items:
 * the PO must be ORDERED or PARTIALLY_RECEIVED, the line can't be received
 * past its ordered quantity, and quantity_received is claimed under a lock.
 * Increases item inventory quantity and creates a stock_transaction (ADDED)
 */
async function handleAddedTransaction(data) {
  const { item_id, quantity, purchase_order_id, notes } = data;

  const normalized = normalizeReceiveItems([{ item_id, quantity, notes }]);
  if (normalized.error) {
    return { status: false, message: normalized.error, statusCode: 400 };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await receivePurchaseOrderItems(tx, {
        purchase_order_id,
        items: normalized.items,
      });
    });
  } catch (err) {
    if (err instanceof TransactionError) {
      return { status: false, message: err.message, statusCode: err.status };
    }
    throw err;
  }

  // Fetch updated PO with all relations for return (after transaction commits)
  const finalPO = await fetchReceivedPurchaseOrder(purchase_order_id);

  return {
    status: true,
    message: "Quantity received updated successfully",
    data: finalPO,
    statusCode: 200,
  };
}

/**
 * Handle manual USED transaction (without MTO)
 * Decreases item inventory quantity
 * Creates stock_transaction with type USED
 */
async function handleManualUsedTransaction(data) {
  const { item_id, quantity, notes, project_id, lot_id } = data;

  // Verify item exists
  const itemExists = await prisma.item.findUnique({
    where: { item_id: item_id },
    select: { item_id: true, quantity: true },
  });

  if (!itemExists) {
    return {
      status: false,
      message: "Item not found",
      statusCode: 404,
    };
  }

  // Check if sufficient quantity is available
  if (itemExists.quantity < quantity) {
    return {
      status: false,
      message: `Insufficient quantity. Available: ${itemExists.quantity}, Requested: ${quantity}`,
      statusCode: 400,
    };
  }

  // Wrap all database writes in a transaction to ensure atomicity
  let stockTransaction;
  try {
    await prisma.$transaction(async (tx) => {
      // Manual transactions don't have MTO context, so we can't use reservations
      // Just use from regular stock directly
      const dec = await tx.item.updateMany({
        where: {
          item_id: item_id,
          quantity: { gte: quantity },
        },
        data: {
          quantity: { decrement: quantity },
        },
      });

      if (dec.count === 0) {
        const current = await tx.item.findUnique({
          where: { item_id: item_id },
          select: { quantity: true },
        });
        const available = current?.quantity ?? 0;
        throw new Error(
          `INSUFFICIENT_INVENTORY:${item_id}:${quantity}:${available}`,
        );
      }

      stockTransaction = await tx.stock_transaction.create({
        data: {
          item_id: item_id,
          quantity: quantity,
          type: "USED",
          notes: notes || `Manually recorded used quantity`,
          project_id: project_id || null,
          lot_id: lot_id || null,
        },
      });
    });
  } catch (err) {
    const msg = err?.message || "";
    if (msg.startsWith("INSUFFICIENT_INVENTORY:")) {
      const [, failedItemId, requested, available] = msg.split(":");
      return {
        status: false,
        message: `Not enough quantity in inventory for item ${failedItemId}. Available: ${available}, Requested: ${requested}`,
        statusCode: 400,
      };
    }
    console.error("Error in handleManualUsedTransaction:", err);
    return {
      status: false,
      message: "Internal server error",
      statusCode: 500,
    };
  }

  return {
    status: true,
    message: "Material used recorded successfully",
    data: stockTransaction,
    statusCode: 200,
  };
}

/**
 * Handle WASTED transaction
 * Only creates stock_transaction
 * Decreases item inventory quantity
 */
async function handleWastedTransaction(data) {
  const { item_id, quantity, notes } = data;

  // Verify item exists
  const itemExists = await prisma.item.findUnique({
    where: { item_id: item_id },
    select: { item_id: true },
  });

  if (!itemExists) {
    return {
      status: false,
      message: "Item not found",
      statusCode: 404,
    };
  }

  // Wrap all database writes in a transaction to ensure atomicity
  try {
    await prisma.$transaction(async (tx) => {
      // Wasted transactions don't have MTO context, so we can't use reservations
      // Just use from regular stock directly
      const dec = await tx.item.updateMany({
        where: {
          item_id: item_id,
          quantity: { gte: quantity },
        },
        data: {
          quantity: { decrement: quantity },
        },
      });

      if (dec.count === 0) {
        const current = await tx.item.findUnique({
          where: { item_id: item_id },
          select: { quantity: true },
        });
        const available = current?.quantity ?? 0;
        throw new Error(
          `INSUFFICIENT_INVENTORY:${item_id}:${quantity}:${available}`,
        );
      }

      await tx.stock_transaction.create({
        data: {
          item_id: item_id,
          quantity: quantity,
          type: "WASTED",
          notes: notes || `Wasted item quantity`,
        },
      });
    });
  } catch (err) {
    const msg = err?.message || "";
    if (msg.startsWith("INSUFFICIENT_INVENTORY:")) {
      const [, failedItemId, requested, available] = msg.split(":");
      return {
        status: false,
        message: `Not enough quantity in inventory for item ${failedItemId}. Available: ${available}, Requested: ${requested}`,
        statusCode: 400,
      };
    }
    console.error("Error in handleWastedTransaction:", err);
    return {
      status: false,
      message: "Internal server error",
      statusCode: 500,
    };
  }

  // Fetch updated item for return (after transaction commits)
  const updatedItem = await prisma.item.findUnique({
    where: { item_id: item_id },
    include: {
      sheet: true,
      handle: true,
      hardware: true,
      accessory: true,
      edging_tape: true,
    },
  });

  return {
    status: true,
    message: "Wasted quantity recorded successfully",
    data: updatedItem,
    statusCode: 200,
  };
}

/**
 * Main POST handler
 * Routes to appropriate function based on type (ADDED, USED, or WASTED)
 */
export async function POST(request) {
  try {
    const authError = await requireAuth(request, { modules: ["usedmaterial"] });
    if (authError) return authError;

    const body = await request.json();
    const {
      item_id,
      quantity,
      type,
      notes,
      purchase_order_id,
      materials_to_order_id,
      project_id,
      lot_id,
    } = body;

    // Validate required fields
    if (!item_id || quantity === undefined || quantity === null || !type) {
      return NextResponse.json(
        {
          status: false,
          message: "item_id, quantity, and type are required",
        },
        { status: 400 },
      );
    }

    if (quantity < 0) {
      return NextResponse.json(
        {
          status: false,
          message: "quantity must be non-negative",
        },
        { status: 400 },
      );
    }

    // Route to appropriate handler based on type
    let result;
    if (type === "USED") {
      // If materials_to_order_id is provided, use MTO handler
      // Otherwise, use manual handler
      if (materials_to_order_id) {
        result = await handleUsedTransaction({
          item_id,
          quantity,
          materials_to_order_id,
          notes,
        });
      } else {
        result = await handleManualUsedTransaction({
          item_id,
          quantity,
          notes,
          project_id,
          lot_id,
        });
      }
    } else if (type === "ADDED") {
      if (!purchase_order_id) {
        return NextResponse.json(
          {
            status: false,
            message: "purchase_order_id is required for ADDED transactions",
          },
          { status: 400 },
        );
      }
      result = await handleAddedTransaction({
        item_id,
        quantity,
        purchase_order_id,
        notes,
      });
    } else if (type === "WASTED") {
      result = await handleWastedTransaction({
        item_id,
        quantity,
        notes,
      });
    } else {
      return NextResponse.json(
        {
          status: false,
          message: "type must be either 'ADDED', 'USED', or 'WASTED'",
        },
        { status: 400 },
      );
    }

    // If handler failed, don't attempt logging (result.data may be undefined)
    if (!result?.status) {
      return NextResponse.json(
        {
          status: false,
          message: result?.message || "Request failed",
          data: result?.data,
        },
        { status: result?.statusCode || 400 },
      );
    }

    const logEntityId = result?.data?.id;
    let logged = true;
    if (logEntityId) {
      logged = await withLogging(
        request,
        "stock_transaction",
        logEntityId,
        "CREATE",
        `Stock transaction created successfully: ${type} for item: ${item_id}`,
      );

      if (!logged) {
        console.error(
          `Failed to log stock transaction creation: ${logEntityId}`,
        );
      }
    }

    // Send notification for stock transaction creation
    try {
      // Fetch item details for notification
      const item = await prisma.item.findUnique({
        where: { item_id: item_id },
        include: {
          sheet: true,
          handle: true,
          hardware: true,
          accessory: true,
          edging_tape: true,
        },
      });

      // Build item name with brand, color, finish
      let itemName = "Unknown Item";
      let dimensions = "N/A";

      if (item) {
        const parts = [];
        if (item.sheet) parts.push(`Brand: ${item.sheet.brand || "N/A"}`);
        if (item.sheet?.color) parts.push(`Color: ${item.sheet.color}`);
        if (item.sheet?.finish) parts.push(`Finish: ${item.sheet.finish}`);
        if (item.sheet?.dimensions) dimensions = item.sheet.dimensions;
        // handle
        if (item.handle) parts.push(`Handle: ${item.handle.brand || "N/A"}`);
        if (item.handle?.color) parts.push(`Color: ${item.handle.color}`);
        if (item.handle?.type) parts.push(`Type: ${item.handle.type}`);
        if (item.handle?.material)
          parts.push(`Material: ${item.handle.material}`);
        if (item.handle?.dimensions) dimensions = item.handle.dimensions;
        // hardware
        if (item.hardware)
          parts.push(`Hardware: ${item.hardware.brand || "N/A"}`);
        if (item.hardware?.name) parts.push(`Name: ${item.hardware.name}`);
        if (item.hardware?.type) parts.push(`Type: ${item.hardware.type}`);
        if (item.hardware?.dimensions) dimensions = item.hardware.dimensions;
        // accessory
        if (item.accessory)
          parts.push(`Accessory: ${item.accessory.name || "N/A"}`);
        // edging_tape
        if (item.edging_tape)
          parts.push(`Edging Tape: ${item.edging_tape.brand || "N/A"}`);
        if (item.edging_tape?.color)
          parts.push(`Color: ${item.edging_tape.color}`);
        if (item.edging_tape?.finish)
          parts.push(`Finish: ${item.edging_tape.finish}`);
        if (item.edging_tape?.dimensions)
          dimensions = item.edging_tape.dimensions;
        itemName = parts.length > 0 ? parts.join(", ") : item.item_id;
      }

      await sendNotification(
        {
          type: "stock_transaction",
          item_id: item_id,
          quantity: quantity,
          transaction_type: type, // ADDED, USED, or WASTED
          item_name: itemName,
          dimensions: dimensions,
        },
        "stock_transaction_created",
      );
    } catch (notificationError) {
      console.error(
        "Failed to send stock transaction notification:",
        notificationError,
      );
      // Don't fail the request if notification fails
    }

    return NextResponse.json(
      {
        status: result.status,
        message: result.message,
        ...(logged
          ? {}
          : { warning: "Note: Creation succeeded but logging failed" }),
        data: result.data,
      },
      { status: result.statusCode },
    );
  } catch (error) {
    console.error("Error in POST /api/v1/stock_transaction/create:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
