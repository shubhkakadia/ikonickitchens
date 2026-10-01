import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromToken, requireAuth } from "@/lib/validators/authFromToken";
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
import { Decimal, parseMoney, toCents } from "@/lib/money";

// A new purchase order is either a draft or already ordered (that is what both
// create forms send). Received and cancelled states are only reached through
// the receiving and cancel flows, never by the client at creation time.
const CREATABLE_STATUSES = ["DRAFT", "ORDERED"];

function badRequest(message) {
  return NextResponse.json({ status: false, message }, { status: 400 });
}

// Parses the `items` form field: a JSON array, a single JSON object, or
// comma-separated objects without brackets. Returns undefined when absent and
// null when it was sent but is not usable.
function parseItems(itemsVal) {
  if (!itemsVal) return undefined;
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

export async function POST(request) {
  let uploadedRelativePath;
  try {
    const authError = await requireAuth(request, {
      modules: ["purchaseorder", "supplier_details", "materialstoorder"],
    });
    if (authError) return authError;

    // The ordering user is whoever is signed in, never a form field
    const session = await getUserFromToken(request);
    if (!session) {
      return NextResponse.json(
        { status: false, message: "Invalid session" },
        { status: 401 },
      );
    }
    const orderedBy_id = session.user_id;

    // Parse FormData
    const form = await readFormData(request, MAX_DOCUMENT_BODY);

    const supplier_id = form.get("supplier_id") || undefined;
    const mto_id = form.get("mto_id") || undefined;
    const order_no = form.get("order_no") || undefined;
    const notes = form.get("notes") || undefined;
    const requestedStatus = form.get("status") || undefined;

    // Validate required fields
    if (!supplier_id) {
      return badRequest("supplier_id is required");
    }

    if (!order_no) {
      return badRequest("order_no is required");
    }

    if (!/^[A-Za-z0-9_-]{1,100}$/.test(String(order_no).trim())) {
      return badRequest(
        "order_no may only contain letters, numbers, hyphens and underscores",
      );
    }

    if (requestedStatus && !CREATABLE_STATUSES.includes(requestedStatus)) {
      return badRequest(
        `status must be one of: ${CREATABLE_STATUSES.join(", ")}`,
      );
    }
    // Left undefined for DRAFT so the database default applies
    const status = requestedStatus === "ORDERED" ? "ORDERED" : undefined;

    // total_amount from the form is ignored: totals are computed below
    const deliveryChargeRaw = form.get("delivery_charge");
    const deliveryCharge = parseMoney(deliveryChargeRaw);
    if (deliveryCharge === null) {
      return badRequest("delivery_charge must be a non-negative amount");
    }
    const delivery_charge =
      deliveryCharge === undefined ? undefined : toCents(deliveryCharge);

    const invoiceDateStr = form.get("invoice_date");
    let invoice_date;
    if (
      invoiceDateStr !== null &&
      invoiceDateStr !== undefined &&
      invoiceDateStr !== ""
    ) {
      invoice_date = new Date(invoiceDateStr);
      if (Number.isNaN(invoice_date.getTime())) {
        return badRequest("invoice_date is not a valid date");
      }
    }

    let mtoItems = [];
    if (mto_id) {
      const mto = await prisma.materials_to_order.findUnique({
        where: { id: mto_id },
        select: { is_deleted: true },
      });
      if (!mto || mto.is_deleted) {
        return NextResponse.json(
          { status: false, message: "Materials to order not found" },
          { status: 404 },
        );
      }
      mtoItems = await prisma.materials_to_order_item.findMany({
        where: { mto_id },
        select: {
          id: true,
          item_id: true,
          quantity: true,
          quantity_ordered_po: true,
        },
      });
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

    // Parse and validate the lines
    const items = parseItems(form.get("items"));
    if (items === null || (items !== undefined && !Array.isArray(items))) {
      return badRequest("items must be valid JSON");
    }

    // Money and quantities are computed here from quantity, unit price and
    // GST; any total_amount sent per line is not trusted when there is a price.
    const lines = [];
    for (const [index, raw] of (items ?? []).entries()) {
      const label = `Item ${index + 1}`;
      if (!raw || typeof raw !== "object" || !raw.item_id) {
        return badRequest(`${label}: item_id is required`);
      }

      const quantity = Number(raw.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return badRequest(`${label}: quantity must be a positive whole number`);
      }

      const unitPrice = parseMoney(raw.unit_price);
      const gst = parseMoney(raw.gst);
      const clientTotal = parseMoney(raw.total_amount);
      if (unitPrice === null || gst === null || clientTotal === null) {
        return badRequest(
          `${label}: unit_price, gst and total_amount must be non-negative amounts`,
        );
      }

      const lineTotal =
        unitPrice !== undefined
          ? toCents(unitPrice.times(quantity))
          : clientTotal !== undefined
            ? toCents(clientTotal)
            : undefined;

      if (raw.mto_item_id) {
        if (!mto_id) {
          return badRequest(`${label}: mto_item_id requires mto_id`);
        }
        if (!mtoItems.some((mi) => mi.id === raw.mto_item_id)) {
          return badRequest(
            `${label}: mto_item_id does not belong to this materials to order`,
          );
        }
      }

      lines.push({
        item_id: raw.item_id,
        mto_item_id: raw.mto_item_id || undefined,
        quantity,
        notes: raw.notes,
        unit_price: unitPrice === undefined ? undefined : toCents(unitPrice),
        gst: gst === undefined ? undefined : toCents(gst),
        total_amount: lineTotal,
      });
    }

    // Grand total = sum of line totals + sum of GST
    const grandTotal = lines.reduce(
      (sum, line) => sum.plus(line.total_amount ?? 0).plus(line.gst ?? 0),
      new Decimal(0),
    );

    // The supplier and every item must exist (otherwise the insert fails on a
    // foreign key and the caller sees a 500)
    const supplier = await prisma.supplier.findUnique({
      where: { supplier_id },
      select: { supplier_id: true, is_deleted: true },
    });
    if (!supplier || supplier.is_deleted) {
      return NextResponse.json(
        { status: false, message: "Supplier not found" },
        { status: 404 },
      );
    }

    if (lines.length > 0) {
      const itemIds = [...new Set(lines.map((l) => l.item_id))];
      const found = await prisma.item.findMany({
        where: { item_id: { in: itemIds }, is_deleted: false },
        select: { item_id: true },
      });
      const foundIds = new Set(found.map((i) => i.item_id));
      const missing = itemIds.find((id) => !foundIds.has(id));
      if (missing) {
        return NextResponse.json(
          { status: false, message: `Item not found: ${missing}` },
          { status: 404 },
        );
      }
    }

    // How much each MTO line is being ordered by this PO. Lines are matched by
    // mto_item_id when given, otherwise by item; several lines for the same
    // item all count.
    const orderedByMtoItem = new Map();
    if (mto_id) {
      for (const line of lines) {
        const target =
          line.mto_item_id ??
          mtoItems.find((mi) => mi.item_id === line.item_id)?.id;
        if (!target) continue;
        // Remember which MTO line this line counts against, so editing or
        // cancelling the PO later can give exactly this quantity back
        line.mto_item_id = target;
        orderedByMtoItem.set(
          target,
          (orderedByMtoItem.get(target) || 0) + line.quantity,
        );
      }
    }

    // Handle file upload (the file has to be on disk before its record can be
    // created; if anything below fails, it is removed again)
    const file =
      getFileFromFormData(form, "invoice") || getFileFromFormData(form, "file");
    let uploadResult;
    if (file) {
      // Upload file with order_no as the filename base. The "unique" strategy
      // adds a timestamp and random suffix, so two requests for the same
      // order number never share a path; the cleanup below can then only ever
      // remove the file this request wrote.
      uploadResult = await uploadFile(file, {
        uploadDir: "mediauploads",
        subDir: "purchase_order",
        filenameStrategy: "unique",
        allowedGroups: ["pdf", "image", "office"],
        maxSize: MAX_DOCUMENT_SIZE,
        idPrefix: order_no,
      });
      uploadedRelativePath = uploadResult.relativePath;
    }

    // The file record, the PO with its lines, and the MTO quantities are
    // created together or not at all
    const result = await prisma.$transaction(async (tx) => {
      let invoice_url_id;
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
        invoice_url_id = createdFile.id;
      }

      const createdPO = await tx.purchase_order.create({
        data: {
          supplier_id,
          mto_id,
          order_no,
          orderedBy_id,
          invoice_url_id,
          total_amount: toCents(grandTotal), // grand total (line totals + GST)
          delivery_charge,
          invoice_date,
          notes,
          items: lines.length > 0 ? { create: lines } : undefined,
          status,
        },
        include: { items: true },
      });

      // Add what this PO orders to each MTO line. An atomic increment, so
      // concurrent purchase orders can't overwrite each other's quantities.
      for (const [mtoItemId, quantity] of orderedByMtoItem) {
        await tx.materials_to_order_item.update({
          where: { id: mtoItemId },
          data: { quantity_ordered_po: { increment: quantity } },
        });
      }

      return createdPO;
    });
    uploadedRelativePath = undefined; // committed: the file is now referenced

    // Update MTO status after transaction (considers both ordered items and reservations)
    const firstMtoItemId = orderedByMtoItem.keys().next().value;
    if (firstMtoItemId) {
      await checkAndUpdateMTOStatus(firstMtoItemId);
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
    // Nothing was committed, so don't leave the uploaded invoice behind
    if (uploadedRelativePath) {
      try {
        await deleteFileByRelativePath(uploadedRelativePath);
      } catch (cleanupError) {
        console.error("Failed to remove orphaned invoice file:", cleanupError);
      }
    }

    const tooLarge = uploadLimitResponse(error);
    if (tooLarge) return tooLarge;

    // Another request took the same order number between the check and insert
    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          status: false,
          message: "A purchase order with this order number already exists",
        },
        { status: 409 },
      );
    }

    console.error("Error in POST /api/v1/purchase_order/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
