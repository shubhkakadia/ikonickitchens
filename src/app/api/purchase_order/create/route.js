import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { uploadFile, getFileFromFormData } from "@/lib/fileHandler";
import { withLogging } from "@/lib/withLogging";

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const contentType = request.headers.get("content-type") || "";

    let supplier_id;
    let mto_id;
    let order_no;
    let orderedBy_id;
    let invoice_url_id; // may be set if file uploaded
    let total_amount;
    let notes;
    let items;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();

      supplier_id = form.get("supplier_id") || undefined;
      mto_id = form.get("mto_id") || undefined;
      order_no = form.get("order_no") || undefined;
      orderedBy_id = form.get("orderedBy_id") || undefined;
      notes = form.get("notes") || undefined;

      const totalAmountStr = form.get("total_amount");
      total_amount =
        totalAmountStr !== null && totalAmountStr !== undefined
          ? Number(totalAmountStr)
          : undefined;

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

      const file =
        getFileFromFormData(form, "invoice") ||
        getFileFromFormData(form, "file");
      if (file) {
        if (!order_no) {
          return NextResponse.json(
            {
              status: false,
              message: "order_no is required when uploading a file",
            },
            { status: 400 }
          );
        }

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
            supplier_id,
          },
        });
        invoice_url_id = createdFile.id;
      }
    } else {
      const body = await request.json();
      supplier_id = body.supplier_id;
      mto_id = body.mto_id;
      order_no = body.order_no;
      orderedBy_id = body.orderedBy_id;
      invoice_url_id = body.invoice_url_id;
      total_amount = body.total_amount;
      notes = body.notes;
      items = body.items;
    }

    if (!supplier_id) {
      return NextResponse.json(
        { status: false, message: "supplier_id is required" },
        { status: 400 }
      );
    }
    // mto_id is optional per schema; do not require it
    if (!order_no) {
      return NextResponse.json(
        { status: false, message: "order_no is required" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create PO and items
      const createdPO = await tx.purchase_order.create({
        data: {
          supplier_id,
          mto_id,
          order_no,
          orderedBy_id,
          invoice_url_id,
          total_amount,
          notes,
          items:
            Array.isArray(items) && items.length > 0
              ? {
                  create: items.map((item) => ({
                    item_id: item.item_id,
                    quantity: Number(item.quantity),
                    notes: item.notes,
                    unit_price:
                      item.unit_price !== undefined
                        ? Number(item.unit_price)
                        : undefined,
                  })),
                }
              : undefined,
        },
        include: { items: true },
      });

      // If linked to an MTO and items provided, update MTOI quantities and MTO status
      if (createdPO.mto_id && createdPO.items && createdPO.items.length > 0) {
        // Fetch all MTO items for the MTO
        const mtoItems = await tx.materials_to_order_item.findMany({
          where: { mto_id: createdPO.mto_id },
          select: {
            id: true,
            item_id: true,
            quantity: true,
            quantity_ordered: true,
          },
        });

        const itemIdToMtoItem = new Map(mtoItems.map((mi) => [mi.item_id, mi]));

        // Apply cumulative ordered quantity per matching item
        for (const poi of createdPO.items) {
          const mtoItem = itemIdToMtoItem.get(poi.item_id);
          if (!mtoItem) continue;
          const alreadyOrdered = Number(mtoItem.quantity_ordered || 0);
          const orderedThisPO = Number(poi.quantity || 0);
          const cappedOrdered = Math.min(
            Number(mtoItem.quantity),
            alreadyOrdered + orderedThisPO
          );
          if (cappedOrdered !== alreadyOrdered) {
            await tx.materials_to_order_item.update({
              where: { id: mtoItem.id },
              data: { quantity_ordered: cappedOrdered },
            });
            // Update local copy for later status calculation
            mtoItem.quantity_ordered = cappedOrdered;
          }
        }

        // Determine MTO status based on whether all items are fully ordered
        const allFullyOrdered =
          mtoItems.length > 0 &&
          mtoItems.every(
            (mi) =>
              Number(mi.quantity_ordered || 0) === Number(mi.quantity || 0)
          );
        await tx.materials_to_order.update({
          where: { id: createdPO.mto_id },
          data: {
            status: allFullyOrdered ? "FULLY_ORDERED" : "PARTIALLY_ORDERED",
          },
        });
      }

      return createdPO;
    });

    const logged = await withLogging(
      request,
      "purchase_order",
      result.id,
      "CREATE",
      `Purchase order created successfully for project: ${result.mto_id}`
    );
    if (!logged) {
      console.error(`Failed to log purchase order creation: ${result.id}`);
      return NextResponse.json(
        { 
          status: true, 
          message: "Purchase order created successfully",
          data: result,
          warning: "Note: Creation succeeded but logging failed"
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: "Purchase order created successfully",
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/purchase_order/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
