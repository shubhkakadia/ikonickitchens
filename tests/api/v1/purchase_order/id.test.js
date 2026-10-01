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
  deleteFileByRelativePath: vi.fn(),
}));
vi.mock("@/lib/mtoStatusHelper", () => ({ checkAndUpdateMTOStatus: vi.fn() }));

const { GET, PATCH, DELETE } =
  await import("@/app/api/v1/purchase_order/[id]/route");
const { uploadFile, deleteFileByRelativePath } =
  await import("@/lib/fileHandler");
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

  const line = (overrides = {}) => ({
    id: "poi-a",
    order_id: ID,
    item_id: "A",
    quantity: 5,
    quantity_received: 0,
    mto_item_id: null,
    ...overrides,
  });

  const updated = (overrides = {}) => ({
    ...storedPo(),
    mto: { project: { name: "Smith House" }, status: "DRAFT" },
    ...overrides,
  });

  // `po` is the stored purchase order (with its lines); `mtoItems` are the
  // lines of the PO's MTO; `fresh` is what the lines look like after edits
  function mockUpdate({
    po = storedPo(),
    mtoItems = [],
    fresh,
    result,
    knownItems,
  } = {}) {
    prismaMock.purchase_order.findUnique.mockResolvedValue(po);
    prismaMock.purchase_order.update.mockImplementation(
      async ({ data }) => result ?? updated(data),
    );
    prismaMock.item.findMany.mockImplementation(async ({ where }) =>
      (knownItems ?? where.item_id.in).map((item_id) => ({ item_id })),
    );
    prismaMock.materials_to_order_item.findMany.mockResolvedValue(mtoItems);
    prismaMock.materials_to_order_item.update.mockResolvedValue({});
    prismaMock.materials_to_order_item.updateMany.mockResolvedValue({
      count: 1,
    });
    prismaMock.purchase_order_item.findMany.mockResolvedValue(
      fresh ?? po.items,
    );
    prismaMock.purchase_order_item.update.mockResolvedValue({});
    prismaMock.purchase_order_item.create.mockImplementation(
      async ({ data }) => ({ id: "poi-new", ...data }),
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
    deleteFileByRelativePath.mockResolvedValue(undefined);
    checkAndUpdateMTOStatus.mockResolvedValue(false);
  }

  const updateData = () =>
    prismaMock.purchase_order.update.mock.calls[0][0].data;

  const decrement = (id, amount) => ({
    where: { id, quantity_ordered_po: { gte: amount } },
    data: { quantity_ordered_po: { decrement: amount } },
  });
  const increment = (id, amount) => ({
    where: { id },
    data: { quantity_ordered_po: { increment: amount } },
  });

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

      it("does everything in one transaction, after taking the PO row lock", async () => {
        await patchJson({ notes: "x" });

        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
        const [strings, ...values] = prismaMock.$queryRaw.mock.calls[0];
        expect(strings.join("?")).toMatch(
          /FROM purchase_order[\s\S]*FOR UPDATE/,
        );
        expect(values).toEqual([ID]);
        expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
          prismaMock.purchase_order.update.mock.invocationCallOrder[0],
        );
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
        ["total_amount", { total_amount: "abc" }],
        ["total_amount", { total_amount: -5 }],
        ["delivery_charge", { delivery_charge: "Infinity" }],
      ])("returns 400 for an invalid %s", async (field, body) => {
        const res = await patchJson(body);

        expect(res.status).toBe(400);
        expect((await res.json()).message).toBe(
          `${field} must be a non-negative amount`,
        );
        expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
      });

      it.each(["invoice_date", "ordered_at"])(
        "returns 400 for an invalid %s",
        async (field) => {
          const res = await patchJson({ [field]: "not-a-date" });

          expect(res.status).toBe(400);
          expect((await res.json()).message).toBe(
            `${field} is not a valid date`,
          );
        },
      );

      it("returns 400 for an unknown status", async () => {
        const res = await patchJson({ status: "SHIPPED" });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Invalid status. Must be one of: DRAFT, ORDERED, PARTIALLY_RECEIVED, FULLY_RECEIVED, CANCELLED",
        });
        expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
      });

      it.each(["PARTIALLY_RECEIVED", "FULLY_RECEIVED"])(
        "refuses to set %s by hand",
        async (status) => {
          const res = await patchJson({ status });

          expect(res.status).toBe(400);
          expect(await res.json()).toEqual({
            status: false,
            message: `Status ${status} is set automatically when items are received. You can set: DRAFT, ORDERED, CANCELLED`,
          });
          expect(prismaMock.$transaction).not.toHaveBeenCalled();
          expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
        },
      );

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

    describe("status changes", () => {
      const withStatus = (status, items = [], extra = {}) =>
        mockUpdate({ po: storedPo({ status, items, ...extra }) });

      it.each([
        ["DRAFT", "ORDERED"],
        ["ORDERED", "DRAFT"],
        ["DRAFT", "CANCELLED"],
        ["ORDERED", "CANCELLED"],
      ])("allows %s -> %s while nothing is received", async (from, to) => {
        withStatus(from, [line()]);

        const res = await patchJson({ status: to });

        expect(res.status).toBe(200);
        expect(updateData().status).toBe(to);
      });

      it("accepts the status it already has", async () => {
        withStatus("ORDERED", [line({ quantity_received: 2 })]);

        const res = await patchJson({ status: "ORDERED" });

        expect(res.status).toBe(200);
      });

      it.each(["DRAFT", "ORDERED"])(
        "won't set the status back to %s once something has been received",
        async (to) => {
          withStatus("PARTIALLY_RECEIVED", [line({ quantity_received: 2 })]);

          const res = await patchJson({ status: to });

          expect(res.status).toBe(409);
          expect((await res.json()).message).toBe(
            `Items have already been received against this purchase order, so its status can't be set back to ${to}.`,
          );
          expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
        },
      );

      it.each(["DRAFT", "ORDERED"])(
        "won't reopen a cancelled purchase order (to %s)",
        async (to) => {
          withStatus("CANCELLED", [line()]);

          const res = await patchJson({ status: to });

          expect(res.status).toBe(409);
          expect((await res.json()).message).toMatch(/can't be reopened/);
          expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
        },
      );

      it("won't cancel a fully received purchase order", async () => {
        withStatus("FULLY_RECEIVED", [line({ quantity_received: 5 })]);

        const res = await patchJson({ status: "CANCELLED" });

        expect(res.status).toBe(409);
        expect((await res.json()).message).toMatch(/nothing left to cancel/);
      });

      it("lets a cancelled purchase order still take notes and an invoice", async () => {
        withStatus("CANCELLED", [line()]);

        const res = await patchJson({ notes: "closed out" });

        expect(res.status).toBe(200);
        expect(updateData()).toEqual({ notes: "closed out" });
      });
    });

    describe("cancelling gives the order back to the MTO", () => {
      const mtoItems = [
        { id: "mi-1", item_id: "A" },
        { id: "mi-2", item_id: "B" },
      ];
      const orderedPo = (items) =>
        storedPo({ status: "ORDERED", mto_id: "mto-1", items });

      it("releases each line's quantity, matching by mto_item_id or by item", async () => {
        mockUpdate({
          po: orderedPo([
            line({
              id: "poi-a",
              item_id: "A",
              quantity: 5,
              mto_item_id: "mi-1",
            }),
            // no stored link: counts against the MTO's line for item B
            line({ id: "poi-b", item_id: "B", quantity: 3 }),
          ]),
          mtoItems,
        });

        const res = await patchJson({ status: "CANCELLED" });

        expect(res.status).toBe(200);
        const calls = prismaMock.materials_to_order_item.updateMany.mock.calls;
        expect(calls).toContainEqual([decrement("mi-1", 5)]);
        expect(calls).toContainEqual([decrement("mi-2", 3)]);
        expect(updateData().status).toBe("CANCELLED");
      });

      it("releases only the part that was never received", async () => {
        mockUpdate({
          po: {
            ...orderedPo([
              line({ quantity: 5, quantity_received: 2, mto_item_id: "mi-1" }),
            ]),
            status: "PARTIALLY_RECEIVED",
          },
          mtoItems,
        });

        await patchJson({ status: "CANCELLED" });

        expect(
          prismaMock.materials_to_order_item.updateMany,
        ).toHaveBeenCalledWith(decrement("mi-1", 3));
      });

      it("releases nothing for a line that was fully received", async () => {
        mockUpdate({
          po: {
            ...orderedPo([
              line({ quantity: 5, quantity_received: 5, mto_item_id: "mi-1" }),
              line({
                id: "poi-b",
                item_id: "B",
                quantity: 4,
                quantity_received: 1,
              }),
            ]),
            status: "PARTIALLY_RECEIVED",
          },
          mtoItems,
        });

        await patchJson({ status: "CANCELLED" });

        const calls = prismaMock.materials_to_order_item.updateMany.mock.calls;
        expect(calls).toEqual([[decrement("mi-2", 3)]]);
      });

      it("never takes an MTO line below zero, even if the stored total has drifted", async () => {
        mockUpdate({
          po: orderedPo([line({ quantity: 5, mto_item_id: "mi-1" })]),
          mtoItems,
        });
        prismaMock.materials_to_order_item.updateMany
          .mockResolvedValueOnce({ count: 0 }) // guarded decrement did not apply
          .mockResolvedValueOnce({ count: 1 });

        const res = await patchJson({ status: "CANCELLED" });

        expect(res.status).toBe(200);
        expect(
          prismaMock.materials_to_order_item.updateMany,
        ).toHaveBeenLastCalledWith({
          where: { id: "mi-1" },
          data: { quantity_ordered_po: 0 },
        });
      });

      it("does not touch MTO lines when the PO has no MTO", async () => {
        mockUpdate({
          po: storedPo({ status: "ORDERED", items: [line()] }),
        });

        await patchJson({ status: "CANCELLED" });

        expect(
          prismaMock.materials_to_order_item.updateMany,
        ).not.toHaveBeenCalled();
        expect(
          prismaMock.materials_to_order_item.update,
        ).not.toHaveBeenCalled();
      });

      it("re-checks the MTO status afterwards", async () => {
        mockUpdate({
          po: orderedPo([line({ mto_item_id: "mi-1" })]),
          mtoItems,
        });

        await patchJson({ status: "CANCELLED" });

        expect(checkAndUpdateMTOStatus).toHaveBeenCalledWith("mi-1");
      });
    });

    describe("lines", () => {
      const stored = () =>
        storedPo({
          status: "PARTIALLY_RECEIVED",
          mto_id: "mto-1",
          items: [
            line({
              id: "poi-a",
              item_id: "A",
              quantity: 5,
              quantity_received: 2,
              mto_item_id: "mi-1",
            }),
            line({
              id: "poi-b",
              item_id: "B",
              quantity: 3,
              mto_item_id: "mi-2",
            }),
          ],
        });
      const mtoItems = [
        { id: "mi-1", item_id: "A" },
        { id: "mi-2", item_id: "B" },
        { id: "mi-3", item_id: "C" },
      ];

      beforeEach(() => {
        mockUpdate({ po: stored(), mtoItems });
      });

      it("does not touch lines when items is not sent", async () => {
        await patchJson({ notes: "x" });

        expect(prismaMock.purchase_order_item.update).not.toHaveBeenCalled();
        expect(prismaMock.purchase_order_item.create).not.toHaveBeenCalled();
        expect(
          prismaMock.purchase_order_item.deleteMany,
        ).not.toHaveBeenCalled();
        expect(
          prismaMock.materials_to_order_item.update,
        ).not.toHaveBeenCalled();
      });

      it("updates matching lines by id and never writes quantity_received", async () => {
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

        expect(prismaMock.purchase_order_item.update).toHaveBeenCalledWith({
          where: { id: "poi-a" },
          data: { item_id: "A", quantity: 8, notes: "n", unit_price: 2.5 },
        });
        expect(prismaMock.purchase_order_item.update).toHaveBeenCalledWith({
          where: { id: "poi-b" },
          data: { item_id: "B", quantity: 3, notes: null, unit_price: null },
        });
        expect(
          prismaMock.purchase_order_item.deleteMany,
        ).not.toHaveBeenCalled();
      });

      it("adjusts the MTO line by exactly the change in quantity", async () => {
        await patchJson({
          items: [
            { id: "poi-a", item_id: "A", quantity: 8 }, // +3
            { id: "poi-b", item_id: "B", quantity: 3 }, // unchanged
          ],
        });

        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledTimes(
          1,
        );
        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith(
          increment("mi-1", 3),
        );
      });

      it("returns quantity to the MTO when a line is lowered", async () => {
        await patchJson({
          items: [
            { id: "poi-a", item_id: "A", quantity: 5 },
            { id: "poi-b", item_id: "B", quantity: 1 }, // -2
          ],
        });

        expect(
          prismaMock.materials_to_order_item.updateMany,
        ).toHaveBeenCalledWith(decrement("mi-2", 2));
      });

      it("matches a line without an id by its item", async () => {
        await patchJson({
          items: [
            { item_id: "A", quantity: 6 },
            { item_id: "B", quantity: 3 },
          ],
        });

        expect(prismaMock.purchase_order_item.update).toHaveBeenCalledTimes(2);
        expect(prismaMock.purchase_order_item.create).not.toHaveBeenCalled();
      });

      it("keeps two lines for the same item apart instead of merging them", async () => {
        mockUpdate({
          po: storedPo({
            status: "ORDERED",
            mto_id: "mto-1",
            items: [
              line({ id: "poi-1", item_id: "A", quantity: 4 }),
              line({ id: "poi-2", item_id: "A", quantity: 6 }),
            ],
          }),
          mtoItems,
        });

        await patchJson({
          items: [
            { item_id: "A", quantity: 4 },
            { item_id: "A", quantity: 7 },
          ],
        });

        expect(
          prismaMock.purchase_order_item.update.mock.calls.map((c) => [
            c[0].where.id,
            c[0].data.quantity,
          ]),
        ).toEqual([
          ["poi-1", 4],
          ["poi-2", 7],
        ]);
        // 4 -> 4 and 6 -> 7 is +1 in total
        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith(
          increment("mi-1", 1),
        );
      });

      it("creates new lines with nothing received, linked to the MTO line they count against", async () => {
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
            mto_item_id: "mi-3",
            order_id: ID,
            quantity_received: 0,
          },
        });
        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith(
          increment("mi-3", 4),
        );
      });

      it("rejects a new line whose mto_item_id is from another MTO", async () => {
        const res = await patchJson({
          items: [
            { id: "poi-a", item_id: "A", quantity: 5 },
            { id: "poi-b", item_id: "B", quantity: 3 },
            { item_id: "C", quantity: 4, mto_item_id: "mi-other" },
          ],
        });

        expect(res.status).toBe(400);
        expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
      });

      it("removes a line that has nothing received and gives its quantity back", async () => {
        await patchJson({
          items: [{ id: "poi-a", item_id: "A", quantity: 5 }],
        });

        expect(prismaMock.purchase_order_item.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ["poi-b"] } },
        });
        expect(
          prismaMock.materials_to_order_item.updateMany,
        ).toHaveBeenCalledWith(decrement("mi-2", 3));
      });

      it("moves the quantity between MTO lines when an unreceived line changes item", async () => {
        await patchJson({
          items: [
            { id: "poi-a", item_id: "A", quantity: 5 },
            { id: "poi-b", item_id: "C", quantity: 3 },
          ],
        });

        expect(
          prismaMock.materials_to_order_item.updateMany,
        ).toHaveBeenCalledWith(decrement("mi-2", 3));
        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith(
          increment("mi-3", 3),
        );
      });

      describe("once stock has been received", () => {
        it("won't remove a line that has received stock", async () => {
          const res = await patchJson({
            items: [{ id: "poi-b", item_id: "B", quantity: 3 }],
          });

          expect(res.status).toBe(409);
          expect((await res.json()).message).toBe(
            "Can't remove the line for item A: 2 have been received.",
          );
          expect(
            prismaMock.purchase_order_item.deleteMany,
          ).not.toHaveBeenCalled();
          expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
        });

        it("won't change the item of a line that has received stock", async () => {
          const res = await patchJson({
            items: [
              { id: "poi-a", item_id: "Z", quantity: 5 },
              { id: "poi-b", item_id: "B", quantity: 3 },
            ],
          });

          expect(res.status).toBe(409);
          expect((await res.json()).message).toBe(
            "Can't change the item of a line that already has 2 received.",
          );
          expect(prismaMock.purchase_order_item.update).not.toHaveBeenCalled();
        });

        it("won't lower a quantity below what was received", async () => {
          const res = await patchJson({
            items: [
              { id: "poi-a", item_id: "A", quantity: 1 },
              { id: "poi-b", item_id: "B", quantity: 3 },
            ],
          });

          expect(res.status).toBe(409);
          expect((await res.json()).message).toBe(
            "Quantity can't be lower than the 2 already received for item A.",
          );
          expect(prismaMock.purchase_order_item.update).not.toHaveBeenCalled();
        });

        it("still lets price and notes change", async () => {
          const res = await patchJson({
            items: [
              {
                id: "poi-a",
                item_id: "A",
                quantity: 5,
                unit_price: 12,
                notes: "price per invoice",
              },
              { id: "poi-b", item_id: "B", quantity: 3 },
            ],
          });

          expect(res.status).toBe(200);
          expect(prismaMock.purchase_order_item.update).toHaveBeenCalledWith({
            where: { id: "poi-a" },
            data: {
              item_id: "A",
              quantity: 5,
              notes: "price per invoice",
              unit_price: 12,
            },
          });
        });

        it("marks the order fully received when a quantity is lowered to what arrived", async () => {
          mockUpdate({
            po: stored(),
            mtoItems,
            fresh: [
              line({ id: "poi-a", quantity: 2, quantity_received: 2 }),
              line({
                id: "poi-b",
                item_id: "B",
                quantity: 3,
                quantity_received: 3,
              }),
            ],
          });

          await patchJson({
            items: [
              { id: "poi-a", item_id: "A", quantity: 2 },
              { id: "poi-b", item_id: "B", quantity: 3 },
            ],
          });

          expect(updateData().status).toBe("FULLY_RECEIVED");
        });

        it("won't remove every line of a purchase order that received stock", async () => {
          const res = await patchJson({ items: [] });

          expect(res.status).toBe(409);
          expect(
            prismaMock.purchase_order_item.deleteMany,
          ).not.toHaveBeenCalled();
        });
      });

      it("won't add lines to a fully received purchase order", async () => {
        mockUpdate({
          po: storedPo({
            status: "FULLY_RECEIVED",
            items: [line({ quantity: 5, quantity_received: 5 })],
          }),
        });

        const res = await patchJson({
          items: [
            { id: "poi-a", item_id: "A", quantity: 5 },
            { item_id: "C", quantity: 1 },
          ],
        });

        expect(res.status).toBe(409);
        expect((await res.json()).message).toBe(
          "A fully received purchase order can't take new lines.",
        );
        expect(prismaMock.purchase_order_item.create).not.toHaveBeenCalled();
      });

      it("won't edit the lines of a cancelled purchase order", async () => {
        mockUpdate({
          po: storedPo({ status: "CANCELLED", items: [line()] }),
        });

        const res = await patchJson({
          items: [{ id: "poi-a", item_id: "A", quantity: 9 }],
        });

        expect(res.status).toBe(409);
        expect((await res.json()).message).toBe(
          "Lines of a cancelled purchase order can't be edited.",
        );
        expect(prismaMock.purchase_order_item.update).not.toHaveBeenCalled();
      });

      it("won't edit lines in the same request that cancels the order", async () => {
        const res = await patchJson({
          status: "CANCELLED",
          items: [{ id: "poi-a", item_id: "A", quantity: 9 }],
        });

        expect(res.status).toBe(409);
      });

      it("deletes every line when items is an empty array and nothing was received", async () => {
        mockUpdate({
          po: storedPo({
            status: "ORDERED",
            mto_id: "mto-1",
            items: [line({ id: "poi-a", item_id: "A", quantity: 5 })],
          }),
          mtoItems,
        });

        const res = await patchJson({ items: [] });

        expect(res.status).toBe(200);
        expect(prismaMock.purchase_order_item.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ["poi-a"] } },
        });
        expect(
          prismaMock.materials_to_order_item.updateMany,
        ).toHaveBeenCalledWith(decrement("mi-1", 5));
      });

      it.each([
        ["null", null],
        ["an object", { a: 1 }],
        ["a string", "x"],
      ])(
        "returns 400 instead of deleting every line when items is %s",
        async (_, value) => {
          const res = await patchJson({ items: value });

          expect(res.status).toBe(400);
          expect((await res.json()).message).toBe("items must be an array");
          expect(
            prismaMock.purchase_order_item.deleteMany,
          ).not.toHaveBeenCalled();
          expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
        },
      );

      it.each([
        ["zero", 0],
        ["a fraction", 2.5],
        ["negative", -1],
        ["not a number", "abc"],
        ["missing", undefined],
      ])("rejects a line quantity that is %s", async (_, quantity) => {
        const res = await patchJson({
          items: [{ id: "poi-a", item_id: "A", quantity }],
        });

        expect(res.status).toBe(400);
        expect((await res.json()).message).toBe(
          "Item 1: quantity must be a positive whole number",
        );
        expect(prismaMock.purchase_order_item.update).not.toHaveBeenCalled();
      });

      it("rejects a negative unit price and a line without item_id", async () => {
        expect(
          (
            await patchJson({
              items: [{ item_id: "A", quantity: 1, unit_price: -1 }],
            })
          ).status,
        ).toBe(400);
        expect((await patchJson({ items: [{ quantity: 1 }] })).status).toBe(
          400,
        );
      });

      it("returns 404 when a line's item does not exist", async () => {
        mockUpdate({ po: stored(), mtoItems, knownItems: ["A"] });

        const res = await patchJson({
          items: [
            { id: "poi-a", item_id: "A", quantity: 5 },
            { item_id: "Z", quantity: 1 },
          ],
        });

        expect(res.status).toBe(404);
        expect((await res.json()).message).toBe("Item not found: Z");
        expect(prismaMock.purchase_order_item.update).not.toHaveBeenCalled();
      });

      it("returns 500 and leaves the order untouched when a line update fails", async () => {
        prismaMock.purchase_order_item.update.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await patchJson({
          items: [{ id: "poi-a", item_id: "A", quantity: 5 }],
        });

        expect(res.status).toBe(500);
        expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
      });

      it("re-checks the MTO status using an MTO line that changed", async () => {
        await patchJson({
          items: [
            { id: "poi-a", item_id: "A", quantity: 8 },
            { id: "poi-b", item_id: "B", quantity: 3 },
          ],
        });

        expect(checkAndUpdateMTOStatus).toHaveBeenCalledTimes(1);
        expect(checkAndUpdateMTOStatus).toHaveBeenCalledWith("mi-1");
      });
    });

    describe("MTO status", () => {
      it("falls back to the first line linked to an MTO item", async () => {
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
        mockUpdate({ po: storedPo({ invoice_url_id: "file-old" }) });

        await patchJson({ invoice_url: null });

        expect(prismaMock.supplier_file.update).toHaveBeenCalledWith({
          where: { id: "file-old" },
          data: { is_deleted: true },
        });
        expect(prismaMock.supplier_file.delete).not.toHaveBeenCalled();
        expect(updateData().invoice_url_id).toBeNull();
      });

      it("also accepts invoice_url_id null", async () => {
        mockUpdate({ po: storedPo({ invoice_url_id: "file-old" }) });

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
          po: storedPo({
            status: "ORDERED",
            items: [line({ quantity: 5, quantity_received: 1 })],
          }),
        });

        await patchForm({
          invoice_url: "keep",
          items: JSON.stringify([{ id: "poi-a", item_id: "A", quantity: 7 }]),
        });

        expect(prismaMock.purchase_order_item.update).toHaveBeenCalledWith({
          where: { id: "poi-a" },
          data: expect.objectContaining({ quantity: 7 }),
        });
      });

      it("accepts a single JSON object for items", async () => {
        await patchForm({
          invoice_url: "keep",
          items: JSON.stringify({ item_id: "C", quantity: 2 }),
        });

        expect(prismaMock.purchase_order_item.create).toHaveBeenCalledOnce();
      });

      it("returns 400 when items is not JSON", async () => {
        const res = await patchForm({ invoice_url: "keep", items: "not json" });

        expect(res.status).toBe(400);
        expect((await res.json()).message).toBe("items must be valid JSON");
      });

      it("uploads a new invoice under a unique name based on the immutable order_no and links it", async () => {
        await patchForm({
          invoice_url: "keep",
          invoice: testFile("inv.pdf", "application/pdf"),
        });

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
            url: "mediauploads/purchase_order/PO-1001-x.pdf",
            filename: "PO-1001-x.pdf",
            file_type: "invoice",
            mime_type: "application/pdf",
            extension: "pdf",
            size: 100,
          },
        });
        expect(updateData().invoice_url_id).toBe("file-new");
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
      });

      it("creates the file record inside the transaction", async () => {
        await patchForm({
          invoice_url: "keep",
          invoice: testFile("inv.pdf", "application/pdf"),
        });

        expect(
          prismaMock.$transaction.mock.invocationCallOrder[0],
        ).toBeLessThan(
          prismaMock.supplier_file.create.mock.invocationCallOrder[0],
        );
      });

      it("removes the uploaded file again when the update fails", async () => {
        prismaMock.purchase_order.update.mockRejectedValue(new Error("boom"));

        const res = await patchForm({
          invoice_url: "keep",
          invoice: testFile("inv.pdf", "application/pdf"),
        });

        expect(res.status).toBe(500);
        expect(deleteFileByRelativePath).toHaveBeenCalledWith(
          "mediauploads/purchase_order/PO-1001-x.pdf",
        );
      });

      it("removes the uploaded file when the request is refused", async () => {
        mockUpdate({ po: storedPo({ status: "CANCELLED", items: [line()] }) });

        const res = await patchForm({
          invoice_url: "keep",
          status: "ORDERED",
          invoice: testFile("inv.pdf", "application/pdf"),
        });

        expect(res.status).toBe(409);
        expect(deleteFileByRelativePath).toHaveBeenCalledOnce();
      });

      it("does not upload anything for a request that is invalid", async () => {
        const res = await patchForm({
          invoice_url: "keep",
          status: "FULLY_RECEIVED",
          invoice: testFile("inv.pdf", "application/pdf"),
        });

        expect(res.status).toBe(400);
        expect(uploadFile).not.toHaveBeenCalled();
      });

      it('treats the string "null" as a request to remove the invoice', async () => {
        mockUpdate({ po: storedPo({ invoice_url_id: "file-old" }) });

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
        mockUpdate({ po: storedPo({ invoice_url_id: "file-old" }) });

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
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
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

  const withMto = (overrides = {}) =>
    storedPo({
      status: "ORDERED",
      mto_id: "mto-1",
      mto: { project: { project_id: "p1", name: "Smith House" } },
      items: [
        {
          id: "poi-a",
          item_id: "A",
          quantity: 5,
          quantity_received: 0,
          mto_item_id: "mi-1",
        },
        {
          id: "poi-b",
          item_id: "B",
          quantity: 3,
          quantity_received: 0,
          mto_item_id: null,
        },
      ],
      ...overrides,
    });

  function mockDelete(po = withMto()) {
    prismaMock.purchase_order.findUnique.mockResolvedValue(po);
    prismaMock.purchase_order.update.mockImplementation(async ({ data }) => ({
      ...po,
      ...data,
    }));
    prismaMock.materials_to_order_item.findMany.mockResolvedValue([
      { id: "mi-1", item_id: "A" },
      { id: "mi-2", item_id: "B" },
    ]);
    prismaMock.materials_to_order_item.updateMany.mockResolvedValue({
      count: 1,
    });
    prismaMock.logs.create.mockResolvedValue({});
    checkAndUpdateMTOStatus.mockResolvedValue(false);
  }

  describeAuthorization(del, {
    modules: MODULES,
    setup: () => mockDelete(),
    untouched: () => [
      prismaMock.purchase_order.update,
      prismaMock.purchase_order.delete,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    it("cancels the purchase order instead of deleting it, and logs it", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe(true);
      expect(json.message).toBe("Purchase order cancelled successfully");
      expect(json.data.status).toBe("CANCELLED");
      expect(json.warning).toBeUndefined();
      // the rows stay: no hard delete of the PO or its lines
      expect(prismaMock.purchase_order.delete).not.toHaveBeenCalled();
      expect(prismaMock.purchase_order_item.deleteMany).not.toHaveBeenCalled();
      expect(prismaMock.purchase_order.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { status: "CANCELLED" },
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
            "Purchase order deleted (cancelled) for project: Smith House",
        },
      });
    });

    it("locks the PO row first and works in one transaction", async () => {
      await del();

      expect(prismaMock.$transaction).toHaveBeenCalledOnce();
      const [strings, ...values] = prismaMock.$queryRaw.mock.calls[0];
      expect(strings.join("?")).toMatch(/FROM purchase_order[\s\S]*FOR UPDATE/);
      expect(values).toEqual([ID]);
      expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prismaMock.purchase_order.update.mock.invocationCallOrder[0],
      );
    });

    it("gives the ordered quantities back to the MTO lines", async () => {
      await del();

      const calls = prismaMock.materials_to_order_item.updateMany.mock.calls;
      expect(calls).toContainEqual([
        {
          where: { id: "mi-1", quantity_ordered_po: { gte: 5 } },
          data: { quantity_ordered_po: { decrement: 5 } },
        },
      ]);
      // line B has no stored link: it counted against the MTO line for item B
      expect(calls).toContainEqual([
        {
          where: { id: "mi-2", quantity_ordered_po: { gte: 3 } },
          data: { quantity_ordered_po: { decrement: 3 } },
        },
      ]);
      expect(checkAndUpdateMTOStatus).toHaveBeenCalledWith("mi-1");
    });

    it("works for a purchase order without an MTO", async () => {
      mockDelete(storedPo({ status: "DRAFT", items: [], mto: null }));

      const res = await del();

      expect(res.status).toBe(200);
      expect(
        prismaMock.materials_to_order_item.updateMany,
      ).not.toHaveBeenCalled();
      expect(checkAndUpdateMTOStatus).not.toHaveBeenCalled();
    });

    it("refuses once any stock has been received", async () => {
      mockDelete(
        withMto({
          status: "PARTIALLY_RECEIVED",
          items: [
            {
              id: "poi-a",
              item_id: "A",
              quantity: 5,
              quantity_received: 2,
              mto_item_id: "mi-1",
            },
          ],
        }),
      );

      const res = await del();

      expect(res.status).toBe(409);
      expect((await res.json()).message).toMatch(
        /already been received against this purchase order, so it can't be deleted/,
      );
      expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
      expect(
        prismaMock.materials_to_order_item.updateMany,
      ).not.toHaveBeenCalled();
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("is a no-op for a purchase order that is already cancelled", async () => {
      mockDelete(withMto({ status: "CANCELLED" }));

      const res = await del();

      expect(res.status).toBe(200);
      expect((await res.json()).message).toBe(
        "Purchase order is already cancelled",
      );
      expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
      expect(
        prismaMock.materials_to_order_item.updateMany,
      ).not.toHaveBeenCalled();
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 404 when the purchase order does not exist", async () => {
      prismaMock.purchase_order.findUnique.mockResolvedValue(null);

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Purchase order not found",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Deletion succeeded but logging failed",
      );
    });

    it("returns 500 when the update fails", async () => {
      prismaMock.purchase_order.update.mockRejectedValue(new Error("DB down"));

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
