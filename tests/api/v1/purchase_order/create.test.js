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
}));
vi.mock("@/lib/mtoStatusHelper", () => ({ checkAndUpdateMTOStatus: vi.fn() }));

const { POST } = await import("@/app/api/v1/purchase_order/create/route");
const { uploadFile } = await import("@/lib/fileHandler");
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

// What create() returns: input data echoed back, with items given ids.
function mockCreate({ createdItems } = {}) {
  prismaMock.materials_to_order.findUnique.mockResolvedValue({
    is_deleted: false,
  });
  prismaMock.purchase_order.findUnique.mockResolvedValue(null);
  prismaMock.supplier_file.create.mockResolvedValue({ id: "file-1" });
  prismaMock.purchase_order.create.mockImplementation(async ({ data }) => ({
    id: "po-1",
    ...data,
    items:
      createdItems ??
      (data.items?.create ?? []).map((i, n) => ({ id: `poi-${n}`, ...i })),
  }));
  prismaMock.materials_to_order_item.findMany.mockResolvedValue([]);
  prismaMock.materials_to_order_item.update.mockResolvedValue({});
  prismaMock.logs.create.mockResolvedValue({});
  uploadFile.mockResolvedValue(UPLOAD_RESULT);
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
          orderedBy_id: "user-7",
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
        orderedBy_id: "user-7",
        notes: "Rush",
        delivery_charge: 25.5,
        invoice_date: new Date("2026-03-02"),
        status: "ORDERED",
        total_amount: 0,
        items: undefined,
      });
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
    });

    describe("items and totals", () => {
      it("creates nested items with numeric fields and stores grand total (amounts + GST)", async () => {
        await post(
          fields({
            items: JSON.stringify([
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
          }),
        );

        expect(createData().total_amount).toBe(55); // 40 + 10 + 4 + 1
        expect(createData().items).toEqual({
          create: [
            {
              item_id: "A",
              mto_item_id: undefined,
              quantity: 4,
              notes: "n",
              unit_price: 10,
              gst: 4,
              total_amount: 40,
            },
            {
              item_id: "B",
              mto_item_id: undefined,
              quantity: 2,
              notes: undefined,
              unit_price: 5,
              gst: 1,
              total_amount: 10,
            },
          ],
        });
      });

      // Current behaviour: the submitted total_amount is ignored and replaced
      // by the sum of the line totals plus GST.
      it("ignores a submitted total_amount", async () => {
        await post(fields({ total_amount: "9999" }));

        expect(createData().total_amount).toBe(0);
      });

      it("leaves missing line amounts undefined", async () => {
        await post(
          fields({ items: JSON.stringify([{ item_id: "A", quantity: 1 }]) }),
        );

        expect(createData().items.create[0]).toMatchObject({
          unit_price: undefined,
          gst: undefined,
          total_amount: undefined,
        });
        expect(createData().total_amount).toBe(0);
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

      it.each([
        ["not JSON", "not json"],
        ["an empty array", "[]"],
      ])("creates no items when items is %s", async (_, value) => {
        await post(fields({ items: value }));

        expect(createData().items).toBeUndefined();
        expect(createData().total_amount).toBe(0);
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
            filenameStrategy: "id-based",
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

      it("does not upload when no file is sent", async () => {
        await post();

        expect(uploadFile).not.toHaveBeenCalled();
        expect(createData().invoice_url_id).toBeUndefined();
      });

      it("returns 500 when the upload fails", async () => {
        uploadFile.mockRejectedValue(new Error("virus detected"));

        const res = await post(fields({ invoice: testFile("inv.pdf") }));

        expect(res.status).toBe(500);
        expect(prismaMock.purchase_order.create).not.toHaveBeenCalled();
      });
    });

    describe("linking to a materials-to-order list", () => {
      const withMto = (items) =>
        fields({ mto_id: "mto-1", items: JSON.stringify(items) });

      it("adds the ordered quantity to each matching MTO item", async () => {
        prismaMock.materials_to_order_item.findMany.mockResolvedValue([
          {
            id: "mi-1",
            item_id: "ITEM-A",
            quantity: 10,
            quantity_ordered_po: 3,
          },
          {
            id: "mi-2",
            item_id: "ITEM-B",
            quantity: 5,
            quantity_ordered_po: null,
          },
        ]);

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
        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith({
          where: { id: "mi-1" },
          data: { quantity_ordered_po: 7 },
        });
        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith({
          where: { id: "mi-2" },
          data: { quantity_ordered_po: 2 },
        });
      });

      it("skips items that are not on the MTO and zero quantities", async () => {
        prismaMock.materials_to_order_item.findMany.mockResolvedValue([
          {
            id: "mi-1",
            item_id: "ITEM-A",
            quantity: 10,
            quantity_ordered_po: 0,
          },
        ]);

        await post(
          withMto([
            item({ item_id: "ITEM-A", quantity: 0, mto_item_id: "mi-1" }),
            item({ item_id: "ITEM-X", quantity: 3 }),
          ]),
        );

        expect(
          prismaMock.materials_to_order_item.update,
        ).not.toHaveBeenCalled();
      });

      it("re-checks the MTO status using the first line that has an mto_item_id", async () => {
        await post(
          withMto([
            item({ item_id: "A" }),
            item({ item_id: "B", mto_item_id: "mi-2" }),
            item({ item_id: "C", mto_item_id: "mi-3" }),
          ]),
        );

        expect(checkAndUpdateMTOStatus).toHaveBeenCalledTimes(1);
        expect(checkAndUpdateMTOStatus).toHaveBeenCalledWith("mi-2");
      });

      it("does not re-check the status when no line has an mto_item_id", async () => {
        await post(withMto([item()]));

        expect(checkAndUpdateMTOStatus).not.toHaveBeenCalled();
      });

      it("does not touch MTO items when the PO has no MTO", async () => {
        await post(
          fields({ items: JSON.stringify([item({ mto_item_id: "mi-1" })]) }),
        );

        expect(
          prismaMock.materials_to_order_item.findMany,
        ).not.toHaveBeenCalled();
        expect(checkAndUpdateMTOStatus).not.toHaveBeenCalled();
      });

      // Current behaviour: the log text names the MTO id, not the project.
      it("logs the MTO id in the description", async () => {
        await post(withMto([item()]));

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

      it("returns 500 when updating the MTO items fails", async () => {
        prismaMock.materials_to_order_item.findMany.mockResolvedValue([
          {
            id: "mi-1",
            item_id: "ITEM-A",
            quantity: 10,
            quantity_ordered_po: 0,
          },
        ]);
        prismaMock.materials_to_order_item.update.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await post(
          fields({
            mto_id: "mto-1",
            items: JSON.stringify([item({ mto_item_id: "mi-1" })]),
          }),
        );

        expect(res.status).toBe(500);
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
