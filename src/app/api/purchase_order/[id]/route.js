import { NextResponse } from "next/server";
import path from "path";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { prisma } from "@/lib/db";
import { uploadFile, getFileFromFormData } from "@/lib/fileHandler";
import { withLogging } from "@/lib/withLogging";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
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
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/purchase_order/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
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
        { status: 404 }
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

    // Check if this is a receive operation (updating quantity_received)
    const receivedItems = body.received_items || body.items_received;
    if (receivedItems && Array.isArray(receivedItems)) {
      // This is a receive operation - update quantity_received for items and inventory
      // Filter out items with no updates (either new_delivery > 0 or quantity_received provided)
      const itemsToUpdate = receivedItems.filter(
        (item) =>
          (item.new_delivery !== undefined &&
            item.new_delivery !== null &&
            parseFloat(item.new_delivery || 0) > 0) ||
          (item.quantity_received !== undefined &&
            item.quantity_received !== null)
      );

      if (itemsToUpdate.length > 0) {
        // Fetch existing items to get current quantity_received and item_id
        const itemIds = itemsToUpdate.map((item) => item.id);
        const existingItems = await prisma.purchase_order_item.findMany({
          where: { id: { in: itemIds } },
          include: {
            item: {
              select: {
                item_id: true,
                quantity: true,
              },
            },
          },
        });

        // Create a map for quick lookup
        const existingItemsMap = new Map(
          existingItems.map((item) => [item.id, item])
        );

        // Update purchase_order_item and item inventory
        const updatePromises = itemsToUpdate.map(async (itemUpdate) => {
          const existingItem = existingItemsMap.get(itemUpdate.id);
          if (!existingItem) {
            throw new Error(`Purchase order item ${itemUpdate.id} not found`);
          }

          const currentReceived = parseInt(
            existingItem.quantity_received || 0,
            10
          );

          // Support both formats: quantity_received (total) or new_delivery (incremental)
          let newTotalReceived;
          let newDelivery;

          if (
            itemUpdate.quantity_received !== undefined &&
            itemUpdate.quantity_received !== null
          ) {
            // Frontend sends total quantity_received
            newTotalReceived = Math.floor(
              parseFloat(itemUpdate.quantity_received || 0)
            );
            newDelivery = newTotalReceived - currentReceived;
          } else if (
            itemUpdate.new_delivery !== undefined &&
            itemUpdate.new_delivery !== null
          ) {
            // Frontend sends incremental new_delivery
            newDelivery = Math.floor(parseFloat(itemUpdate.new_delivery || 0));
            newTotalReceived = currentReceived + newDelivery;
          } else {
            // Skip if neither is provided
            return null;
          }

          // Only update if there's actually a change
          if (newDelivery === 0) {
            return null;
          }

          // Update purchase_order_item quantity_received
          const poItemUpdate = prisma.purchase_order_item.update({
            where: { id: itemUpdate.id },
            data: {
              quantity_received: newTotalReceived,
            },
          });

          // Update item inventory quantity atomically (add new delivery to existing quantity)
          const itemUpdateOp = prisma.item.update({
            where: { item_id: existingItem.item_id },
            data: {
              quantity: {
                increment: newDelivery,
              },
            },
          });

          return Promise.all([poItemUpdate, itemUpdateOp]);
        });

        // Filter out null values (skipped items) before awaiting
        const validPromises = updatePromises.filter((p) => p !== null);
        if (validPromises.length > 0) {
          await Promise.all(validPromises);
        }
      }

      // Check if all items are fully received to update PO status
      const updatedPO = await prisma.purchase_order.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      const allItemsReceived = updatedPO.items.every(
        (item) => (item.quantity_received || 0) >= item.quantity
      );
      const someItemsReceived = updatedPO.items.some(
        (item) => (item.quantity_received || 0) > 0
      );

      let newStatus = existing.status;
      if (allItemsReceived && existing.status !== "CANCELLED") {
        newStatus = "FULLY_RECEIVED";
      } else if (
        someItemsReceived &&
        !allItemsReceived &&
        existing.status !== "CANCELLED"
      ) {
        newStatus = "PARTIALLY_RECEIVED";
      }

      // Fetch updated PO with all relations for return
      const finalPO = await prisma.purchase_order.findUnique({
        where: { id },
        include: {
          supplier: true,
          mto: {
            select: {
              project: { select: { project_id: true, name: true } },
              status: true,
            },
          },
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

      // Apply status update if needed
      if (newStatus !== existing.status) {
        await prisma.purchase_order.update({
          where: { id },
          data: { status: newStatus },
        });
        // Update finalPO status for response
        finalPO.status = newStatus;
      }

      return NextResponse.json(
        {
          status: true,
          message: "Received quantities updated successfully",
          data: finalPO,
        },
        { status: 200 }
      );
    }
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (
      body.total_amount !== undefined &&
      body.total_amount !== null &&
      body.total_amount !== ""
    )
      updateData.total_amount = Number(body.total_amount);
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
            existingItems.map((item) => [item.id, item])
          );
          const existingByItemId = new Map(
            existingItems.map((item) => [item.item_id, item])
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
            (item) => !incomingItemIds.has(item.id)
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

    const logged = await withLogging(
      request,
      "purchase_order",
      id,
      "UPDATE",
      `Purchase order updated successfully for project: ${updated.mto?.project?.name}`
    );
    if (!logged) {
      console.error(`Failed to log purchase order update: ${id}`);
    }
    return NextResponse.json(
      {
        status: true,
        message: "Purchase order updated successfully",
        data: updated,
        ...(logged ? {} : { warning: "Note: Update succeeded but logging failed" })
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in PATCH /api/purchase_order/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
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
      `Purchase order deleted successfully for project: ${po.mto?.project?.name}`
    );
    if (!logged) {
      console.error(`Failed to log purchase order deletion: ${id}`);
      return NextResponse.json(
        { 
          status: true, 
          message: "Purchase order deleted successfully",
          data: po,
          warning: "Note: Deletion succeeded but logging failed"
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Purchase order deleted successfully",
        data: po,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in DELETE /api/purchase_order/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
