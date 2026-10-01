import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/validators/authFromToken";
import { prisma } from "@/lib/db";
import {
  uploadFile,
  deleteFileByRelativePath,
  getFileFromFormData,
  MAX_DOCUMENT_BODY,
  MAX_DOCUMENT_SIZE,
  readFormData,
  uploadLimitResponse,
} from "@/lib/fileHandler";
import { withLogging } from "@/lib/withLogging";
import { checkAndUpdateMTOStatus } from "@/lib/mtoStatusHelper";
import { TransactionError } from "@/lib/transactionError";
import { parseMoney } from "@/lib/money";
import {
  addDelta,
  applyMtoOrderedDeltas,
  loadMtoItems,
  mtoTargetId,
  releaseDeltas,
} from "@/lib/purchaseOrderMto";

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

// Statuses a client may set by hand. The two receive statuses are derived from
// what has actually been received (POST /purchase_order/received_items).
const MANUAL_STATUSES = ["DRAFT", "ORDERED", "CANCELLED"];
const RECEIVE_STATUSES = ["PARTIALLY_RECEIVED", "FULLY_RECEIVED"];
const ALL_STATUSES = [
  "DRAFT",
  "ORDERED",
  "PARTIALLY_RECEIVED",
  "FULLY_RECEIVED",
  "CANCELLED",
];

const hasReceived = (lines) =>
  lines.some((line) => (line.quantity_received || 0) > 0);

function badRequest(message) {
  return NextResponse.json({ status: false, message }, { status: 400 });
}

// The `items` field: a JSON array, one JSON object, or comma-separated
// objects without brackets. null when it was sent but is not usable.
function parseItemsField(itemsVal) {
  if (typeof itemsVal !== "string") return itemsVal;
  let parsed;
  try {
    parsed = JSON.parse(itemsVal);
  } catch {
    const trimmed = itemsVal.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        parsed = JSON.parse(`[${trimmed}]`);
      } catch {
        parsed = undefined;
      }
    }
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") return [parsed];
  return null;
}

const PO_RESULT_INCLUDE = {
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
};

export async function PATCH(request, { params }) {
  let uploadedRelativePath;
  try {
    const authError = await requireAuth(request, {
      modules: ["purchaseorder", "supplier_details"],
    });
    if (authError) return authError;
    const { id } = await params;

    // Fetch existing PO to get defaults (e.g. order_no for file naming)
    const existing = await prisma.purchase_order.findUnique({
      where: { id },
      select: { order_no: true },
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
    let invoiceFile; // optional new invoice, uploaded once everything is valid

    if (contentType.includes("multipart/form-data")) {
      const form = await readFormData(request, MAX_DOCUMENT_BODY);

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
      body.total_amount = total_amount_raw ?? undefined;
      body.delivery_charge = delivery_charge_raw ?? undefined;
      body.invoice_date = invoice_date_raw ?? undefined;
      body.notes = notes;
      // Handle invoice_url deletion (can be "null" string or null)
      if (invoice_url_raw === "null" || invoice_url_raw === null) {
        body.invoice_url = null;
      }

      const itemsVal = form.get("items");
      if (itemsVal) {
        items = parseItemsField(itemsVal);
        if (items === null) return badRequest("items must be valid JSON");
      }

      invoiceFile =
        getFileFromFormData(form, "invoice") ||
        getFileFromFormData(form, "file");
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
      return badRequest(
        "Receiving items is not supported on this endpoint. Use POST /api/v1/purchase_order/received_items",
      );
    }

    // ---- Validate everything before anything is written ----
    const requestedStatus = body.status;
    if (requestedStatus !== undefined) {
      if (!ALL_STATUSES.includes(requestedStatus)) {
        return badRequest(
          `Invalid status. Must be one of: ${ALL_STATUSES.join(", ")}`,
        );
      }
      if (RECEIVE_STATUSES.includes(requestedStatus)) {
        return badRequest(
          `Status ${requestedStatus} is set automatically when items are received. You can set: ${MANUAL_STATUSES.join(", ")}`,
        );
      }
    }

    const isSet = (value) =>
      value !== undefined && value !== null && value !== "";
    for (const field of ["total_amount", "delivery_charge"]) {
      if (isSet(body[field]) && parseMoney(body[field]) === null) {
        return badRequest(`${field} must be a non-negative amount`);
      }
    }
    for (const field of ["invoice_date", "ordered_at"]) {
      if (isSet(body[field]) && Number.isNaN(new Date(body[field]).getTime())) {
        return badRequest(`${field} is not a valid date`);
      }
    }

    // Replacement lines
    let incoming; // normalised lines, or undefined when items were not sent
    if (items !== undefined) {
      if (!Array.isArray(items)) {
        return badRequest("items must be an array");
      }
      incoming = [];
      for (const [index, raw] of items.entries()) {
        const label = `Item ${index + 1}`;
        if (!raw || typeof raw !== "object" || !raw.item_id) {
          return badRequest(`${label}: item_id is required`);
        }
        const quantity = Number(raw.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          return badRequest(
            `${label}: quantity must be a positive whole number`,
          );
        }
        const unitPrice = parseMoney(raw.unit_price);
        if (unitPrice === null) {
          return badRequest(
            `${label}: unit_price must be a non-negative amount`,
          );
        }
        incoming.push({
          id: raw.id,
          item_id: raw.item_id,
          quantity,
          notes: raw.notes || null,
          unit_price: unitPrice === undefined ? null : Number(unitPrice),
          mto_item_id: raw.mto_item_id || undefined,
        });
      }

      if (incoming.length > 0) {
        const itemIds = [...new Set(incoming.map((l) => l.item_id))];
        const found = await prisma.item.findMany({
          where: { item_id: { in: itemIds }, is_deleted: false },
          select: { item_id: true },
        });
        const foundIds = new Set(found.map((i) => i.item_id));
        const missing = itemIds.find((itemId) => !foundIds.has(itemId));
        if (missing) {
          return NextResponse.json(
            { status: false, message: `Item not found: ${missing}` },
            { status: 404 },
          );
        }
      }
    }

    // The invoice has to be on disk before its record can be created; if
    // anything below fails it is removed again. The "unique" strategy gives
    // every request its own path, so that cleanup can't touch another file.
    let uploadResult;
    if (invoiceFile) {
      uploadResult = await uploadFile(invoiceFile, {
        uploadDir: "mediauploads",
        subDir: "purchase_order",
        filenameStrategy: "unique",
        allowedGroups: ["pdf", "image", "office"],
        maxSize: MAX_DOCUMENT_SIZE,
        idPrefix: existing.order_no, // immutable
      });
      uploadedRelativePath = uploadResult.relativePath;
    }

    // ---- Everything that changes the PO happens under its row lock ----
    const { updated, deltas } = await prisma.$transaction(async (tx) => {
      // Same lock as received_items, so edits and deliveries can't interleave
      await tx.$queryRaw`
        SELECT id FROM purchase_order
        WHERE id = ${id}
        FOR UPDATE
      `;

      const po = await tx.purchase_order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!po) {
        throw new TransactionError("Purchase order not found", 404);
      }

      const anyReceived = hasReceived(po.items);
      const mtoItems = await loadMtoItems(tx, po.mto_id);
      // lines only count against an MTO when the PO has one
      const targetOf = (line) =>
        po.mto_id ? mtoTargetId(line, mtoItems) : undefined;
      const deltas = new Map();

      // -- status --
      let cancelling = false;
      let newStatus;
      if (requestedStatus !== undefined && requestedStatus !== po.status) {
        if (po.status === "CANCELLED") {
          throw new TransactionError(
            "A cancelled purchase order can't be reopened. Create a new one instead.",
            409,
          );
        }
        if (requestedStatus === "CANCELLED") {
          if (po.status === "FULLY_RECEIVED") {
            throw new TransactionError(
              "This purchase order has been fully received, so there is nothing left to cancel.",
              409,
            );
          }
          cancelling = true;
        } else if (anyReceived) {
          throw new TransactionError(
            `Items have already been received against this purchase order, so its status can't be set back to ${requestedStatus}.`,
            409,
          );
        }
        newStatus = requestedStatus;
      }

      // Cancelling gives the part that was never received back to the MTO
      if (cancelling) {
        for (const [mtoItemId, delta] of releaseDeltas(
          po.items.filter((line) => targetOf(line)),
          mtoItems,
        )) {
          addDelta(deltas, mtoItemId, delta);
        }
      }

      // -- lines --
      let linesChanged = false;
      if (incoming !== undefined) {
        if (po.status === "CANCELLED" || cancelling) {
          throw new TransactionError(
            "Lines of a cancelled purchase order can't be edited.",
            409,
          );
        }

        // Match each incoming line to a stored one: by id, else by item
        const claimed = new Set();
        const matched = incoming.map((line) => {
          let match =
            line.id &&
            po.items.find((l) => l.id === line.id && !claimed.has(l.id));
          if (!match) {
            match = po.items.find(
              (l) => !claimed.has(l.id) && l.item_id === line.item_id,
            );
          }
          if (match) claimed.add(match.id);
          return { line, match };
        });

        // Received stock can't be rewritten or walked back
        for (const { line, match } of matched) {
          if (match) {
            const received = match.quantity_received || 0;
            if (received > 0 && line.item_id !== match.item_id) {
              throw new TransactionError(
                `Can't change the item of a line that already has ${received} received.`,
                409,
              );
            }
            if (line.quantity < received) {
              throw new TransactionError(
                `Quantity can't be lower than the ${received} already received for item ${match.item_id}.`,
                409,
              );
            }
          } else if (po.status === "FULLY_RECEIVED") {
            throw new TransactionError(
              "A fully received purchase order can't take new lines.",
              409,
            );
          }
        }
        const removed = po.items.filter((l) => !claimed.has(l.id));
        for (const line of removed) {
          if ((line.quantity_received || 0) > 0) {
            throw new TransactionError(
              `Can't remove the line for item ${line.item_id}: ${line.quantity_received} have been received.`,
              409,
            );
          }
        }

        // Write the lines and work out what the MTO lines gain or lose
        for (const { line, match } of matched) {
          if (match) {
            const oldTarget = targetOf(match);
            const newTarget =
              line.item_id === match.item_id
                ? oldTarget
                : targetOf({ item_id: line.item_id });
            addDelta(deltas, oldTarget, -match.quantity);
            addDelta(deltas, newTarget, line.quantity);

            await tx.purchase_order_item.update({
              where: { id: match.id },
              data: {
                item_id: line.item_id,
                quantity: line.quantity,
                notes: line.notes,
                unit_price: line.unit_price,
                // quantity_received is never written here
              },
            });
          } else {
            if (
              line.mto_item_id &&
              !mtoItems.some((mi) => mi.id === line.mto_item_id)
            ) {
              throw new TransactionError(
                "mto_item_id does not belong to this purchase order's materials to order.",
                400,
              );
            }
            const target = po.mto_id
              ? (line.mto_item_id ?? targetOf({ item_id: line.item_id }))
              : undefined;
            addDelta(deltas, target, line.quantity);

            await tx.purchase_order_item.create({
              data: {
                item_id: line.item_id,
                quantity: line.quantity,
                notes: line.notes,
                unit_price: line.unit_price,
                mto_item_id: target,
                order_id: id,
                quantity_received: 0, // new lines start with nothing received
              },
            });
          }
        }
        if (removed.length > 0) {
          for (const line of removed) {
            addDelta(deltas, targetOf(line), -line.quantity);
          }
          await tx.purchase_order_item.deleteMany({
            where: { id: { in: removed.map((l) => l.id) } },
          });
        }
        linesChanged = true;
      }

      // Lowering a quantity down to what was received completes the order
      if (
        linesChanged &&
        newStatus === undefined &&
        ["ORDERED", "PARTIALLY_RECEIVED"].includes(po.status)
      ) {
        const fresh = await tx.purchase_order_item.findMany({
          where: { order_id: id },
        });
        if (
          fresh.length > 0 &&
          hasReceived(fresh) &&
          fresh.every((l) => (l.quantity_received || 0) >= l.quantity)
        ) {
          newStatus = "FULLY_RECEIVED";
        }
      }

      await applyMtoOrderedDeltas(tx, deltas);

      // -- header fields --
      const updateData = {};

      // Handle invoice soft deletion if invoice_url is explicitly set to null
      if (body.invoice_url === null || body.invoice_url_id === null) {
        if (po.invoice_url_id) {
          // Soft delete: Mark the supplier_file as deleted instead of permanently deleting
          await tx.supplier_file.update({
            where: { id: po.invoice_url_id },
            data: { is_deleted: true },
          });

          // Set invoice_url_id to null in updateData to unlink from purchase_order
          updateData.invoice_url_id = null;
        }
      }
      if (uploadResult) {
        const createdFile = await tx.supplier_file.create({
          data: {
            url: uploadResult.relativePath,
            filename: uploadResult.filename,
            file_type: "invoice",
            mime_type: uploadResult.mimeType,
            extension: uploadResult.extension,
            size: uploadResult.size,
          },
        });
        updateData.invoice_url_id = createdFile.id;
      }

      if (newStatus !== undefined) updateData.status = newStatus;
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (isSet(body.total_amount))
        updateData.total_amount = Number(body.total_amount);
      if (isSet(body.delivery_charge))
        updateData.delivery_charge = Number(body.delivery_charge);
      if (isSet(body.invoice_date))
        updateData.invoice_date = new Date(body.invoice_date);
      if (isSet(body.ordered_at))
        updateData.ordered_at = new Date(body.ordered_at);

      const updated = await tx.purchase_order.update({
        where: { id },
        data: updateData,
        include: PO_RESULT_INCLUDE,
      });

      return { updated, deltas };
    });
    uploadedRelativePath = undefined; // committed: the file is now referenced

    // Update MTO status if this PO feeds MTO lines
    const affectedMtoItemId =
      deltas.keys().next().value ??
      updated.items?.find((item) => item.mto_item_id)?.mto_item_id;
    if (affectedMtoItemId) {
      await checkAndUpdateMTOStatus(affectedMtoItemId);
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
    // Nothing was committed, so don't leave the uploaded invoice behind
    if (uploadedRelativePath) {
      try {
        await deleteFileByRelativePath(uploadedRelativePath);
      } catch (cleanupError) {
        console.error("Failed to remove orphaned invoice file:", cleanupError);
      }
    }

    if (error instanceof TransactionError) {
      return NextResponse.json(
        { status: false, message: error.message },
        { status: error.status },
      );
    }

    const tooLarge = uploadLimitResponse(error);
    if (tooLarge) return tooLarge;

    console.error("Error in PATCH /api/v1/purchase_order/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

// "Deleting" a purchase order cancels it: the PO and its lines stay for the
// audit trail, and what it had asked for is given back to the MTO. A PO that
// has received stock can't be deleted at all.
export async function DELETE(request, { params }) {
  try {
    const authError = await requireAuth(request, {
      modules: ["purchaseorder", "supplier_details"],
    });
    if (authError) return authError;
    const { id } = await params;

    const { po, deltas, alreadyCancelled } = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM purchase_order
          WHERE id = ${id}
          FOR UPDATE
        `;

        const current = await tx.purchase_order.findUnique({
          where: { id },
          include: {
            items: true,
            mto: {
              select: {
                project: { select: { project_id: true, name: true } },
              },
            },
          },
        });
        if (!current) {
          throw new TransactionError("Purchase order not found", 404);
        }

        if (current.status === "CANCELLED") {
          return { po: current, deltas: new Map(), alreadyCancelled: true };
        }

        if (hasReceived(current.items)) {
          throw new TransactionError(
            "Items have already been received against this purchase order, so it can't be deleted. Cancel it instead to stop the rest being delivered.",
            409,
          );
        }

        const mtoItems = await loadMtoItems(tx, current.mto_id);
        const deltas = current.mto_id
          ? releaseDeltas(current.items, mtoItems)
          : new Map();
        await applyMtoOrderedDeltas(tx, deltas);

        const cancelled = await tx.purchase_order.update({
          where: { id },
          data: { status: "CANCELLED" },
          include: {
            mto: {
              select: {
                project: { select: { project_id: true, name: true } },
              },
            },
          },
        });
        return { po: cancelled, deltas, alreadyCancelled: false };
      },
    );

    if (alreadyCancelled) {
      return NextResponse.json(
        {
          status: true,
          message: "Purchase order is already cancelled",
          data: po,
        },
        { status: 200 },
      );
    }

    const firstAffected = deltas.keys().next().value;
    if (firstAffected) {
      await checkAndUpdateMTOStatus(firstAffected);
    }

    const logged = await withLogging(
      request,
      "purchase_order",
      id,
      "DELETE",
      `Purchase order deleted (cancelled) for project: ${po.mto?.project?.name}`,
    );
    if (!logged) {
      console.error(`Failed to log purchase order deletion: ${id}`);
      return NextResponse.json(
        {
          status: true,
          message: "Purchase order cancelled successfully",
          data: po,
          warning: "Note: Deletion succeeded but logging failed",
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Purchase order cancelled successfully",
        data: po,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof TransactionError) {
      return NextResponse.json(
        { status: false, message: error.message },
        { status: error.status },
      );
    }
    console.error("Error in DELETE /api/v1/purchase_order/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
