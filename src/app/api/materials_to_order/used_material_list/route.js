import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request) {
  try {
    // Verify authentication
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    // Fetch completed MTOs with their items and ordered items
    const completedMTOs = await prisma.materials_to_order.findMany({
      where: {
        status: "FULLY_ORDERED",
      },
      include: {
        items: {
          include: {
            item: {
              include: {
                image: true,
                sheet: true,
                handle: true,
                hardware: true,
                accessory: true,
                edging_tape: true,
                supplier: {
                  select: {
                    supplier_id: true,
                    name: true,
                  },
                },
              },
            },
            ordered_items: {
              include: {
                order: {
                  select: {
                    id: true,
                    order_no: true,
                    status: true,
                  },
                },
              },
            },
            reserve_item_stock: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Separate MTOs into two categories:
    // 1. Ready to use: All materials have been received
    // 2. Upcoming: Some materials are still pending
    const readyToUse = [];
    const upcoming = [];

    completedMTOs.forEach((mto) => {
      // Skip MTOs without items
      if (!mto.items || mto.items.length === 0) {
        return;
      }

      // Check if all items are ready (either received via PO or reserved from stock)
      const allItemsReceived = mto.items.every((item) => {
        // Check if this item has reserved stock
        const hasReservedStock =
          item.reserve_item_stock && item.reserve_item_stock.length > 0;

        // Check if this item has received purchase orders
        const hasReceivedPO = item.ordered_items?.some(
          (orderedItem) => orderedItem.order?.status === "RECEIVED",
        );

        // Item is ready if it has reserved stock OR received PO
        return hasReservedStock || hasReceivedPO;
      });

      // Calculate statistics
      const totalItems = mto.items.length;
      const totalQuantity = mto.items.reduce(
        (sum, item) => sum + (parseFloat(item.quantity) || 0),
        0,
      );

      // Calculate how many items are received vs pending
      let receivedItems = 0;
      let pendingItems = 0;

      mto.items.forEach((item) => {
        const hasReservedStock =
          item.reserve_item_stock && item.reserve_item_stock.length > 0;
        const hasReceivedPO = item.ordered_items?.some(
          (orderedItem) => orderedItem.order?.status === "RECEIVED",
        );

        if (hasReservedStock || hasReceivedPO) {
          receivedItems++;
        } else {
          pendingItems++;
        }
      });

      // Group items by supplier
      const supplierGroups = new Map();
      mto.items.forEach((item) => {
        const supplierId = item.item?.supplier?.supplier_id || "unassigned";
        const supplierName = item.item?.supplier?.name || "Unassigned";

        if (!supplierGroups.has(supplierId)) {
          supplierGroups.set(supplierId, {
            supplier_id: supplierId,
            supplier_name: supplierName,
            item_count: 0,
            items: [],
          });
        }

        const group = supplierGroups.get(supplierId);
        group.item_count++;
        group.items.push(item);
      });

      const enrichedMTO = {
        ...mto,
        statistics: {
          total_items: totalItems,
          total_quantity: totalQuantity,
          received_items: receivedItems,
          pending_items: pendingItems,
          suppliers: Array.from(supplierGroups.values()),
        },
        is_ready: allItemsReceived,
      };

      // Add to appropriate category
      if (allItemsReceived) {
        readyToUse.push(enrichedMTO);
      } else {
        upcoming.push(enrichedMTO);
      }
    });

    return NextResponse.json(
      {
        status: true,
        data: {
          ready_to_use: readyToUse,
          upcoming: upcoming,
        },
        counts: {
          ready_to_use: readyToUse.length,
          upcoming: upcoming.length,
          total: readyToUse.length + upcoming.length,
        },
        message: "Used material list fetched successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching used material list:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
        error: error.message,
      },
      { status: 500 },
    );
  }
}
