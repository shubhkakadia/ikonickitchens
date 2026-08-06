import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  validateAdminAuth,
  getUserFromToken,
} from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
import { sendNotification } from "@/lib/notification";
import { checkAndUpdateMTOStatus } from "@/lib/mtoStatusHelper";

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    // Get user_id from session
    const session = await getUserFromToken(request);
    if (!session) {
      return NextResponse.json(
        { status: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    const userId = session.user_id;

    const { id } = await params;
    const data = await request.json();

    if (!data || data.quantity_ordered === undefined) {
      return NextResponse.json(
        { status: false, message: "quantity_ordered is required" },
        { status: 400 },
      );
    }

    const raw = Number(data.quantity_ordered);
    if (!Number.isFinite(raw) || raw < 0) {
      return NextResponse.json(
        { status: false, message: "quantity_ordered must be a number >= 0" },
        { status: 400 },
      );
    }

    const mtoItem = await prisma.materials_to_order_item.findUnique({
      where: { id },
      include: {
        item: {
          include: {
            supplier: {
              select: {
                supplier_id: true,
                name: true,
              },
            },
            itemSuppliers: {
              include: {
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
        mto: {
          include: {
            items: {
              include: {
                item: {
                  include: {
                    supplier: {
                      select: {
                        supplier_id: true,
                        name: true,
                      },
                    },
                    itemSuppliers: {
                      include: {
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
              },
            },
          },
        },
      },
    });

    if (!mtoItem) {
      return NextResponse.json(
        { status: false, message: "Materials to order item not found" },
        { status: 404 },
      );
    }

    const quantityOrdered = Math.floor(raw);
    const previousQuantityOrdered = mtoItem.quantity_ordered || 0;

    const updated = await prisma.materials_to_order_item.update({
      where: { id },
      data: {
        quantity_ordered: quantityOrdered,
        ordered_by_id: userId,
      },
      include: {
        ordered_by: {
          select: {
            id: true,
            username: true,
          },
        },
        item: {
          include: {
            supplier: {
              select: {
                supplier_id: true,
                name: true,
              },
            },
          },
        },
        mto: {
          include: {
            project: {
              include: {
                client: true,
              },
            },
            lots: {
              select: {
                lot_id: true,
                name: true,
              },
            },
            items: {
              include: {
                item: {
                  include: {
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
          },
        },
      },
    });

    const logged = await withLogging(
      request,
      "materials_to_order_item",
      id,
      "UPDATE",
      `Updated quantity_ordered=${quantityOrdered} for mto_item=${id} (mto_id=${mtoItem.mto_id}, item_id=${mtoItem.item_id})`,
    );
    if (!logged) {
      console.error(`Failed to log materials_to_order_item update: ${id}`);
    }

    // Check if all items from this supplier are ordered (only send notification on transition)
    // In multi-supplier world, this is ambiguous for manual updates. We try to find a relevant supplier.
    const itemSuppliers = updated.item?.itemSuppliers || [];
    const legacySupplierId = updated.item?.supplier?.supplier_id;

    // Determine which supplier ID to group by. Priority: Legacy -> First in list -> undefined
    const supplierId =
      legacySupplierId ||
      (itemSuppliers.length > 0
        ? itemSuppliers[0].supplier?.supplier_id
        : undefined);

    if (supplierId && updated.mto) {
      // Get all items from this MTO that belong to the same supplier (checking both legacy and new structure)
      const supplierItems = updated.mto.items.filter((item) => {
        const iSuppliers = item.item?.itemSuppliers || [];
        const iLegacyId = item.item?.supplier?.supplier_id;

        // Match if legacy ID matches OR if any of the item's suppliers match
        return (
          iLegacyId === supplierId ||
          iSuppliers.some((is) => is.supplier?.supplier_id === supplierId)
        );
      });

      // Check current state: if all items from this supplier are fully ordered
      const allOrderedNow = supplierItems.every(
        (item) => (item.quantity_ordered || 0) >= (item.quantity || 0),
      );

      // Check previous state: were all items already ordered before this update?
      // We need to check the previous state by looking at the old data
      const previousSupplierItems = mtoItem.mto.items.filter(
        (item) => item.item?.supplier?.supplier_id === supplierId,
      );
      const allOrderedBefore = previousSupplierItems.every((item) => {
        // Use the updated quantity for the current item, previous for others
        const qtyOrdered =
          item.id === id ? previousQuantityOrdered : item.quantity_ordered || 0;
        return qtyOrdered >= (item.quantity || 0);
      });

      // Only send notification if we transitioned from "not all ordered" to "all ordered"
      if (allOrderedNow && !allOrderedBefore && supplierItems.length > 0) {
        // Send notification for ordered status
        try {
          const supplierName = updated.item.supplier.name || "Unknown Supplier";
          const lotNames =
            updated.mto.lots && updated.mto.lots.length > 0
              ? updated.mto.lots.length === 1
                ? updated.mto.lots[0].lot_id
                : updated.mto.lots.map((l) => l.lot_id).join(", ")
              : "Unknown Lot";

          await sendNotification(
            {
              type: "material_to_order",
              materials_to_order_id: updated.mto_id,
              project_id: updated.mto.project_id,
              project_name: updated.mto.project?.name || "Unknown Project",
              client_name:
                updated.mto.project?.client?.client_name || "Unknown Client",
              lot_name: lotNames,
              supplier_name: supplierName,
              is_ordered: true,
              status: `${supplierName} Ordered`,
            },
            "materials_to_order_list_update",
          );
        } catch (notificationError) {
          console.error(
            "Failed to send MTO ordered notification:",
            notificationError,
          );
          // Don't fail the request if notification fails
        }
      }
    }

    // Check and update MTO status after updating quantity ordered
    await checkAndUpdateMTOStatus(id);

    return NextResponse.json(
      {
        status: true,
        message: "Materials to order item updated successfully",
        data: updated,
        ...(logged
          ? {}
          : { warning: "Note: Update succeeded but logging failed" }),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in PATCH /api/materials_to_order_item/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
