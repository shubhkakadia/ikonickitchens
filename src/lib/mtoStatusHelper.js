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

    let allItemsFullyCovered = true;
    let anyItemHasCoverage = false;

    for (const item of mto.items) {
      // Calculate reserved quantity
      const reservedQty =
        item.reserve_item_stock?.reduce(
          (sum, res) => sum + (res.quantity || 0),
          0,
        ) || 0;

      // Calculate ordered quantity (PO takes precedence if > 0, otherwise manual)
      const orderedQty =
        (item.quantity_ordered_po || 0) > 0
          ? item.quantity_ordered_po
          : item.quantity_ordered || 0;

      const totalCovered = reservedQty + orderedQty;
      const requiredQty = item.quantity || 0;

      // Check coverage
      if (totalCovered > 0) {
        anyItemHasCoverage = true;
      }

      if (totalCovered < requiredQty) {
        allItemsFullyCovered = false;
      }
    }

    // Determine the new status
    let newStatus = "DRAFT";
    if (allItemsFullyCovered && mto.items.length > 0) {
      newStatus = "FULLY_ORDERED";
    } else if (anyItemHasCoverage) {
      newStatus = "PARTIALLY_ORDERED";
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
