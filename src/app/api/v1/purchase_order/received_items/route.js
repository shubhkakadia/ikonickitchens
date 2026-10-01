import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
import { TransactionError } from "@/lib/transactionError";
import {
  fetchReceivedPurchaseOrder,
  normalizeReceiveItems,
  receivePurchaseOrderItems,
} from "@/lib/receivePurchaseOrder";

/**
 * POST /api/v1/purchase_order/received_items
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
 *
 * Entries for the same item_id are added together before the over-receive
 * check. The PO must be ORDERED or PARTIALLY_RECEIVED.
 */
export async function POST(request) {
  try {
    const authError = await requireAuth(request, {
      modules: ["purchaseorder"],
    });
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
    }

    const normalized = normalizeReceiveItems(items);
    if (normalized.error) {
      return NextResponse.json(
        { status: false, message: normalized.error },
        { status: 400 },
      );
    }

    // Process all items in a single transaction
    let finalPO;
    try {
      await prisma.$transaction(async (tx) => {
        await receivePurchaseOrderItems(tx, {
          purchase_order_id,
          items: normalized.items,
        });
      });

      // Fetch final PO data with all relations after transaction commits
      finalPO = await fetchReceivedPurchaseOrder(purchase_order_id);
    } catch (err) {
      if (err instanceof TransactionError) {
        return NextResponse.json(
          { status: false, message: err.message },
          { status: err.status },
        );
      }

      console.error("Error in transaction:", err);
      return NextResponse.json(
        {
          status: false,
          message: "Failed to process received items",
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
    console.error(
      "Error in POST /api/v1/purchase_order/received_items:",
      error,
    );
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
