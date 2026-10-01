import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/validators/authFromToken";
import { prisma } from "@/lib/db";
import { uploadFile, getFileFromFormData } from "@/lib/fileHandler";
import { withLogging } from "@/lib/withLogging";
import { checkAndUpdateMTOStatus } from "@/lib/mtoStatusHelper";

export async function GET(request, { params }) {
  try {
    const authError = await requireAuth(request, {
      modules: ["purchaseorder", "supplier_details"],
    });
    if (authError) return authError;
    const { id } = await params;
    const po = await prisma.purchase_order.findUnique({
      where: { id },
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
                image: true,
              },
            },
          },
        },
        orderedBy: {
          select: {
            employee: {
              select: { employee_id: true, first_name: true, last_name: true },
            },
          },
        },
        invoice_url: true,
      },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Purchase order fetched successfully",
        data: po,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/v1/purchase_order/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authError = await requireAuth(request, {
      modules: ["purchaseorder", "supplier_details"],
    });
    if (authError) return authError;
    const { id } = await params;

    // Fetch existing PO to enforce immutable fields and get defaults (e.g., order_no for file naming)
    const existing = await prisma.purchase_order.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });
    if (!existing) {
      return NextResponse.json(
        { status: false, message: "Purchase order not found" },
        { status: 404 },
      );
    }

    const contentType = request.headers.get("content-type") || "";

    let body = {};
    let items; // optional replacement list
    let uploadedInvoiceFileId; // new supplier_file id if a file is uploaded

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();

      // Allowed top-level fields
      const status = form.get("status") || undefined;
      const ordered_at = form.get("ordered_at") || undefined;
      const total_amount_raw = form.get("total_amount");
      const delivery_charge_raw = form.get("delivery_charge");
      const invoice_date_raw = form.get("invoice_date");
      const notes = form.get("notes") || undefined;
      const invoice_url_raw = form.get("invoice_url");

      body.status = status;
      body.ordered_at = ordered_at;
      body.total_amount =
        total_amount_raw !== null &&
        total_amount_raw !== undefined &&
        total_amount_raw !== ""
          ? Number(total_amount_raw)
          : undefined;
      body.delivery_charge =
        delivery_charge_raw !== null &&
        delivery_charge_raw !== undefined &&
        delivery_charge_raw !== ""
          ? Number(delivery_charge_raw)
          : undefined;
      body.invoice_date =
        invoice_date_raw !== null &&
        invoice_date_raw !== undefined &&
        invoice_date_raw !== ""
          ? new Date(invoice_date_raw)
          : undefined;
      body.notes = notes;
      // Handle invoice_url deletion (can be "null" string or null)
      if (invoice_url_raw === "null" || invoice_url_raw === null) {
        body.invoice_url = null;
      }

      // Items can be a JSON string
      const itemsVal = form.get("items");
      if (itemsVal) {
        try {
          if (typeof itemsVal === "string") {
            let parsed;
            try {
              parsed = JSON.parse(itemsVal);
            } catch (e1) {
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
            }
          }
        } catch (_) {
          // ignore malformed items
        }
      }

      // Optional invoice file upload
      const file =
        getFileFromFormData(form, "invoice") ||
        getFileFromFormData(form, "file");
      if (file) {
        const order_no = existing.order_no; // immutable
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
        uploadedInvoiceFileId = createdFile.id;
      }
    } else {
      // JSON
      body = await request.json();
      items = body.items;
    }

    // Receiving stock is handled exclusively by POST /purchase_order/received_items,
    // which scopes lines to the PO, locks the row, rejects over-receives and writes
    // stock_transaction rows. Refuse it here so it can't bypass those checks.
    if (
      body.received_items !== undefined ||
      body.items_received !== undefined
    ) {
      return NextResponse.json(
        {
          status: false,
          message:
            "Receiving items is not supported on this endpoint. Use POST /api/v1/purchase_order/received_items",
        },
        { status: 400 },
      );
    }

    // Build update payload (only include provided allowed fields)
    const updateData = {};

    // Handle invoice soft deletion if invoice_url is explicitly set to null
    if (body.invoice_url === null || body.invoice_url_id === null) {
      if (existing.invoice_url_id) {
        // Soft delete: Mark the supplier_file as deleted instead of permanently deleting
        await prisma.supplier_file.update({
          where: { id: existing.invoice_url_id },
          data: { is_deleted: true },
        });

        // Set invoice_url_id to null in updateData to unlink from purchase_order
        updateData.invoice_url_id = null;
      }
    }

    if (body.status !== undefined) {
      // Validate status value
      const validStatuses = [
        "DRAFT",
        "ORDERED",
        "PARTIALLY_RECEIVED",
        "FULLY_RECEIVED",
        "CANCELLED",
      ];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          {
            status: false,
            message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          },
          { status: 400 },
        );
      }
      updateData.status = body.status;
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (
      body.total_amount !== undefined &&
      body.total_amount !== null &&
      body.total_amount !== ""
    )
      updateData.total_amount = Number(body.total_amount);
    if (
      body.delivery_charge !== undefined &&
      body.delivery_charge !== null &&
      body.delivery_charge !== ""
    )
      updateData.delivery_charge = Number(body.delivery_charge);
    if (
      body.invoice_date !== undefined &&
      body.invoice_date !== null &&
      body.invoice_date !== ""
    )
      updateData.invoice_date = new Date(body.invoice_date);
    if (
      body.ordered_at !== undefined &&
      body.ordered_at !== null &&
      body.ordered_at !== ""
    )
      updateData.ordered_at = new Date(body.ordered_at);
    if (uploadedInvoiceFileId)
      updateData.invoice_url_id = uploadedInvoiceFileId;

    // Handle items update with proper upsert logic to preserve quantity_received
    if (items !== undefined) {
      // Use transaction to ensure atomic updates
      await prisma.$transaction(async (tx) => {
        if (Array.isArray(items) && items.length > 0) {
          // Get existing items for this purchase order
          const existingItems = await tx.purchase_order_item.findMany({
            where: { order_id: id },
          });

          // Create maps for efficient lookup
          const existingById = new Map(
            existingItems.map((item) => [item.id, item]),
          );
          const existingByItemId = new Map(
            existingItems.map((item) => [item.item_id, item]),
          );
          const incomingItemIds = new Set();

          // Process each incoming item
          for (const item of items) {
            const itemData = {
              item_id: item.item_id,
              quantity: Number(item.quantity),
              notes: item.notes || null,
              unit_price:
                item.unit_price !== undefined &&
                item.unit_price !== null &&
                item.unit_price !== ""
                  ? Number(item.unit_price)
                  : null,
            };

            // Check if item exists by ID (preferred) or by item_id
            const existingItem =
              item.id && existingById.has(item.id)
                ? existingById.get(item.id)
                : existingByItemId.get(item.item_id);

            if (existingItem) {
              // Update existing item, preserving quantity_received
              incomingItemIds.add(existingItem.id);
              await tx.purchase_order_item.update({
                where: { id: existingItem.id },
                data: {
                  ...itemData,
                  // Preserve quantity_received - don't overwrite it
                  quantity_received: existingItem.quantity_received || 0,
                },
              });
            } else {
              // Create new item
              const newItem = await tx.purchase_order_item.create({
                data: {
                  ...itemData,
                  order_id: id,
                  quantity_received: 0, // New items start with 0 received
                },
              });
              incomingItemIds.add(newItem.id);
            }
          }

          // Delete items that are no longer in the incoming list
          const itemsToDelete = existingItems.filter(
            (item) => !incomingItemIds.has(item.id),
          );
          if (itemsToDelete.length > 0) {
            await tx.purchase_order_item.deleteMany({
              where: {
                id: { in: itemsToDelete.map((item) => item.id) },
              },
            });
          }
        } else {
          // Empty array - delete all items
          await tx.purchase_order_item.deleteMany({
            where: { order_id: id },
          });
        }
      });
    }

    const updated = await prisma.purchase_order.update({
      where: { id },
      data: updateData,
      include: {
        mto: {
          select: {
            project: { select: { project_id: true, name: true } },
            status: true,
          },
        },
        supplier: true,
        items: {
          include: {
            item: {
              include: {
                sheet: true,
                handle: true,
                hardware: true,
                accessory: true,
              },
            },
          },
        },
        orderedBy: {
          select: {
            employee: {
              select: { employee_id: true, first_name: true, last_name: true },
            },
          },
        },
        invoice_url: true,
      },
    });

    // Update MTO status if this PO is linked to MTO items
    if (updated.items && updated.items.length > 0) {
      const firstLinkedItem = updated.items.find((item) => item.mto_item_id);
      if (firstLinkedItem) {
        await checkAndUpdateMTOStatus(firstLinkedItem.mto_item_id);
      }
    }

    const logged = await withLogging(
      request,
      "purchase_order",
      id,
      "UPDATE",
      `Purchase order updated successfully for project: ${updated.mto?.project?.name}`,
    );
    if (!logged) {
      console.error(`Failed to log purchase order update: ${id}`);
    }
    return NextResponse.json(
      {
        status: true,
        message: "Purchase order updated successfully",
        data: updated,
        ...(logged
          ? {}
          : { warning: "Note: Update succeeded but logging failed" }),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in PATCH /api/v1/purchase_order/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await requireAuth(request, {
      modules: ["purchaseorder", "supplier_details"],
    });
    if (authError) return authError;
    const { id } = await params;
    const po = await prisma.purchase_order.delete({
      where: { id },
      include: {
        mto: {
          select: {
            project: { select: { project_id: true, name: true } },
          },
        },
      },
    });
    const logged = await withLogging(
      request,
      "purchase_order",
      id,
      "DELETE",
      `Purchase order deleted successfully for project: ${po.mto?.project?.name}`,
    );
    if (!logged) {
      console.error(`Failed to log purchase order deletion: ${id}`);
      return NextResponse.json(
        {
          status: true,
          message: "Purchase order deleted successfully",
          data: po,
          warning: "Note: Deletion succeeded but logging failed",
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Purchase order deleted successfully",
        data: po,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in DELETE /api/v1/purchase_order/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
