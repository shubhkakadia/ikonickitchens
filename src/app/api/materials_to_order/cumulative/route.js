import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request) {
  try {
    // Verify authentication
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    // Fetch all active MTOs with their items
    const mtos = await prisma.materials_to_order.findMany({
      where: {
        status: {
          in: ["DRAFT", "PARTIALLY_ORDERED"],
        },
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
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Fetch all reservations for these MTO items
    const mtoItemIds = mtos.flatMap((mto) => mto.items.map((item) => item.id));

    const reservations = await prisma.reserve_item_stock.findMany({
      where: {
        mto_id: {
          in: mtoItemIds,
        },
      },
      select: {
        mto_id: true,
        quantity: true,
        used_quantity: true,
      },
    });

    // Create a map of reserved MTO item IDs
    const reservedMtoItemsMap = new Map();
    reservations.forEach((reservation) => {
      reservedMtoItemsMap.set(reservation.mto_id, true);
    });

    // Aggregate items by supplier
    const supplierMap = new Map();

    mtos.forEach((mto) => {
      mto.items.forEach((mtoItem) => {
        const item = mtoItem.item;
        if (!item) return;

        // Skip if this MTO item is reserved
        if (reservedMtoItemsMap.has(mtoItem.id)) {
          return;
        }

        // Handle items with or without supplier
        const supplierId = item.supplier?.supplier_id || "unassigned";
        const supplierName = item.supplier?.name || "Unassigned";
        const itemId = item.item_id;

        // Initialize supplier in map if not exists
        if (!supplierMap.has(supplierId)) {
          supplierMap.set(supplierId, {
            supplier_id: supplierId,
            supplier_name: supplierName,
            items: new Map(),
          });
        }

        const supplier = supplierMap.get(supplierId);

        // Calculate remaining quantity (total - ordered)
        const totalQty = parseFloat(mtoItem.quantity) || 0;
        const orderedQty = parseFloat(mtoItem.quantity_ordered_po) || 0;
        const remainingQty = Math.max(0, totalQty - orderedQty);

        // Skip if nothing remaining to order
        if (remainingQty <= 0) return;

        // Aggregate items by item_id
        if (!supplier.items.has(itemId)) {
          supplier.items.set(itemId, {
            item_id: itemId,
            category: item.category,
            description: item.description,
            image: item.image,
            sheet: item.sheet,
            handle: item.handle,
            hardware: item.hardware,
            accessory: item.accessory,
            edging_tape: item.edging_tape,
            measurement_unit: item.measurement_unit,
            stock_on_hand: item.quantity || 0,
            cumulative_quantity: 0,
            mto_sources: [], // Track which MTOs contribute to this item
          });
        }

        const aggregatedItem = supplier.items.get(itemId);
        aggregatedItem.cumulative_quantity += remainingQty;
        aggregatedItem.mto_sources.push({
          mto_id: mto.id,
          mto_item_id: mtoItem.id,
          project_name: mto.project?.name,
          quantity: remainingQty,
        });
      });
    });

    // Convert maps to arrays for JSON response
    const cumulativeData = Array.from(supplierMap.values()).map((supplier) => ({
      supplier_id: supplier.supplier_id,
      supplier_name: supplier.supplier_name,
      items: Array.from(supplier.items.values()),
    }));

    // Sort by supplier name
    cumulativeData.sort((a, b) =>
      a.supplier_name.localeCompare(b.supplier_name)
    );

    return NextResponse.json(
      {
        status: true,
        data: cumulativeData,
        message: "Cumulative materials fetched successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching cumulative materials:", error);
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
