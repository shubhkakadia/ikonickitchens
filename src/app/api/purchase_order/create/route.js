import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { uploadFile, getFileFromFormData } from "@/lib/fileHandler";
import { withLogging } from "@/lib/withLogging";
import { checkAndUpdateMTOStatus } from "@/lib/mtoStatusHelper";

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    // Parse FormData
    const form = await request.formData();

    const supplier_id = form.get("supplier_id") || undefined;
    const mto_id = form.get("mto_id") || undefined;
    const order_no = form.get("order_no") || undefined;
    const orderedBy_id = form.get("orderedBy_id") || undefined;
    const notes = form.get("notes") || undefined;

    const totalAmountStr = form.get("total_amount");
    const total_amount =
      totalAmountStr !== null && totalAmountStr !== undefined
        ? Number(totalAmountStr)
        : undefined;

    const deliveryChargeStr = form.get("delivery_charge");
    const delivery_charge =
      deliveryChargeStr !== null &&
      deliveryChargeStr !== undefined &&
      deliveryChargeStr !== ""
        ? Number(deliveryChargeStr)
        : undefined;

    const invoiceDateStr = form.get("invoice_date");
    const invoice_date =
      invoiceDateStr !== null &&
      invoiceDateStr !== undefined &&
      invoiceDateStr !== ""
        ? new Date(invoiceDateStr)
        : undefined;

    const status = form.get("status") || undefined;

    // Validate required fields
    if (!supplier_id) {
      return NextResponse.json(
        { status: false, message: "supplier_id is required" },
        { status: 400 },
      );
    }

    if (!order_no) {
      return NextResponse.json(
        { status: false, message: "order_no is required" },
        { status: 400 },
      );
    }

    // Check if order_no already exists
    const existingPO = await prisma.purchase_order.findUnique({
      where: { order_no },
    });

    if (existingPO) {
      return NextResponse.json(
        {
          status: false,
          message: `Purchase order with order number "${order_no}" already exists`,
        },
        { status: 409 },
      );
    }

    // Parse items from FormData
    let items;
    const itemsVal = form.get("items");
    if (itemsVal) {
      try {
        if (typeof itemsVal === "string") {
          let parsed;
          try {
            parsed = JSON.parse(itemsVal);
          } catch (e1) {
            // Support comma-separated object list without [ ]
            const trimmed = itemsVal.trim();
            if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
              try {
                parsed = JSON.parse(`[${trimmed}]`);
              } catch (e2) {
                parsed = undefined;
              }
            }
          }

          if (parsed && !Array.isArray(parsed)) {
            items = [parsed];
          } else if (Array.isArray(parsed)) {
            items = parsed;
          } else {
            items = undefined;
          }
        } else {
          items = itemsVal;
        }
      } catch (_) {
        items = undefined;
      }
    }

    // Handle file upload
    let invoice_url_id;
    const file =
      getFileFromFormData(form, "invoice") || getFileFromFormData(form, "file");

    if (file) {
      // Upload file with order_no as the filename base
      const uploadResult = await uploadFile(file, {
        uploadDir: "mediauploads",
        subDir: "purchase_order",
        filenameStrategy: "id-based",
        idPrefix: order_no,
      });

      const createdFile = await prisma.supplier_file.create({
        data: {
          url: uploadResult.relativePath,
          filename: uploadResult.filename,
          file_type: "invoice",
          mime_type: uploadResult.mimeType,
          extension: uploadResult.extension,
          size: uploadResult.size,
        },
      });
      invoice_url_id = createdFile.id;
    }

    // Create purchase order within a transaction
    // Calculate grand total from items (Order Total + GST)
    const orderTotal = Array.isArray(items)
      ? items.reduce((sum, item) => {
          const itemTotal = Number(item.total_amount || 0);
          return sum + itemTotal;
        }, 0)
      : 0;

    const gstTotal = Array.isArray(items)
      ? items.reduce((sum, item) => {
          const itemGst = Number(item.gst || 0);
          return sum + itemGst;
        }, 0)
      : 0;

    const grandTotal = orderTotal + gstTotal;

    const result = await prisma.$transaction(async (tx) => {
      // Create PO and items
      const createdPO = await tx.purchase_order.create({
        data: {
          supplier_id,
          mto_id,
          order_no,
          orderedBy_id,
          invoice_url_id,
          total_amount: grandTotal, // Store grand total (Order Total + GST)
          delivery_charge,
          invoice_date,
          notes,
          items:
            Array.isArray(items) && items.length > 0
              ? {
                  create: items.map((item) => ({
                    item_id: item.item_id,
                    mto_item_id: item.mto_item_id,
                    quantity: Number(item.quantity),
                    notes: item.notes,
                    unit_price:
                      item.unit_price !== undefined
                        ? Number(item.unit_price)
                        : undefined,
                    gst: item.gst !== undefined ? Number(item.gst) : undefined,
                    total_amount:
                      item.total_amount !== undefined
                        ? Number(item.total_amount)
                        : undefined,
                  })),
                }
              : undefined,
          status,
        },
        include: { items: true },
      });

      // If linked to an MTO and items provided, update MTOI quantities
      if (createdPO.mto_id && createdPO.items && createdPO.items.length > 0) {
        // Fetch all MTO items for the MTO
        const mtoItems = await tx.materials_to_order_item.findMany({
          where: { mto_id: createdPO.mto_id },
          select: {
            id: true,
            item_id: true,
            quantity: true,
            quantity_ordered_po: true,
          },
        });

        const itemIdToMtoItem = new Map(mtoItems.map((mi) => [mi.item_id, mi]));

        // Apply cumulative ordered quantity per matching item
        for (const poi of createdPO.items) {
          const mtoItem = itemIdToMtoItem.get(poi.item_id);
          if (!mtoItem) continue;
          const alreadyOrdered = Number(mtoItem.quantity_ordered_po || 0);
          const orderedThisPO = Number(poi.quantity || 0);
          const cappedOrdered = alreadyOrdered + orderedThisPO;
          if (cappedOrdered !== alreadyOrdered) {
            await tx.materials_to_order_item.update({
              where: { id: mtoItem.id },
              data: { quantity_ordered_po: cappedOrdered },
            });
          }
        }
      }

      return createdPO;
    });

    // Update MTO status after transaction (considers both ordered items and reservations)
    if (result.mto_id && result.items && result.items.length > 0) {
      // Use the first item's mto_item_id to trigger the status check
      const firstItemWithMtoId = result.items.find((item) => item.mto_item_id);
      if (firstItemWithMtoId) {
        await checkAndUpdateMTOStatus(firstItemWithMtoId.mto_item_id);
      }
    }

    const logged = await withLogging(
      request,
      "purchase_order",
      result.id,
      "CREATE",
      `Purchase order created successfully for project: ${result.mto_id}`,
    );
    if (!logged) {
      console.error(`Failed to log purchase order creation: ${result.id}`);
      return NextResponse.json(
        {
          status: true,
          message: "Purchase order created successfully",
          data: result,
          warning: "Note: Creation succeeded but logging failed",
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: "Purchase order created successfully",
        data: result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/purchase_order/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
