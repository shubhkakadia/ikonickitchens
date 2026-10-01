// Tests for src/app/api/v1/purchase_order/create/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, formBody, testFile } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

// Keep the real form-parsing helpers; stub the disk operations.
vi.mock("@/lib/fileHandler", async (importOriginal) => ({
  ...(await importOriginal()),
  uploadFile: vi.fn(),
  deleteFileByRelativePath: vi.fn(),
}));
vi.mock("@/lib/mtoStatusHelper", () => ({ checkAndUpdateMTOStatus: vi.fn() }));

const { POST } = await import("@/app/api/v1/purchase_order/create/route");
const { uploadFile, deleteFileByRelativePath } =
  await import("@/lib/fileHandler");
const { checkAndUpdateMTOStatus } = await import("@/lib/mtoStatusHelper");

const URL = "/api/v1/purchase_order/create";
const fields = (overrides = {}) => ({
  supplier_id: "SUP-1",
  order_no: "PO-1001",
  ...overrides,
});
const post = (body = fields(), options = {}) =>
  POST(buildRequest(URL, { method: "POST", body: formBody(body), ...options }));

const UPLOAD_RESULT = {
  relativePath: "mediauploads/purchase_order/PO-1001-abc.pdf",
  filename: "PO-1001-abc.pdf",
  mimeType: "application/pdf",
  extension: "pdf",
  size: 2048,
};

const item = (overrides = {}) => ({
  item_id: "ITEM-A",
  quantity: 4,
  unit_price: 10,
  gst: 4,
  total_amount: 40,
  ...overrides,
});

// Decimal columns are written as Decimal objects; compare them as numbers
const num = (value) => (value === undefined ? undefined : Number(value));

// What create() returns: input data echoed back, with items given ids.
function mockCreate({ createdItems, mtoItems = [] } = {}) {
  prismaMock.materials_to_order.findUnique.mockResolvedValue({
    is_deleted: false,
  });
  prismaMock.purchase_order.findUnique.mockResolvedValue(null);
  prismaMock.supplier.findUnique.mockResolvedValue({
    supplier_id: "SUP-1",
    is_deleted: false,
  });
  prismaMock.item.findMany.mockImplementation(async ({ where }) =>
    where.item_id.in.map((item_id) => ({ item_id })),
  );
  prismaMock.supplier_file.create.mockResolvedValue({ id: "file-1" });
  prismaMock.purchase_order.create.mockImplementation(async ({ data }) => ({
    id: "po-1",
    ...data,
    items:
      createdItems ??
      (data.items?.create ?? []).map((i, n) => ({ id: `poi-${n}`, ...i })),
  }));
  prismaMock.materials_to_order_item.findMany.mockResolvedValue(mtoItems);
  prismaMock.materials_to_order_item.update.mockResolvedValue({});
  prismaMock.logs.create.mockResolvedValue({});
  uploadFile.mockResolvedValue(UPLOAD_RESULT);
  deleteFileByRelativePath.mockResolvedValue(undefined);
  checkAndUpdateMTOStatus.mockResolvedValue(false);
}

const createData = () => prismaMock.purchase_order.create.mock.calls[0][0].data;

describe("POST /api/v1/purchase_order/create", () => {
  describeAuthorization((options) => post(undefined, options), {
    modules: ["purchaseorder", "supplier_details", "materialstoorder"],
    setup: () => mockCreate(),
    untouched: () => [prismaMock.purchase_order.create],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockCreate();
    });

    it("creates the purchase order and logs it", async () => {
      const res = await post(
        fields({
          notes: "Rush",
          delivery_charge: "25.5",
          invoice_date: "2026-03-02",
          status: "ORDERED",
        }),
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.status).toBe(true);
      expect(json.message).toBe("Purchase order created successfully");
      expect(json.warning).toBeUndefined();
      expect(createData()).toMatchObject({
        supplier_id: "SUP-1",
        order_no: "PO-1001",
        orderedBy_id: "user-1",
        notes: "Rush",
        invoice_date: new Date("2026-03-02"),
        status: "ORDERED",
        items: undefined,
      });
      expect(num(createData().delivery_charge)).toBe(25.5);
      expect(num(createData().total_amount)).toBe(0);
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "purchase_order",
          entity_id: "po-1",
          action: "CREATE",
          description:
            "Purchase order created successfully for project: undefined",
        },
      });
    });

    it("runs inside a transaction and includes the items in the result", async () => {
      await post();

      expect(prismaMock.$transaction).toHaveBeenCalledOnce();
      expect(prismaMock.purchase_order.create.mock.calls[0][0].include).toEqual(
        {
          items: true,
        },
      );
    });

    describe("who ordered it and in which state", () => {
      it("takes orderedBy from the session, not the form", async () => {
        await post(fields({ orderedBy_id: "someone-else" }));

        expect(createData().orderedBy_id).toBe("user-1");
      });

      it("returns 401 when the session cannot be re-read", async () => {
        const session = mockMasterAdmin();
        prismaMock.sessions.findUnique
          .mockReset()
          .mockResolvedValueOnce(session)
          .mockResolvedValueOnce(null);

        const res = await post();

        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({
          status: false,
          message: "Invalid session",
        });
        expect(prismaMock.purchase_order.create).not.toHaveBeenCalled();
      });

      it.each([
        ["no status is sent", undefined, undefined],
        ["DRAFT is sent", "DRAFT", undefined],
        ["ORDERED is sent", "ORDERED", "ORDERED"],
      ])("stores the right status when %s", async (_, sent, stored) => {
        await post(fields({ status: sent }));

        // undefined lets the database default (DRAFT) apply
        expect(createData().status).toBe(stored);
      });

      it.each([
        "PARTIALLY_RECEIVED",
        "FULLY_RECEIVED",
        "CANCELLED",
        "ordered",
        "whatever",
      ])("rejects a client-chosen status of %s", async (status) => {
        const res = await post(fields({ status }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "status must be one of: DRAFT, ORDERED",
        });
        expect(prismaMock.purchase_order.create).not.toHaveBeenCalled();
        expect(uploadFile).not.toHaveBeenCalled();
      });
    });

    describe("validation", () => {
      it.each([
        ["supplier_id", { supplier_id: undefined }],
        ["order_no", { order_no: undefined }],
        ["order_no (empty)", { order_no: "" }],
      ])("returns 400 when %s is missing", async (name, override) => {
        const res = await post(fields(override));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: `${name.split(" ")[0]} is required`,
        });
        expect(prismaMock.purchase_order.create).not.toHaveBeenCalled();
      });

      it.each(["../../public/x", "a/b", "a\b", "PO 1", "x".repeat(101)])(
        "returns 400 when order_no is unsafe (%s)",
        async (order_no) => {
          const res = await post(fields({ order_no }));

          expect(res.status).toBe(400);
          expect(uploadFile).not.toHaveBeenCalled();
          expect(prismaMock.purchase_order.create).not.toHaveBeenCalled();
        },
      );

      it.each([
        ["does not exist", null],
        ["is deleted", { is_deleted: true }],
      ])("returns 404 when the MTO %s", async (_, found) => {
        prismaMock.materials_to_order.findUnique.mockResolvedValue(found);

        const res = await post(fields({ mto_id: "mto-1" }));

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Materials to order not found",
        });
        expect(prismaMock.purchase_order.create).not.toHaveBeenCalled();
      });

      it("does not look up an MTO when none is given", async () => {
        await post();

        expect(prismaMock.materials_to_order.findUnique).not.toHaveBeenCalled();
      });

      it("returns 409 when the order number is already used", async () => {
        prismaMock.purchase_order.findUnique.mockResolvedValue({ id: "po-0" });

        const res = await post();

        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
          status: false,
          message: 'Purchase order with order number "PO-1001" already exists',
        });
        expect(prismaMock.purchase_order.findUnique).toHaveBeenCalledWith({
          where: { order_no: "PO-1001" },
        });
        expect(prismaMock.purchase_order.create).not.toHaveBeenCalled();
      });

      it("checks the MTO before the order number", async () => {
        prismaMock.materials_to_order.findUnique.mockResolvedValue(null);
        prismaMock.purchase_order.findUnique.mockResolvedValue({ id: "po-0" });

        const res = await post(fields({ mto_id: "mto-1" }));

        expect(res.status).toBe(404);
      });

      it.each([
        ["does not exist", null],
        ["is deleted", { supplier_id: "SUP-1", is_deleted: true }],
      ])("returns 404 when the supplier %s", async (_, found) => {
        prismaMock.supplier.findUnique.mockResolvedValue(found);

        const res = await post();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Supplier not found",
        });
        expect(prismaMock.purchase_order.create).not.toHaveBeenCalled();
      });

      it("returns 404 when a line's item does not exist", async () => {
        prismaMock.item.findMany.mockResolvedValue([{ item_id: "A" }]);

        const res = await post(
          fields({
            items: JSON.stringify([
              item({ item_id: "A" }),
              item({ item_id: "Z" }),
            ]),
          }),
        );

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Item not found: Z",
        });
        expect(uploadFile).not.toHaveBeenCalled();
        expect(prismaMock.purchase_order.create).not.toHaveBeenCalled();
      });

      it("rejects an invoice_date that is not a date", async () => {
        const res = await post(fields({ invoice_date: "not-a-date" }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "invoice_date is not a valid date",
        });
      });

      it.each([
        ["negative", "-5"],
        ["not a number", "abc"],
        ["Infinity", "Infinity"],
        ["too large for the column", "100000000"],
      ])("rejects a delivery_charge that is %s", async (_, value) => {
        const res = await post(fields({ delivery_charge: value }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "delivery_charge must be a non-negative amount",
        });
      });
    });

    describe("items and totals", () => {
      const withItems = (items, extra = {}) =>
        fields({ items: JSON.stringify(items), ...extra });

      it("creates nested items with numeric fields and stores the grand total (line totals + GST)", async () => {
        await post(
          withItems([
            item({
              item_id: "A",
              quantity: "4",
              unit_price: "10",
              gst: "4",
              total_amount: "40",
              notes: "n",
            }),
            item({
              item_id: "B",
              quantity: 2,
              unit_price: 5,
              gst: 1,
              total_amount: 10,
            }),
          ]),
        );

        expect(num(createData().total_amount)).toBe(55); // 40 + 10 + 4 + 1
        const lines = createData().items.create;
        expect(lines.map((l) => l.item_id)).toEqual(["A", "B"]);
        expect(lines[0]).toMatchObject({ quantity: 4, notes: "n" });
        expect(lines[0].mto_item_id).toBeUndefined();
        expect(lines.map((l) => num(l.unit_price))).toEqual([10, 5]);
        expect(lines.map((l) => num(l.gst))).toEqual([4, 1]);
        expect(lines.map((l) => num(l.total_amount))).toEqual([40, 10]);
      });

      it("computes each line total from quantity and unit price, not from the client's total", async () => {
        await post(
          withItems([item({ quantity: 4, unit_price: 10, total_amount: 1 })]),
        );

        expect(num(createData().items.create[0].total_amount)).toBe(40);
        expect(num(createData().total_amount)).toBe(44); // 40 + 4 GST
      });

      it("ignores a submitted PO total_amount", async () => {
        await post(fields({ total_amount: "9999" }));

        expect(num(createData().total_amount)).toBe(0);
      });

      it("uses exact decimal arithmetic instead of floating point", async () => {
        // 0.1 * 3 is 0.30000000000000004 in floating point
        await post(
          withItems([item({ quantity: 3, unit_price: "0.1", gst: 0 })]),
        );

        expect(createData().items.create[0].total_amount.toString()).toBe(
          "0.3",
        );
        expect(createData().total_amount.toString()).toBe("0.3");
      });

      it("rounds half up to cents", async () => {
        // 3 x 3.335 = 10.005, which must round to 10.01
        await post(
          withItems([item({ quantity: 3, unit_price: "3.335", gst: 0 })]),
        );

        expect(createData().items.create[0].total_amount.toString()).toBe(
          "10.01",
        );
      });

      it("takes the line total from the client only when there is no unit price", async () => {
        await post(
          withItems([
            { item_id: "A", quantity: 2, total_amount: "7.50", gst: "0.75" },
          ]),
        );

        expect(num(createData().items.create[0].total_amount)).toBe(7.5);
        expect(num(createData().total_amount)).toBe(8.25);
      });

      it("leaves missing line amounts undefined", async () => {
        await post(withItems([{ item_id: "A", quantity: 1 }]));

        expect(createData().items.create[0]).toMatchObject({
          unit_price: undefined,
          gst: undefined,
          total_amount: undefined,
        });
        expect(num(createData().total_amount)).toBe(0);
      });

      it("accepts a single JSON object", async () => {
        await post(fields({ items: JSON.stringify(item()) }));

        expect(createData().items.create).toHaveLength(1);
      });

      it("accepts comma-separated objects without brackets", async () => {
        await post(
          fields({
            items: `${JSON.stringify(item({ item_id: "A" }))},${JSON.stringify(item({ item_id: "B" }))}`,
          }),
        );

        expect(createData().items.create.map((i) => i.item_id)).toEqual([
          "A",
          "B",
        ]);
      });

      it("creates no items when items is an empty array", async () => {
        await post(fields({ items: "[]" }));

        expect(createData().items).toBeUndefined();
        expect(num(createData().total_amount)).toBe(0);
      });

      it("returns 400 instead of silently creating an empty PO when items is not JSON", async () => {
        const res = await post(fields({ items: "not json" }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "items must be valid JSON",
        });
        expect(prismaMock.purchase_order.create).not.toHaveBeenCalled();
      });

      it.each([
        ["zero", 0],
        ["negative", -2],
        ["a fraction", 2.5],
        ["not a number", "abc"],
        ["missing", undefined],
      ])("rejects a line quantity that is %s", async (_, quantity) => {
        const res = await post(withItems([item({ quantity })]));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Item 1: quantity must be a positive whole number",
        });
        expect(uploadFile).not.toHaveBeenCalled();
        expect(prismaMock.purchase_order.create).not.toHaveBeenCalled();
      });

      it("says which line is wrong", async () => {
        const res = await post(withItems([item(), item({ quantity: 0 })]));

        expect((await res.json()).message).toMatch(/^Item 2:/);
      });

      it.each([
        ["unit_price", { unit_price: -1 }],
        ["gst", { gst: "abc" }],
        ["total_amount", { total_amount: -5 }],
      ])("rejects an invalid line %s", async (_, override) => {
        const res = await post(withItems([item(override)]));

        expect(res.status).toBe(400);
        expect((await res.json()).message).toBe(
          "Item 1: unit_price, gst and total_amount must be non-negative amounts",
        );
      });

      it("rejects a line without an item_id", async () => {
        const res = await post(withItems([{ quantity: 1 }]));

        expect(res.status).toBe(400);
        expect((await res.json()).message).toBe("Item 1: item_id is required");
      });

      it("treats an empty delivery_charge as not set", async () => {
        await post(fields({ delivery_charge: "" }));

        expect(createData().delivery_charge).toBeUndefined();
      });
    });

    describe("invoice file", () => {
      it.each(["invoice", "file"])(
        "uploads a file sent as %s and links it",
        async (field) => {
          await post(
            fields({ [field]: testFile("inv.pdf", "application/pdf") }),
          );

          expect(uploadFile).toHaveBeenCalledWith(expect.any(File), {
            uploadDir: "mediauploads",
            subDir: "purchase_order",
            filenameStrategy: "unique",
            allowedGroups: ["pdf", "image", "office"],
            maxSize: 25 * 1024 * 1024,
            idPrefix: "PO-1001",
          });
          expect(prismaMock.supplier_file.create).toHaveBeenCalledWith({
            data: {
              url: UPLOAD_RESULT.relativePath,
              filename: UPLOAD_RESULT.filename,
              file_type: "invoice",
              mime_type: "application/pdf",
              extension: "pdf",
              size: 2048,
            },
          });
          expect(createData().invoice_url_id).toBe("file-1");
        },
      );

      it("creates the file record inside the transaction, not before it", async () => {
        await post(fields({ invoice: testFile("inv.pdf") }));

        expect(
          prismaMock.$transaction.mock.invocationCallOrder[0],
        ).toBeLessThan(
          prismaMock.supplier_file.create.mock.invocationCallOrder[0],
        );
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
      });

      it("does not upload when no file is sent", async () => {
        await post();

        expect(uploadFile).not.toHaveBeenCalled();
        expect(prismaMock.supplier_file.create).not.toHaveBeenCalled();
        expect(createData().invoice_url_id).toBeUndefined();
      });

      it("removes the uploaded file when creating the purchase order fails", async () => {
        prismaMock.purchase_order.create.mockRejectedValue(
          new Error("FK violation"),
        );

        const res = await post(fields({ invoice: testFile("inv.pdf") }));

        expect(res.status).toBe(500);
        expect(deleteFileByRelativePath).toHaveBeenCalledWith(
          UPLOAD_RESULT.relativePath,
        );
      });

      it("removes the uploaded file when the file record cannot be created", async () => {
        prismaMock.supplier_file.create.mockRejectedValue(new Error("DB down"));

        const res = await post(fields({ invoice: testFile("inv.pdf") }));

        expect(res.status).toBe(500);
        expect(prismaMock.purchase_order.create).not.toHaveBeenCalled();
        expect(deleteFileByRelativePath).toHaveBeenCalledWith(
          UPLOAD_RESULT.relativePath,
        );
      });

      it("still reports the original error if removing the file fails too", async () => {
        prismaMock.purchase_order.create.mockRejectedValue(new Error("boom"));
        deleteFileByRelativePath.mockRejectedValue(new Error("disk gone"));

        const res = await post(fields({ invoice: testFile("inv.pdf") }));

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
      });

      it("does not try to remove a file when the upload itself fails", async () => {
        uploadFile.mockRejectedValue(new Error("virus detected"));

        const res = await post(fields({ invoice: testFile("inv.pdf") }));

        expect(res.status).toBe(500);
        expect(prismaMock.purchase_order.create).not.toHaveBeenCalled();
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
      });

      it("returns 409 and removes the file when the order number was taken in between", async () => {
        prismaMock.purchase_order.create.mockRejectedValue(
          Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
          }),
        );

        const res = await post(fields({ invoice: testFile("inv.pdf") }));

        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
          status: false,
          message: "A purchase order with this order number already exists",
        });
        expect(deleteFileByRelativePath).toHaveBeenCalledOnce();
      });
    });

    describe("linking to a materials-to-order list", () => {
      const withMto = (items) =>
        fields({ mto_id: "mto-1", items: JSON.stringify(items) });

      const mtoLines = [
        { id: "mi-1", item_id: "ITEM-A", quantity: 10, quantity_ordered_po: 3 },
        {
          id: "mi-2",
          item_id: "ITEM-B",
          quantity: 5,
          quantity_ordered_po: null,
        },
      ];

      beforeEach(() => {
        mockCreate({ mtoItems: mtoLines });
      });

      it("adds the ordered quantity to each MTO item with an atomic increment", async () => {
        await post(
          withMto([
            item({ item_id: "ITEM-A", quantity: 4, mto_item_id: "mi-1" }),
            item({ item_id: "ITEM-B", quantity: 2, mto_item_id: "mi-2" }),
          ]),
        );

        expect(
          prismaMock.materials_to_order_item.findMany,
        ).toHaveBeenCalledWith({
          where: { mto_id: "mto-1" },
          select: {
            id: true,
            item_id: true,
            quantity: true,
            quantity_ordered_po: true,
          },
        });
        // never an absolute write computed from an earlier read
        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith({
          where: { id: "mi-1" },
          data: { quantity_ordered_po: { increment: 4 } },
        });
        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith({
          where: { id: "mi-2" },
          data: { quantity_ordered_po: { increment: 2 } },
        });
      });

      it("counts every line when the same item is on the PO twice", async () => {
        // used to keep only the last quantity
        await post(
          withMto([
            item({ item_id: "ITEM-A", quantity: 4, mto_item_id: "mi-1" }),
            item({ item_id: "ITEM-A", quantity: 6, mto_item_id: "mi-1" }),
          ]),
        );

        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledTimes(
          1,
        );
        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith({
          where: { id: "mi-1" },
          data: { quantity_ordered_po: { increment: 10 } },
        });
      });

      it("matches a line to its MTO item by item when no mto_item_id is sent", async () => {
        await post(withMto([item({ item_id: "ITEM-B", quantity: 3 })]));

        // the link is stored, so editing or cancelling the PO later can give
        // back exactly this quantity
        expect(createData().items.create[0].mto_item_id).toBe("mi-2");

        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith({
          where: { id: "mi-2" },
          data: { quantity_ordered_po: { increment: 3 } },
        });
      });

      it("skips lines whose item is not on the MTO", async () => {
        await post(withMto([item({ item_id: "ITEM-X", quantity: 3 })]));

        expect(
          prismaMock.materials_to_order_item.update,
        ).not.toHaveBeenCalled();
        expect(checkAndUpdateMTOStatus).not.toHaveBeenCalled();
      });

      it("rejects an mto_item_id that belongs to another MTO", async () => {
        const res = await post(
          withMto([item({ item_id: "ITEM-A", mto_item_id: "mi-other" })]),
        );

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Item 1: mto_item_id does not belong to this materials to order",
        });
        expect(prismaMock.purchase_order.create).not.toHaveBeenCalled();
      });

      it("rejects an mto_item_id when the PO has no MTO", async () => {
        const res = await post(
          fields({ items: JSON.stringify([item({ mto_item_id: "mi-1" })]) }),
        );

        expect(res.status).toBe(400);
        expect((await res.json()).message).toBe(
          "Item 1: mto_item_id requires mto_id",
        );
      });

      it("re-checks the MTO status once, using a line that was linked", async () => {
        await post(
          withMto([
            item({ item_id: "ITEM-A", mto_item_id: "mi-1" }),
            item({ item_id: "ITEM-B", mto_item_id: "mi-2" }),
          ]),
        );

        expect(checkAndUpdateMTOStatus).toHaveBeenCalledTimes(1);
        expect(checkAndUpdateMTOStatus).toHaveBeenCalledWith("mi-1");
      });

      it("re-checks the status even when lines were matched by item", async () => {
        await post(withMto([item({ item_id: "ITEM-A", quantity: 2 })]));

        expect(checkAndUpdateMTOStatus).toHaveBeenCalledWith("mi-1");
      });

      it("does not touch MTO items when the PO has no MTO", async () => {
        await post(fields({ items: JSON.stringify([item()]) }));

        expect(
          prismaMock.materials_to_order_item.findMany,
        ).not.toHaveBeenCalled();
        expect(
          prismaMock.materials_to_order_item.update,
        ).not.toHaveBeenCalled();
        expect(checkAndUpdateMTOStatus).not.toHaveBeenCalled();
      });

      it("updates the MTO quantities inside the same transaction as the PO", async () => {
        await post(withMto([item({ item_id: "ITEM-A", mto_item_id: "mi-1" })]));

        const txStart = prismaMock.$transaction.mock.invocationCallOrder[0];
        expect(txStart).toBeLessThan(
          prismaMock.purchase_order.create.mock.invocationCallOrder[0],
        );
        expect(
          prismaMock.purchase_order.create.mock.invocationCallOrder[0],
        ).toBeLessThan(
          prismaMock.materials_to_order_item.update.mock.invocationCallOrder[0],
        );
      });

      // Current behaviour: the log text names the MTO id, not the project.
      it("logs the MTO id in the description", async () => {
        await post(withMto([item({ item_id: "ITEM-A" })]));

        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            description:
              "Purchase order created successfully for project: mto-1",
          }),
        });
      });
    });

    describe("failures", () => {
      it("returns 201 with a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await post();

        expect(res.status).toBe(201);
        expect((await res.json()).warning).toBe(
          "Note: Creation succeeded but logging failed",
        );
      });

      it("returns 500 when the create fails", async () => {
        prismaMock.purchase_order.create.mockRejectedValue(
          new Error("FK violation"),
        );

        const res = await post();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 and removes the file when updating the MTO items fails", async () => {
        mockCreate({
          mtoItems: [
            {
              id: "mi-1",
              item_id: "ITEM-A",
              quantity: 10,
              quantity_ordered_po: 0,
            },
          ],
        });
        prismaMock.materials_to_order_item.update.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await post(
          fields({
            mto_id: "mto-1",
            invoice: testFile("inv.pdf"),
            items: JSON.stringify([item({ mto_item_id: "mi-1" })]),
          }),
        );

        expect(res.status).toBe(500);
        expect(deleteFileByRelativePath).toHaveBeenCalledWith(
          UPLOAD_RESULT.relativePath,
        );
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 when the request is not form data", async () => {
        const res = await POST(
          buildRequest(URL, { method: "POST", body: fields() }),
        );

        expect(res.status).toBe(500);
        expect(prismaMock.purchase_order.create).not.toHaveBeenCalled();
      });
    });
  });
});
