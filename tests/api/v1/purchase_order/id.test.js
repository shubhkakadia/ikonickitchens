// Tests for src/app/api/v1/purchase_order/[id]/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import {
  buildRequest,
  formBody,
  routeContext,
  testFile,
} from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

// Keep the real form-parsing helpers; stub the disk operations.
vi.mock("@/lib/fileHandler", async (importOriginal) => ({
  ...(await importOriginal()),
  uploadFile: vi.fn(),
}));
vi.mock("@/lib/mtoStatusHelper", () => ({ checkAndUpdateMTOStatus: vi.fn() }));

const { GET, PATCH, DELETE } =
  await import("@/app/api/v1/purchase_order/[id]/route");
const { uploadFile } = await import("@/lib/fileHandler");
const { checkAndUpdateMTOStatus } = await import("@/lib/mtoStatusHelper");

const ID = "po-1";
const URL = `/api/v1/purchase_order/${ID}`;
const ctx = () => routeContext({ id: ID });
const MODULES = ["purchaseorder", "supplier_details"];

const storedPo = (overrides = {}) => ({
  id: ID,
  order_no: "PO-1001",
  status: "DRAFT",
  invoice_url_id: null,
  items: [],
  ...overrides,
});

describe("GET /api/v1/purchase_order/[id]", () => {
  const get = (options) => GET(buildRequest(URL, options), ctx());

  describeAuthorization(get, {
    modules: MODULES,
    setup: () =>
      prismaMock.purchase_order.findUnique.mockResolvedValue(storedPo()),
    untouched: () => [prismaMock.purchase_order.findUnique],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.purchase_order.findUnique.mockResolvedValue(storedPo());
    });

    it("returns the purchase order", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Purchase order fetched successfully",
        data: storedPo(),
      });
      expect(prismaMock.purchase_order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ID } }),
      );
    });

    // Current behaviour: a missing purchase order is not a 404.
    it("returns 200 with null data when it does not exist", async () => {
      prismaMock.purchase_order.findUnique.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toBeNull();
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.purchase_order.findUnique.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});

describe("PATCH /api/v1/purchase_order/[id]", () => {
  const patchJson = (body = { notes: "New note" }, options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());
  const patchForm = (fields = {}, options = {}) =>
    PATCH(
      buildRequest(URL, {
        method: "PATCH",
        body: formBody(fields),
        ...options,
      }),
      ctx(),
    );

  const updated = (overrides = {}) => ({
    ...storedPo(),
    mto: { project: { name: "Smith House" }, status: "DRAFT" },
    ...overrides,
  });

  function mockUpdate({
    existing = storedPo(),
    existingItems = [],
    result,
  } = {}) {
    prismaMock.purchase_order.findUnique.mockResolvedValue(existing);
    prismaMock.purchase_order.update.mockImplementation(
      async ({ data }) => result ?? updated(data),
    );
    prismaMock.purchase_order_item.findMany.mockResolvedValue(existingItems);
    prismaMock.purchase_order_item.update.mockResolvedValue({});
    prismaMock.purchase_order_item.create.mockImplementation(
      async ({ data }) => ({
        id: "poi-new",
        ...data,
      }),
    );
    prismaMock.purchase_order_item.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.supplier_file.update.mockResolvedValue({});
    prismaMock.supplier_file.create.mockResolvedValue({ id: "file-new" });
    prismaMock.logs.create.mockResolvedValue({});
    uploadFile.mockResolvedValue({
      relativePath: "mediauploads/purchase_order/PO-1001-x.pdf",
      filename: "PO-1001-x.pdf",
      mimeType: "application/pdf",
      extension: "pdf",
      size: 100,
    });
    checkAndUpdateMTOStatus.mockResolvedValue(false);
  }

  const updateData = () =>
    prismaMock.purchase_order.update.mock.calls[0][0].data;

  describeAuthorization((options) => patchJson(undefined, options), {
    modules: MODULES,
    setup: () => mockUpdate(),
    untouched: () => [
      prismaMock.purchase_order.findUnique,
      prismaMock.purchase_order.update,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    describe("JSON updates", () => {
      it("updates the allowed fields and logs the update", async () => {
        const res = await patchJson({
          status: "ORDERED",
          notes: "Chase supplier",
          total_amount: "120.5",
          delivery_charge: 10,
          invoice_date: "2026-03-02",
          ordered_at: "2026-03-01",
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.message).toBe("Purchase order updated successfully");
        expect(json.warning).toBeUndefined();
        expect(prismaMock.purchase_order.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: ID } }),
        );
        expect(updateData()).toEqual({
          status: "ORDERED",
          notes: "Chase supplier",
          total_amount: 120.5,
          delivery_charge: 10,
          invoice_date: new Date("2026-03-02"),
          ordered_at: new Date("2026-03-01"),
        });
        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: {
            user_id: "user-1",
            entity_type: "purchase_order",
            entity_id: ID,
            action: "UPDATE",
            description:
              "Purchase order updated successfully for project: Smith House",
          },
        });
      });

      it("only updates fields that were sent, and ignores others", async () => {
        await patchJson({
          notes: "x",
          order_no: "HACK",
          supplier_id: "S2",
          id: "z",
        });

        expect(updateData()).toEqual({ notes: "x" });
      });

      it.each([
        ["total_amount", { total_amount: null }],
        ["total_amount", { total_amount: "" }],
        ["delivery_charge", { delivery_charge: "" }],
        ["invoice_date", { invoice_date: null }],
        ["ordered_at", { ordered_at: "" }],
      ])(
        "leaves %s unchanged for a null or empty value",
        async (field, body) => {
          await patchJson(body);

          expect(updateData()).not.toHaveProperty(field);
        },
      );

      it("allows clearing notes with an empty string", async () => {
        await patchJson({ notes: "" });

        expect(updateData()).toEqual({ notes: "" });
      });

      it.each([
        "DRAFT",
        "ORDERED",
        "PARTIALLY_RECEIVED",
        "FULLY_RECEIVED",
        "CANCELLED",
      ])("accepts status %s", async (status) => {
        const res = await patchJson({ status });

        expect(res.status).toBe(200);
        expect(updateData().status).toBe(status);
      });

      it("returns 400 for an invalid status", async () => {
        const res = await patchJson({ status: "SHIPPED" });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Invalid status. Must be one of: DRAFT, ORDERED, PARTIALLY_RECEIVED, FULLY_RECEIVED, CANCELLED",
        });
        expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
      });

      it.each([
        ["received_items", { received_items: [] }],
        ["items_received", { items_received: [] }],
      ])(
        "rejects %s and points to the received_items endpoint",
        async (_, body) => {
          const res = await patchJson({ notes: "x", ...body });

          expect(res.status).toBe(400);
          expect(await res.json()).toEqual({
            status: false,
            message:
              "Receiving items is not supported on this endpoint. Use POST /api/v1/purchase_order/received_items",
          });
          expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
        },
      );

      it("returns 404 when the purchase order does not exist", async () => {
        prismaMock.purchase_order.findUnique.mockResolvedValue(null);

        const res = await patchJson();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Purchase order not found",
        });
        expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
      });
    });

    describe("items", () => {
      const existingItems = () => [
        { id: "poi-a", item_id: "A", quantity: 5, quantity_received: 2 },
        { id: "poi-b", item_id: "B", quantity: 3, quantity_received: 0 },
      ];

      it("does not touch items when items is not sent", async () => {
        await patchJson({ notes: "x" });

        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(prismaMock.purchase_order_item.findMany).not.toHaveBeenCalled();
      });

      it("updates matching items by id, preserving quantity_received", async () => {
        mockUpdate({ existingItems: existingItems() });

        await patchJson({
          items: [
            {
              id: "poi-a",
              item_id: "A",
              quantity: "8",
              unit_price: "2.5",
              notes: "n",
            },
            { id: "poi-b", item_id: "B", quantity: 3 },
          ],
        });

        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
        expect(prismaMock.purchase_order_item.update).toHaveBeenCalledWith({
          where: { id: "poi-a" },
          data: {
            item_id: "A",
            quantity: 8,
            notes: "n",
            unit_price: 2.5,
            quantity_received: 2,
          },
        });
        expect(prismaMock.purchase_order_item.update).toHaveBeenCalledWith({
          where: { id: "poi-b" },
          data: {
            item_id: "B",
            quantity: 3,
            notes: null,
            unit_price: null,
            quantity_received: 0,
          },
        });
        expect(
          prismaMock.purchase_order_item.deleteMany,
        ).not.toHaveBeenCalled();
      });

      it("matches a line without an id by its item_id", async () => {
        mockUpdate({ existingItems: existingItems() });

        await patchJson({
          items: [
            { item_id: "A", quantity: 6 },
            { item_id: "B", quantity: 3 },
          ],
        });

        expect(prismaMock.purchase_order_item.update).toHaveBeenCalledTimes(2);
        expect(prismaMock.purchase_order_item.create).not.toHaveBeenCalled();
      });

      it("creates new lines with nothing received", async () => {
        mockUpdate({ existingItems: existingItems() });

        await patchJson({
          items: [
            { id: "poi-a", item_id: "A", quantity: 5 },
            { id: "poi-b", item_id: "B", quantity: 3 },
            { item_id: "C", quantity: 4, unit_price: 9 },
          ],
        });

        expect(prismaMock.purchase_order_item.create).toHaveBeenCalledWith({
          data: {
            item_id: "C",
            quantity: 4,
            notes: null,
            unit_price: 9,
            order_id: ID,
            quantity_received: 0,
          },
        });
      });

      it("deletes lines that are no longer in the list", async () => {
        mockUpdate({ existingItems: existingItems() });

        await patchJson({
          items: [{ id: "poi-a", item_id: "A", quantity: 5 }],
        });

        expect(prismaMock.purchase_order_item.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ["poi-b"] } },
        });
      });

      it("deletes every line when items is an empty array", async () => {
        mockUpdate({ existingItems: existingItems() });

        await patchJson({ items: [] });

        expect(prismaMock.purchase_order_item.deleteMany).toHaveBeenCalledWith({
          where: { order_id: ID },
        });
        expect(prismaMock.purchase_order_item.findMany).not.toHaveBeenCalled();
      });

      // Current behaviour (risky): any defined non-array value, such as null,
      // takes the "empty list" path and deletes every line.
      it("deletes every line when items is null", async () => {
        await patchJson({ items: null });

        expect(prismaMock.purchase_order_item.deleteMany).toHaveBeenCalledWith({
          where: { order_id: ID },
        });
      });

      it("returns 500 when an item update fails", async () => {
        mockUpdate({ existingItems: existingItems() });
        prismaMock.purchase_order_item.update.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await patchJson({
          items: [{ id: "poi-a", item_id: "A", quantity: 5 }],
        });

        expect(res.status).toBe(500);
        expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
      });
    });

    describe("MTO status", () => {
      it("re-checks the status using the first line linked to an MTO item", async () => {
        mockUpdate({
          result: updated({
            items: [
              { id: "x" },
              { id: "y", mto_item_id: "mi-2" },
              { id: "z", mto_item_id: "mi-3" },
            ],
          }),
        });

        await patchJson();

        expect(checkAndUpdateMTOStatus).toHaveBeenCalledTimes(1);
        expect(checkAndUpdateMTOStatus).toHaveBeenCalledWith("mi-2");
      });

      it("does not re-check when no line is linked to an MTO item", async () => {
        mockUpdate({ result: updated({ items: [{ id: "x" }] }) });

        await patchJson();

        expect(checkAndUpdateMTOStatus).not.toHaveBeenCalled();
      });
    });

    describe("invoice file", () => {
      it("soft deletes the stored invoice when invoice_url is null", async () => {
        mockUpdate({ existing: storedPo({ invoice_url_id: "file-old" }) });

        await patchJson({ invoice_url: null });

        expect(prismaMock.supplier_file.update).toHaveBeenCalledWith({
          where: { id: "file-old" },
          data: { is_deleted: true },
        });
        expect(prismaMock.supplier_file.delete).not.toHaveBeenCalled();
        expect(updateData().invoice_url_id).toBeNull();
      });

      it("also accepts invoice_url_id null", async () => {
        mockUpdate({ existing: storedPo({ invoice_url_id: "file-old" }) });

        await patchJson({ invoice_url_id: null });

        expect(updateData().invoice_url_id).toBeNull();
      });

      it("does nothing when there is no stored invoice to remove", async () => {
        await patchJson({ invoice_url: null });

        expect(prismaMock.supplier_file.update).not.toHaveBeenCalled();
        expect(updateData()).not.toHaveProperty("invoice_url_id");
      });
    });

    describe("multipart updates", () => {
      it("reads the fields from form data", async () => {
        const res = await patchForm({
          status: "ORDERED",
          notes: "From form",
          total_amount: "99",
          delivery_charge: "5",
          invoice_date: "2026-03-02",
          ordered_at: "2026-03-01",
          invoice_url: "keep", // present, so the invoice is not unlinked
        });

        expect(res.status).toBe(200);
        expect(updateData()).toEqual({
          status: "ORDERED",
          notes: "From form",
          total_amount: 99,
          delivery_charge: 5,
          invoice_date: new Date("2026-03-02"),
          ordered_at: new Date("2026-03-01"),
        });
      });

      it("replaces items from a JSON string", async () => {
        mockUpdate({
          existingItems: [
            { id: "poi-a", item_id: "A", quantity: 5, quantity_received: 1 },
          ],
        });

        await patchForm({
          invoice_url: "keep",
          items: JSON.stringify([{ id: "poi-a", item_id: "A", quantity: 7 }]),
        });

        expect(prismaMock.purchase_order_item.update).toHaveBeenCalledWith({
          where: { id: "poi-a" },
          data: expect.objectContaining({ quantity: 7, quantity_received: 1 }),
        });
      });

      it("accepts a single JSON object for items", async () => {
        await patchForm({
          invoice_url: "keep",
          items: JSON.stringify({ item_id: "C", quantity: 2 }),
        });

        expect(prismaMock.purchase_order_item.create).toHaveBeenCalledOnce();
      });

      it("uploads a new invoice named after the immutable order_no and links it", async () => {
        await patchForm({
          invoice_url: "keep",
          invoice: testFile("inv.pdf", "application/pdf"),
        });

        expect(uploadFile).toHaveBeenCalledWith(expect.any(File), {
          uploadDir: "mediauploads",
          subDir: "purchase_order",
          filenameStrategy: "id-based",
          idPrefix: "PO-1001",
        });
        expect(prismaMock.supplier_file.create).toHaveBeenCalledWith({
          data: {
            url: "mediauploads/purchase_order/PO-1001-x.pdf",
            filename: "PO-1001-x.pdf",
            file_type: "invoice",
            mime_type: "application/pdf",
            extension: "pdf",
            size: 100,
          },
        });
        expect(updateData().invoice_url_id).toBe("file-new");
      });

      it('treats the string "null" as a request to remove the invoice', async () => {
        mockUpdate({ existing: storedPo({ invoice_url_id: "file-old" }) });

        await patchForm({ invoice_url: "null" });

        expect(prismaMock.supplier_file.update).toHaveBeenCalledWith({
          where: { id: "file-old" },
          data: { is_deleted: true },
        });
        expect(updateData().invoice_url_id).toBeNull();
      });

      // Current behaviour (bug): FormData.get() returns null for a missing
      // field, which the route reads as "delete the invoice", so any multipart
      // update that omits invoice_url unlinks the existing invoice.
      it("unlinks the existing invoice when invoice_url is omitted", async () => {
        mockUpdate({ existing: storedPo({ invoice_url_id: "file-old" }) });

        await patchForm({ notes: "just a note" });

        expect(prismaMock.supplier_file.update).toHaveBeenCalledWith({
          where: { id: "file-old" },
          data: { is_deleted: true },
        });
        expect(updateData().invoice_url_id).toBeNull();
      });

      it("returns 500 when the upload fails", async () => {
        uploadFile.mockRejectedValue(new Error("virus detected"));

        const res = await patchForm({
          invoice_url: "keep",
          invoice: testFile(),
        });

        expect(res.status).toBe(500);
        expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
      });
    });

    describe("failures", () => {
      it("returns 200 with a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await patchJson();

        expect(res.status).toBe(200);
        expect((await res.json()).warning).toBe(
          "Note: Update succeeded but logging failed",
        );
      });

      it("returns 500 when the update fails", async () => {
        prismaMock.purchase_order.update.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await patchJson();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 for a malformed JSON body", async () => {
        const res = await PATCH(
          buildRequest(URL, {
            method: "PATCH",
            rawBody: "{not json",
            headers: { "content-type": "application/json" },
          }),
          ctx(),
        );

        expect(res.status).toBe(500);
        expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
      });
    });
  });
});

describe("DELETE /api/v1/purchase_order/[id]", () => {
  const del = (options) =>
    DELETE(buildRequest(URL, { method: "DELETE", ...options }), ctx());

  const deleted = () => ({
    ...storedPo(),
    mto: { project: { project_id: "p1", name: "Smith House" } },
  });

  function mockDelete() {
    prismaMock.purchase_order.delete.mockResolvedValue(deleted());
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization(del, {
    modules: MODULES,
    setup: mockDelete,
    untouched: () => [prismaMock.purchase_order.delete],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    // Current behaviour: a hard delete (items cascade), unlike soft-deleted
    // projects and MTOs.
    it("deletes the purchase order and logs the deletion", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Purchase order deleted successfully",
        data: deleted(),
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.purchase_order.delete).toHaveBeenCalledWith({
        where: { id: ID },
        include: {
          mto: {
            select: { project: { select: { project_id: true, name: true } } },
          },
        },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "purchase_order",
          entity_id: ID,
          action: "DELETE",
          description:
            "Purchase order deleted successfully for project: Smith House",
        },
      });
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Deletion succeeded but logging failed",
      );
    });

    // Current behaviour: a missing purchase order (Prisma P2025) is a 500.
    it("returns 500 when the purchase order does not exist", async () => {
      prismaMock.purchase_order.delete.mockRejectedValue(
        Object.assign(new Error("Record to delete does not exist."), {
          code: "P2025",
        }),
      );

      const res = await del();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });
  });
});
