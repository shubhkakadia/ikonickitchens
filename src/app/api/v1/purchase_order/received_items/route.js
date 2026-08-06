import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

/**
 * POST /api/purchase_order/received_items
 * Receive multiple items for a purchase order in a single transaction
 *
 * Request body:
 * {
 *   "purchase_order_id": "po_123",
 *   "items": [
 *     { "item_id": "item_1", "quantity": 10, "notes": "..." },
 *     { "item_id": "item_2", "quantity": 5, "notes": "..." }
 *   ]
 * }
 */
export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { purchase_order_id, items } = body;

    // Validate required fields
    if (!purchase_order_id) {
      return NextResponse.json(
        {
          status: false,
          message: "purchase_order_id is required",
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          status: false,
          message: "items array is required and must not be empty",
        },
        { status: 400 },
      );
    }

    // Validate each item in the array
    for (const item of items) {
      if (
        !item.item_id ||
        item.quantity === undefined ||
        item.quantity === null
      ) {
        return NextResponse.json(
          {
            status: false,
            message: "Each item must have item_id and quantity",
          },
          { status: 400 },
        );
      }

      if (item.quantity < 0) {
        return NextResponse.json(
          {
            status: false,
            message: `Quantity must be non-negative for item ${item.item_id}`,
          },
          { status: 400 },
        );
      }
    }

    // Process all items in a single transaction
    let finalPO;
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Lock purchase order row early to prevent concurrent modifications
        await tx.$executeRaw`
          SELECT id FROM purchase_order
          WHERE id = ${purchase_order_id}
          FOR UPDATE
        `;

        // 2. Verify purchase order exists and fetch all items
        const purchaseOrder = await tx.purchase_order.findUnique({
          where: { id: purchase_order_id },
          include: {
            items: true,
          },
        });

        if (!purchaseOrder) {
          throw new Error(`PURCHASE_ORDER_NOT_FOUND:${purchase_order_id}`);
        }

        // 2. Validate all PO items exist and collect PO item data
        const poItemsMap = new Map();
        for (const poItem of purchaseOrder.items) {
          poItemsMap.set(poItem.item_id, poItem);
        }

        for (const item of items) {
          const poItem = poItemsMap.get(item.item_id);
          if (!poItem) {
            throw new Error(
              `PO_ITEM_NOT_FOUND:${item.item_id}:${purchase_order_id}`,
            );
          }

          // Verify the item exists in inventory
          const inventoryItem = await tx.item.findUnique({
            where: { item_id: item.item_id },
            select: { item_id: true },
          });

          if (!inventoryItem) {
            throw new Error(`INVENTORY_ITEM_NOT_FOUND:${item.item_id}`);
          }

          // Prevent over-receiving (business rule)
          const currentReceived = poItem.quantity_received || 0;
          const newTotalReceived = currentReceived + item.quantity;
          if (newTotalReceived > poItem.quantity) {
            throw new Error(
              `OVER_RECEIVE:${item.item_id}:${poItem.quantity}:${currentReceived}:${item.quantity}`,
            );
          }
        }

        // 3. Update all purchase_order_item.quantity_received (atomic increment)
        for (const item of items) {
          const poItem = poItemsMap.get(item.item_id);

          await tx.purchase_order_item.update({
            where: { id: poItem.id },
            data: {
              quantity_received: {
                increment: item.quantity,
              },
            },
          });
        }

        // 4. Update all item.quantity (inventory) - increment stock
        for (const item of items) {
          await tx.item.update({
            where: { item_id: item.item_id },
            data: {
              quantity: {
                increment: item.quantity,
              },
            },
          });
        }

        // 5. Create stock_transaction rows (one per item)
        for (const item of items) {
          await tx.stock_transaction.create({
            data: {
              item_id: item.item_id,
              quantity: item.quantity,
              type: "ADDED",
              purchase_order_id: purchase_order_id,
              notes: item.notes || `Received from PO ${purchase_order_id}`,
            },
          });
        }

        // 6. Recalculate PO status ONCE
        // Fetch updated PO items to check if all are received
        const updatedPOItems = await tx.purchase_order_item.findMany({
          where: { order_id: purchase_order_id },
        });

        const allItemsReceived = updatedPOItems.every(
          (item) => (item.quantity_received || 0) >= item.quantity,
        );
        const someItemsReceived = updatedPOItems.some(
          (item) => (item.quantity_received || 0) > 0,
        );

        let newStatus = purchaseOrder.status;
        if (allItemsReceived && purchaseOrder.status !== "CANCELLED") {
          newStatus = "FULLY_RECEIVED";
        } else if (
          someItemsReceived &&
          !allItemsReceived &&
          purchaseOrder.status !== "CANCELLED"
        ) {
          newStatus = "PARTIALLY_RECEIVED";
        }

        // Update PO status if needed
        if (newStatus !== purchaseOrder.status) {
          await tx.purchase_order.update({
            where: { id: purchase_order_id },
            data: { status: newStatus },
          });
        }

        // 7. Commit happens automatically when transaction completes
      });

      // Fetch final PO data with all relations after transaction commits
      finalPO = await prisma.purchase_order.findUnique({
        where: { id: purchase_order_id },
        include: {
          supplier: true,
          items: {
            include: {
              item: {
                include: {
                  sheet: true,
                  handle: true,
                  hardware: true,
                  accessory: true,
                  edging_tape: true,
                },
              },
            },
          },
          orderedBy: {
            select: {
              employee: {
                select: {
                  employee_id: true,
                  first_name: true,
                  last_name: true,
                },
              },
            },
          },
          invoice_url: true,
          mto: {
            select: {
              project: { select: { project_id: true, name: true } },
              status: true,
            },
          },
        },
      });
    } catch (err) {
      const msg = err?.message || "";

      if (msg.startsWith("PURCHASE_ORDER_NOT_FOUND:")) {
        const [, po_id] = msg.split(":");
        return NextResponse.json(
          {
            status: false,
            message: `Purchase order not found: ${po_id}`,
          },
          { status: 404 },
        );
      }

      if (msg.startsWith("PO_ITEM_NOT_FOUND:")) {
        const [, item_id, po_id] = msg.split(":");
        return NextResponse.json(
          {
            status: false,
            message: `Item ${item_id} not found in purchase order ${po_id}`,
          },
          { status: 404 },
        );
      }

      if (msg.startsWith("INVENTORY_ITEM_NOT_FOUND:")) {
        const [, item_id] = msg.split(":");
        return NextResponse.json(
          {
            status: false,
            message: `Inventory item not found: ${item_id}`,
          },
          { status: 404 },
        );
      }

      if (msg.startsWith("OVER_RECEIVE:")) {
        const [, item_id, ordered_qty, current_received, requested_qty] =
          msg.split(":");
        return NextResponse.json(
          {
            status: false,
            message: `Cannot receive more than ordered quantity for item ${item_id}. Ordered: ${ordered_qty}, Already received: ${current_received}, Requested: ${requested_qty}, Remaining: ${ordered_qty - current_received}`,
          },
          { status: 400 },
        );
      }

      console.error("Error in transaction:", err);
      return NextResponse.json(
        {
          status: false,
          message: "Failed to process received items",
          error: err?.message,
        },
        { status: 500 },
      );
    }

    // Log the operation
    let logged = true;
    if (finalPO?.id) {
      logged = await withLogging(
        request,
        "purchase_order",
        finalPO.id,
        "UPDATE",
        `Received ${items.length} item(s) for PO: ${purchase_order_id}`,
      );

      if (!logged) {
        console.error(`Failed to log PO items receipt: ${purchase_order_id}`);
      }
    }

    return NextResponse.json(
      {
        status: true,
        message: `Successfully received ${items.length} item(s)`,
        ...(logged
          ? {}
          : { warning: "Note: Operation succeeded but logging failed" }),
        data: finalPO,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in POST /api/purchase_order/received_items:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
