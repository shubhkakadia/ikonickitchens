// Keeps materials_to_order_item.quantity_ordered_po in step with the purchase
// orders that feed it. A PO line counts against the MTO line given by its
// mto_item_id or, when none was stored, the PO's MTO line for the same item
// (the same matching the create route uses).

/** The MTO line ids of a PO's MTO, or [] when the PO has no MTO. */
export async function loadMtoItems(tx, mtoId) {
  if (!mtoId) return [];
  return tx.materials_to_order_item.findMany({
    where: { mto_id: mtoId },
    select: { id: true, item_id: true },
  });
}

/** Which MTO line a PO line counts against, or undefined if none. */
export function mtoTargetId(line, mtoItems) {
  if (line.mto_item_id) return line.mto_item_id;
  return mtoItems.find((mi) => mi.item_id === line.item_id)?.id;
}

/** Adds `delta` to the running total for an MTO line in a Map. */
export function addDelta(deltas, mtoItemId, delta) {
  if (!mtoItemId || !delta) return;
  deltas.set(mtoItemId, (deltas.get(mtoItemId) || 0) + delta);
}

/**
 * What cancelling a PO gives back to its MTO lines: the part of each line that
 * has not been received. Received units are already in stock, so they stay
 * counted as ordered.
 */
export function releaseDeltas(lines, mtoItems) {
  const deltas = new Map();
  for (const line of lines) {
    const unreceived = line.quantity - (line.quantity_received || 0);
    if (unreceived > 0) {
      addDelta(deltas, mtoTargetId(line, mtoItems), -unreceived);
    }
  }
  return deltas;
}

/**
 * Applies the deltas with atomic writes. A decrease never takes the total
 * below zero, even if the stored value has drifted from the purchase orders.
 */
export async function applyMtoOrderedDeltas(tx, deltas) {
  for (const [mtoItemId, delta] of deltas) {
    if (delta > 0) {
      await tx.materials_to_order_item.update({
        where: { id: mtoItemId },
        data: { quantity_ordered_po: { increment: delta } },
      });
    } else if (delta < 0) {
      const { count } = await tx.materials_to_order_item.updateMany({
        where: { id: mtoItemId, quantity_ordered_po: { gte: -delta } },
        data: { quantity_ordered_po: { decrement: -delta } },
      });
      if (count === 0) {
        await tx.materials_to_order_item.updateMany({
          where: { id: mtoItemId },
          data: { quantity_ordered_po: 0 },
        });
      }
    }
  }
}
