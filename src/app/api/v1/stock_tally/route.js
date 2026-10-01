import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

/**
 * Stock Tally API
 * Handles bulk stock quantity updates from stock tally Excel import
 * Creates stock_transaction records for each change
 */
export async function POST(request) {
  try {
    const authError = await requireAuth(request, { modules: ["all_items"] });
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
      const parsed = Number(item.new_quantity);
      if (!Number.isFinite(parsed) || String(item.new_quantity).trim() === "") {
        return NextResponse.json(
          {
            status: false,
            message: "new_quantity must be a number",
          },
          { status: 400 },
        );
      }
      if (parsed < 0) {
        return NextResponse.json(
          {
            status: false,
            message: "new_quantity must be non-negative",
          },
          { status: 400 },
        );
      }
    }

    // Quantities are Decimal(10,2); the ledger (stock_transaction.quantity) is
    // an integer, so the exact old -> new values go in its notes.
    const round2 = (n) => Math.round(n * 100) / 100;
    const seen = new Set();
    for (const item of items) {
      if (seen.has(item.item_id)) {
        return NextResponse.json(
          {
            status: false,
            message: `Duplicate item_id in request: ${item.item_id}`,
          },
          { status: 400 },
        );
      }
      seen.add(item.item_id);
    }

    const results = [];
    const errors = [];

    // One transaction for the whole tally: one read for every item, a guarded
    // write per changed item, and one batched ledger insert. A row that lost a
    // race is reported as a conflict and skipped; any unexpected database
    // error rolls everything back.
    await prisma.$transaction(
      async (tx) => {
        const current = await tx.item.findMany({
          where: { item_id: { in: items.map((i) => i.item_id) } },
          select: {
            item_id: true,
            quantity: true,
            is_deleted: true,
            itemSuppliers: {
              include: { supplier: { select: { name: true } } },
            },
          },
        });
        const byId = new Map(current.map((c) => [c.item_id, c]));
        const ledger = [];

        for (const { item_id, new_quantity, current_quantity } of items) {
          const stored = byId.get(item_id);
          if (!stored || stored.is_deleted) {
            errors.push({ item_id, error: "Item not found" });
            continue;
          }

          const oldQuantity = Number(stored.quantity ?? 0);
          const newQty = round2(Number(new_quantity));
          const difference = round2(newQty - oldQuantity);

          // The count was made against an exported sheet; if stock has moved
          // since, the delta would be wrong, so ask for a fresh export.
          if (
            current_quantity !== undefined &&
            current_quantity !== null &&
            Math.abs(oldQuantity - Number(current_quantity)) >= 1
          ) {
            errors.push({
              item_id,
              conflict: true,
              error: `Stock changed since the sheet was exported (sheet: ${current_quantity}, now: ${oldQuantity}). Export a fresh sheet and count again.`,
            });
            continue;
          }

          if (difference === 0) continue;

          // Only write if nobody changed the quantity since we read it
          const { count } = await tx.item.updateMany({
            where: { item_id, quantity: stored.quantity },
            data: { quantity: newQty },
          });
          if (count === 0) {
            errors.push({
              item_id,
              conflict: true,
              error:
                "Stock was changed by someone else during the tally. Try again.",
            });
            continue;
          }

          const transactionType = difference > 0 ? "ADDED" : "WASTED";
          ledger.push({
            item_id,
            quantity: Math.max(1, Math.round(Math.abs(difference))),
            type: transactionType,
            notes: `Stock tally adjustment: ${oldQuantity} → ${newQty}`,
          });

          const supplierRef =
            stored.itemSuppliers?.length > 0
              ? stored.itemSuppliers
                  .map(
                    (is) =>
                      `${is.supplier?.name || "Unassigned"}: ${is.supplier_reference || "N/A"}`,
                  )
                  .join(", ")
              : null;
          results.push({
            item_id,
            supplier_reference: supplierRef,
            old_quantity: oldQuantity,
            new_quantity: newQty,
            difference,
            type: transactionType,
          });
        }

        if (ledger.length > 0) {
          await tx.stock_transaction.createMany({ data: ledger });
        }
      },
      { timeout: 30000 },
    );

    const summary = {
      total_items: items.length,
      updated_count: results.length,
      error_count: errors.length,
    };

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

    // Nothing changed and something went wrong: don't report success
    const noneApplied = results.length === 0 && errors.length > 0;
    if (noneApplied) {
      const allConflicts = errors.every((e) => e.conflict);
      return NextResponse.json(
        {
          status: false,
          message: allConflicts
            ? "Stock changed since the sheet was exported. Export a fresh sheet and count again."
            : "Stock tally failed: no items were updated",
          data: { updated: [], errors, summary },
        },
        { status: allConflicts ? 409 : 422 },
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: `Stock tally completed: ${results.length} items updated`,
        data: { updated: results, errors, summary },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in POST /api/v1/stock_tally:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
