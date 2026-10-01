import { prisma } from "@/lib/db";
import { TransactionError } from "@/lib/transactionError";

// Shared by POST /purchase_order/received_items and the ADDED branch of
// POST /stock_transaction/create, so both enforce the same rules.

/**
 * Checks and normalises the lines of a receive request.
 * purchase_order_item.quantity_received and stock_transaction.quantity are
 * integer columns, so quantities must be positive whole numbers.
 * @returns {{ error: string } | { items: Array<{item_id: string, quantity: number, notes?: string}> }}
 */
export function normalizeReceiveItems(items) {
  const normalized = [];
  for (const entry of items) {
    const quantity = Number(entry.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return {
        error: `Quantity must be a positive whole number for item ${entry.item_id}`,
      };
    }
    normalized.push({
      item_id: entry.item_id,
      quantity,
      notes: entry.notes,
    });
  }
  return { items: normalized };
}

// Only ORDERED and PARTIALLY_RECEIVED POs can take deliveries. FULLY_RECEIVED
// is allowed through so the over-receive check gives the precise answer.
const RECEIVABLE_STATUS_BLOCKS = {
  DRAFT: "Cannot receive items for a DRAFT purchase order. Mark it as ORDERED first.",
  CANCELLED: "Cannot receive items for a CANCELLED purchase order.",
};

/**
 * Records a delivery against a purchase order. Must run inside a transaction.
 *
 * - locks the PO row, so concurrent deliveries are serialised
 * - refuses CANCELLED and DRAFT POs
 * - totals the request per item (duplicate entries add up) and spreads it over
 *   that item's PO lines, so the over-receive check sees the combined quantity
 * - claims each line with a guarded write, then raises stock, writes one
 *   ADDED ledger row per request entry, and recalculates the PO status
 *
 * Throws TransactionError for client errors; the caller maps it to a response.
 *
 * @param tx - Prisma transaction client
 * @param {{ purchase_order_id: string, items: Array<{item_id: string, quantity: number, notes?: string}> }} args
 *   items must already be normalised with normalizeReceiveItems
 */
export async function receivePurchaseOrderItems(
  tx,
  { purchase_order_id, items },
) {
  await tx.$queryRaw`
    SELECT id FROM purchase_order
    WHERE id = ${purchase_order_id}
    FOR UPDATE
  `;

  const purchaseOrder = await tx.purchase_order.findUnique({
    where: { id: purchase_order_id },
    include: { items: true },
  });
  if (!purchaseOrder) {
    throw new TransactionError(
      `Purchase order not found: ${purchase_order_id}`,
      404,
    );
  }

  const blocked = RECEIVABLE_STATUS_BLOCKS[purchaseOrder.status];
  if (blocked) throw new TransactionError(blocked, 400);

  // PO lines per inventory item, oldest first (a PO may list an item twice)
  const linesByItem = new Map();
  const sortedLines = [...purchaseOrder.items].sort(
    (a, b) =>
      new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0) ||
      String(a.id).localeCompare(String(b.id)),
  );
  for (const line of sortedLines) {
    if (!linesByItem.has(line.item_id)) linesByItem.set(line.item_id, []);
    linesByItem.get(line.item_id).push(line);
  }

  // Total what the request wants per item before checking anything
  const requestedByItem = new Map();
  for (const entry of items) {
    requestedByItem.set(
      entry.item_id,
      (requestedByItem.get(entry.item_id) || 0) + entry.quantity,
    );
  }

  // Validate everything and decide the allocation before writing anything
  const allocations = [];
  for (const [item_id, requested] of requestedByItem) {
    const lines = linesByItem.get(item_id);
    if (!lines) {
      throw new TransactionError(
        `Item ${item_id} not found in purchase order ${purchase_order_id}`,
        404,
      );
    }

    const inventoryItem = await tx.item.findUnique({
      where: { item_id },
      select: { item_id: true, is_deleted: true },
    });
    if (!inventoryItem || inventoryItem.is_deleted) {
      throw new TransactionError(`Inventory item not found: ${item_id}`, 404);
    }

    let left = requested;
    for (const line of lines) {
      const remaining = line.quantity - (line.quantity_received || 0);
      const take = Math.min(left, Math.max(remaining, 0));
      if (take > 0) {
        allocations.push({ line, take });
        left -= take;
      }
    }

    if (left > 0) {
      const ordered = lines.reduce((sum, l) => sum + l.quantity, 0);
      const received = lines.reduce(
        (sum, l) => sum + (l.quantity_received || 0),
        0,
      );
      throw new TransactionError(
        `Cannot receive more than ordered quantity for item ${item_id}. Ordered: ${ordered}, Already received: ${received}, Requested: ${requested}, Remaining: ${ordered - received}`,
        400,
      );
    }
  }

  // Claim each line. The write only applies while the line still has room
  // (or is still NULL, which an increment can't handle), so a delivery can
  // never push a line past its ordered quantity.
  for (const { line, take } of allocations) {
    const claimed =
      line.quantity_received == null
        ? await tx.purchase_order_item.updateMany({
            where: { id: line.id, quantity_received: null },
            data: { quantity_received: take },
          })
        : await tx.purchase_order_item.updateMany({
            where: {
              id: line.id,
              quantity_received: { lte: line.quantity - take },
            },
            data: { quantity_received: { increment: take } },
          });
    if (claimed.count === 0) {
      throw new TransactionError(
        "Received quantity was changed by someone else. Reload and try again.",
        409,
      );
    }
  }

  // Stock goes up once per item
  for (const [item_id, requested] of requestedByItem) {
    await tx.item.update({
      where: { item_id },
      data: { quantity: { increment: requested } },
    });
  }

  // One ledger row per request entry, so notes are kept
  for (const entry of items) {
    await tx.stock_transaction.create({
      data: {
        item_id: entry.item_id,
        quantity: entry.quantity,
        type: "ADDED",
        purchase_order_id,
        notes: entry.notes || `Received from PO ${purchase_order_id}`,
      },
    });
  }

  // Recalculate the PO status once
  const updatedLines = await tx.purchase_order_item.findMany({
    where: { order_id: purchase_order_id },
  });
  const allReceived = updatedLines.every(
    (l) => (l.quantity_received || 0) >= l.quantity,
  );
  const someReceived = updatedLines.some((l) => (l.quantity_received || 0) > 0);

  let newStatus = purchaseOrder.status;
  if (allReceived) newStatus = "FULLY_RECEIVED";
  else if (someReceived) newStatus = "PARTIALLY_RECEIVED";

  if (newStatus !== purchaseOrder.status) {
    await tx.purchase_order.update({
      where: { id: purchase_order_id },
      data: { status: newStatus },
    });
  }
}

/** The PO with its relations, read after the transaction commits. */
export function fetchReceivedPurchaseOrder(purchase_order_id) {
  return prisma.purchase_order.findUnique({
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
}
