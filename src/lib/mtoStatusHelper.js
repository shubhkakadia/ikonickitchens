import { prisma } from "@/lib/db";

/**
 * Check and update MTO status based on whether all items are ordered or reserved
 * @param {string} mtoItemId - The MTO item ID to check
 * @returns {Promise<boolean>} - Returns true if status was updated, false otherwise
 */
export async function checkAndUpdateMTOStatus(mtoItemId) {
  try {
    // Get the MTO item to find the parent MTO
    const mtoItem = await prisma.materials_to_order_item.findUnique({
      where: { id: mtoItemId },
      select: { mto_id: true },
    });

    if (!mtoItem || !mtoItem.mto_id) {
      return false;
    }

    const mtoId = mtoItem.mto_id;

    // Get the MTO with all its items and their reservations
    const mto = await prisma.materials_to_order.findUnique({
      where: { id: mtoId },
      include: {
        items: {
          include: {
            reserve_item_stock: true,
          },
        },
      },
    });

    if (!mto || !mto.items || mto.items.length === 0) {
      return false;
    }

    let allItemsOrderedOrReserved = true;
    let someItemsOrderedOrReserved = false;

    for (const item of mto.items) {
      const isOrdered =
        (item.quantity_ordered || 0) > 0 || (item.quantity_ordered_po || 0) > 0;
      const isReserved =
        item.reserve_item_stock && item.reserve_item_stock.length > 0;

      if (isOrdered || isReserved) {
        someItemsOrderedOrReserved = true;
      } else {
        allItemsOrderedOrReserved = false;
      }
    }

    // Determine the new status
    let newStatus = null;
    if (allItemsOrderedOrReserved) {
      newStatus = "FULLY_ORDERED";
    } else if (someItemsOrderedOrReserved) {
      newStatus = "PARTIALLY_ORDERED";
    } else {
      newStatus = "DRAFT";
    }

    // Only update if status should change and is different from current
    if (newStatus && newStatus !== mto.status) {
      await prisma.materials_to_order.update({
        where: { id: mtoId },
        data: { status: newStatus },
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error in checkAndUpdateMTOStatus:", error);
    return false;
  }
}
