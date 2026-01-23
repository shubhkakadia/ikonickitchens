import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

/**
 * Stock Tally API
 * Handles bulk stock quantity updates from stock tally Excel import
 * Creates stock_transaction records for each change
 */
export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { items } = body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          status: false,
          message: "items array is required and must not be empty",
        },
        { status: 400 },
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
          { status: 400 },
        );
      }
      if (item.new_quantity === undefined || item.new_quantity === null) {
        return NextResponse.json(
          {
            status: false,
            message: "Each item must have a new_quantity",
          },
          { status: 400 },
        );
      }
      if (item.new_quantity < 0) {
        return NextResponse.json(
          {
            status: false,
            message: "new_quantity must be non-negative",
          },
          { status: 400 },
        );
      }
    }

    const results = [];
    const errors = [];

    // Process each item
    for (const itemData of items) {
      const { item_id, new_quantity, current_quantity } = itemData;

      try {
        // Use transaction to ensure atomicity - read and write must happen atomically
        // This prevents race conditions where another transaction modifies the item
        // between our read and write operations
        const result = await prisma.$transaction(async (tx) => {
          // Get current item within transaction to lock it
          const currentItem = await tx.item.findUnique({
            where: { item_id: item_id },
            select: { quantity: true, supplier_reference: true },
          });

          if (!currentItem) {
            return { error: "Item not found" };
          }

          const oldQuantity = current_quantity ?? currentItem.quantity ?? 0;
          const newQty = Math.floor(parseFloat(new_quantity));
          const difference = newQty - oldQuantity;

          // Skip if no change
          if (difference === 0) {
            return { skipped: true };
          }

          // Determine transaction type
          const transactionType = difference > 0 ? "ADDED" : "WASTED";
          const quantityChange = Math.abs(difference);

          // Update item quantity and create stock transaction atomically
          await Promise.all([
            tx.item.update({
              where: { item_id: item_id },
              data: {
                quantity: newQty,
              },
            }),
            tx.stock_transaction.create({
              data: {
                item_id: item_id,
                quantity: quantityChange,
                type: transactionType,
                notes: `Stock tally adjustment: ${oldQuantity} → ${newQty}`,
              },
            }),
          ]);

          return {
            item_id,
            supplier_reference: currentItem.supplier_reference,
            old_quantity: oldQuantity,
            new_quantity: newQty,
            difference: difference,
            type: transactionType,
          };
        });

        // Handle transaction result
        if (result.error) {
          errors.push({
            item_id,
            error: result.error,
          });
        } else if (!result.skipped) {
          results.push(result);
        }
      } catch (itemError) {
        console.error(`Error processing item ${item_id}:`, itemError);
        errors.push({
          item_id,
          error: itemError.message,
        });
      }
    }

    // Log the stock tally operation
    // Use timestamp-based ID since this is a bulk operation without a single entity ID
    const tallyId = `stock-tally-${Date.now()}`;
    await withLogging(
      request,
      "stock_tally",
      tallyId,
      "CREATE",
      `Stock tally completed: ${results.length} items updated, ${errors.length} errors`,
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
      { status: 200 },
    );
  } catch (error) {
    console.error("Stock tally error:", error);
    console.error("Error in POST /api/stock_tally:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
