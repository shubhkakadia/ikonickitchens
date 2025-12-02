import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../lib/withLogging";

/**
 * Stock Tally API
 * Handles bulk stock quantity updates from stock tally Excel import
 * Creates stock_transaction records for each change
 */
export async function POST(request) {
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

    const body = await request.json();
    const { items } = body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          status: false,
          message: "items array is required and must not be empty",
        },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of items) {
      if (!item.item_id) {
        return NextResponse.json(
          {
            status: false,
            message: "Each item must have an item_id",
          },
          { status: 400 }
        );
      }
      if (item.new_quantity === undefined || item.new_quantity === null) {
        return NextResponse.json(
          {
            status: false,
            message: "Each item must have a new_quantity",
          },
          { status: 400 }
        );
      }
      if (item.new_quantity < 0) {
        return NextResponse.json(
          {
            status: false,
            message: "new_quantity must be non-negative",
          },
          { status: 400 }
        );
      }
    }

    const results = [];
    const errors = [];

    // Process each item
    for (const itemData of items) {
      const { item_id, new_quantity, current_quantity } = itemData;

      try {
        // Get current item
        const currentItem = await prisma.item.findUnique({
          where: { item_id: item_id },
          select: { quantity: true, supplier_reference: true },
        });

        if (!currentItem) {
          errors.push({
            item_id,
            error: "Item not found",
          });
          continue;
        }

        const oldQuantity = current_quantity ?? currentItem.quantity ?? 0;
        const newQty = Math.floor(parseFloat(new_quantity));
        const difference = newQty - oldQuantity;

        // Skip if no change
        if (difference === 0) {
          continue;
        }

        // Determine transaction type
        const transactionType = difference > 0 ? "ADDED" : "WASTED";
        const quantityChange = Math.abs(difference);

        // Update item quantity and create stock transaction
        await Promise.all([
          prisma.item.update({
            where: { item_id: item_id },
            data: {
              quantity: newQty,
            },
          }),
          prisma.stock_transaction.create({
            data: {
              item_id: item_id,
              quantity: quantityChange,
              type: transactionType,
              notes: `Stock tally adjustment: ${oldQuantity} → ${newQty}`,
            },
          }),
        ]);

        results.push({
          item_id,
          supplier_reference: currentItem.supplier_reference,
          old_quantity: oldQuantity,
          new_quantity: newQty,
          difference: difference,
          type: transactionType,
        });
      } catch (itemError) {
        console.error(`Error processing item ${item_id}:`, itemError);
        errors.push({
          item_id,
          error: itemError.message,
        });
      }
    }

    // Log the stock tally operation
    await withLogging(
      request,
      "stock_tally",
      null,
      "CREATE",
      `Stock tally completed: ${results.length} items updated, ${errors.length} errors`
    );

    return NextResponse.json(
      {
        status: true,
        message: `Stock tally completed: ${results.length} items updated`,
        data: {
          updated: results,
          errors: errors,
          summary: {
            total_items: items.length,
            updated_count: results.length,
            error_count: errors.length,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Stock tally error:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

