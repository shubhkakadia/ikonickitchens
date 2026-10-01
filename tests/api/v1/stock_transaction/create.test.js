// Tests for src/app/api/v1/stock_transaction/create/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

// sendNotification sends real WhatsApp messages; never call it in tests.
vi.mock("@/lib/notification", () => ({ sendNotification: vi.fn() }));

const { POST } = await import("@/app/api/v1/stock_transaction/create/route");
const { sendNotification } = await import("@/lib/notification");

const URL = "/api/v1/stock_transaction/create";
const post = (body, options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

// Request bodies for each flow
const manualUsed = (o = {}) => ({
  item_id: "ITEM-A",
  quantity: 3,
  type: "USED",
  ...o,
});
const mtoUsed = (o = {}) =>
  manualUsed({ materials_to_order_id: "mto-1", ...o });
const added = (o = {}) => ({
  item_id: "ITEM-A",
  quantity: 3,
  type: "ADDED",
  purchase_order_id: "po-1",
  ...o,
});
const wasted = (o = {}) => ({
  item_id: "ITEM-A",
  quantity: 3,
  type: "WASTED",
  ...o,
});

// An inventory item as findUnique returns it: item_id is the primary key and
// there is no `id` field.
const fullItem = (overrides = {}) => ({
  item_id: "ITEM-A",
  sheet: null,
  handle: null,
  hardware: null,
  accessory: null,
  edging_tape: null,
  ...overrides,
});

// Primes the pieces every flow shares: the item lookups (existence check,
// stock check, notification details) and the write stubs.
function mockBase({ stock = 10, exists = true, full = fullItem() } = {}) {
  prismaMock.item.findUnique.mockImplementation(async (args) => {
    if (!exists) return null;
    if (args?.include) return full; // notification details / updated item
    if (args?.select?.item_id) return { item_id: "ITEM-A", quantity: stock };
    if (args?.select?.quantity) return { quantity: stock };
    return { item_id: "ITEM-A" };
  });
  prismaMock.item.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.item.update.mockResolvedValue({});
  prismaMock.stock_transaction.create.mockImplementation(async ({ data }) => ({
    id: "txn-1",
    ...data,
  }));
  prismaMock.logs.create.mockResolvedValue({});
}

// MTO flow: a line with 10 required, 2 already used, nothing reserved
function mockMto({ line = {}, reservations = [], mto = {} } = {}) {
  mockBase();
  prismaMock.materials_to_order_item.findFirst.mockResolvedValue({
    id: "mi-1",
    quantity: 10,
    quantity_used: 2,
    mto: { is_deleted: false },
    ...line,
  });
  prismaMock.reserve_item_stock.findMany.mockResolvedValue(reservations);
  prismaMock.reserve_item_stock.delete.mockResolvedValue({});
  prismaMock.reserve_item_stock.update.mockResolvedValue({});
  prismaMock.materials_to_order_item.update.mockImplementation(
    async ({ data }) => ({
      id: "mi-1",
      ...data,
    }),
  );
  prismaMock.materials_to_order.findUnique.mockResolvedValue({
    id: "mto-1",
    used_material_completed: false,
    items: [{ quantity: 10, quantity_used: 5 }],
    ...mto,
  });
  prismaMock.materials_to_order.update.mockResolvedValue({});
}

// Purchase order flow: a line of 10 with 2 already received
const FINAL_PO = { id: "po-1", status: "FINAL", items: [] };
function mockPo({
  line = {},
  poItems = [{ quantity: 10, quantity_received: 5 }],
  status = "ORDERED",
} = {}) {
  mockBase();
  prismaMock.purchase_order_item.findFirst.mockResolvedValue({
    id: "poi-1",
    quantity_received: 2,
    ...line,
  });
  prismaMock.purchase_order_item.update.mockResolvedValue({});
  prismaMock.purchase_order.findUnique.mockImplementation(async (args) =>
    args?.include?.supplier ? FINAL_PO : { id: "po-1", status, items: poItems },
  );
  prismaMock.purchase_order.update.mockResolvedValue({});
}

describe("POST /api/v1/stock_transaction/create", () => {
  describeAuthorization((options) => post(manualUsed(), options), {
    modules: "usedmaterial",
    setup: () => mockBase(),
    untouched: () => [prismaMock.item.findUnique, prismaMock.$transaction],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockBase();
    });

    describe("validation", () => {
      it.each([
        ["item_id", manualUsed({ item_id: undefined })],
        ["quantity", manualUsed({ quantity: undefined })],
        ["a non-null quantity", manualUsed({ quantity: null })],
        ["type", manualUsed({ type: undefined })],
        ["a non-empty type", manualUsed({ type: "" })],
      ])("returns 400 when %s is missing", async (_, body) => {
        const res = await post(body);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "item_id, quantity, and type are required",
        });
        expect(prismaMock.item.findUnique).not.toHaveBeenCalled();
      });

      it("returns 400 for a negative quantity", async () => {
        const res = await post(manualUsed({ quantity: -1 }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "quantity must be non-negative",
        });
      });

      it.each(["RETURNED", "used", ""].filter(Boolean))(
        "returns 400 for the type %j",
        async (type) => {
          const res = await post(manualUsed({ type }));

          expect(res.status).toBe(400);
          expect(await res.json()).toEqual({
            status: false,
            message: "type must be either 'ADDED', 'USED', or 'WASTED'",
          });
        },
      );

      it("returns 400 when an ADDED transaction has no purchase_order_id", async () => {
        const res = await post(added({ purchase_order_id: undefined }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "purchase_order_id is required for ADDED transactions",
        });
        expect(prismaMock.item.findUnique).not.toHaveBeenCalled();
      });

      // Current behaviour: a zero quantity is accepted and recorded.
      it("accepts a quantity of zero", async () => {
        const res = await post(manualUsed({ quantity: 0 }));

        expect(res.status).toBe(200);
        expect(prismaMock.stock_transaction.create).toHaveBeenCalledOnce();
      });
    });

    describe("manual USED (no MTO)", () => {
      it("records the usage, reduces stock and returns the transaction", async () => {
        const res = await post(
          manualUsed({ notes: "Cut list 4", project_id: "p1", lot_id: "l1" }),
        );

        // Current behaviour: success is 200, not 201.
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "Material used recorded successfully",
          data: {
            id: "txn-1",
            item_id: "ITEM-A",
            quantity: 3,
            type: "USED",
            notes: "Cut list 4",
            project_id: "p1",
            lot_id: "l1",
          },
        });
        expect(prismaMock.item.updateMany).toHaveBeenCalledWith({
          where: { item_id: "ITEM-A", quantity: { gte: 3 } },
          data: { quantity: { decrement: 3 } },
        });
      });

      it("uses a default note and null project and lot", async () => {
        await post(manualUsed());

        expect(prismaMock.stock_transaction.create).toHaveBeenCalledWith({
          data: {
            item_id: "ITEM-A",
            quantity: 3,
            type: "USED",
            notes: "Manually recorded used quantity",
            project_id: null,
            lot_id: null,
          },
        });
      });

      it("writes the stock change and transaction in one transaction", async () => {
        await post(manualUsed());

        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
      });

      it("allows using exactly the available stock", async () => {
        mockBase({ stock: 3 });

        expect((await post(manualUsed())).status).toBe(200);
      });

      it("returns 404 when the item does not exist", async () => {
        mockBase({ exists: false });

        const res = await post(manualUsed());

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Item not found",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it("returns 400 when the stock is too low", async () => {
        mockBase({ stock: 2 });

        const res = await post(manualUsed({ quantity: 5 }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Insufficient quantity. Available: 2, Requested: 5",
        });
        expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
      });

      it("returns 400 when stock runs out between the check and the update", async () => {
        mockBase({ stock: 10 });
        prismaMock.item.updateMany.mockResolvedValue({ count: 0 });
        prismaMock.item.findUnique.mockImplementation(async (args) =>
          args?.select?.item_id
            ? { item_id: "ITEM-A", quantity: 10 }
            : { quantity: 1 },
        );

        const res = await post(manualUsed({ quantity: 5 }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Not enough quantity in inventory for item ITEM-A. Available: 1, Requested: 5",
        });
        expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
      });

      it("returns 500 when the write fails", async () => {
        prismaMock.stock_transaction.create.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await post(manualUsed());

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
        expect(sendNotification).not.toHaveBeenCalled();
      });
    });

    describe("MTO USED", () => {
      beforeEach(() => {
        mockMto();
      });

      it("takes the quantity from stock, updates quantity_used and records the transaction", async () => {
        const res = await post(mtoUsed({ quantity: 3 }));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "Quantity used updated successfully",
          data: { id: "mi-1", quantity_used: 5 },
        });
        expect(
          prismaMock.materials_to_order_item.findFirst,
        ).toHaveBeenCalledWith({
          where: { mto_id: "mto-1", item_id: "ITEM-A" },
          include: { mto: true, item: true },
        });
        expect(prismaMock.item.updateMany).toHaveBeenCalledWith({
          where: { item_id: "ITEM-A", quantity: { gte: 3 } },
          data: { quantity: { decrement: 3 } },
        });
        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith({
          where: { id: "mi-1" },
          data: { quantity_used: 5 },
          include: { item: true, mto: true },
        });
        expect(prismaMock.stock_transaction.create).toHaveBeenCalledWith({
          data: {
            item_id: "ITEM-A",
            quantity: 3,
            type: "USED",
            materials_to_order_id: "mto-1",
            notes: "Used from MTO mto-1",
          },
        });
      });

      it("uses the caller's note when given", async () => {
        await post(mtoUsed({ notes: "Kitchen run" }));

        expect(
          prismaMock.stock_transaction.create.mock.calls[0][0].data.notes,
        ).toBe("Kitchen run");
      });

      it("treats a missing quantity_used as zero", async () => {
        mockMto({ line: { quantity_used: null } });

        await post(mtoUsed({ quantity: 4 }));

        expect(
          prismaMock.materials_to_order_item.update.mock.calls[0][0].data
            .quantity_used,
        ).toBe(4);
      });

      describe("reservations", () => {
        const reservation = (overrides = {}) => ({
          id: "r1",
          item_id: "ITEM-A",
          quantity: 5,
          used_quantity: 0,
          ...overrides,
        });

        it("reads this MTO item's reservations, oldest first", async () => {
          await post(mtoUsed());

          expect(prismaMock.reserve_item_stock.findMany).toHaveBeenCalledWith({
            where: { item_id: "ITEM-A", mto_id: "mi-1" },
            orderBy: { createdAt: "asc" },
          });
        });

        it("uses part of a reservation without touching stock", async () => {
          mockMto({ reservations: [reservation()] });

          await post(mtoUsed({ quantity: 3 }));

          expect(prismaMock.reserve_item_stock.update).toHaveBeenCalledWith({
            where: { id: "r1" },
            data: { used_quantity: { increment: 3 } },
          });
          expect(prismaMock.reserve_item_stock.delete).not.toHaveBeenCalled();
          expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
        });

        it("deletes a reservation that is used up exactly", async () => {
          mockMto({
            reservations: [reservation({ quantity: 3, used_quantity: 0 })],
          });

          await post(mtoUsed({ quantity: 3 }));

          expect(prismaMock.reserve_item_stock.delete).toHaveBeenCalledWith({
            where: { id: "r1" },
          });
          expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
        });

        it("counts only what is left unused in a partly used reservation", async () => {
          mockMto({
            reservations: [reservation({ quantity: 5, used_quantity: 3 })],
          });

          await post(mtoUsed({ quantity: 2 }));

          // 2 left in the reservation, 2 requested: used up exactly
          expect(prismaMock.reserve_item_stock.delete).toHaveBeenCalledWith({
            where: { id: "r1" },
          });
        });

        it("takes the rest from stock when reservations are not enough", async () => {
          mockMto({ reservations: [reservation({ quantity: 2 })] });

          await post(mtoUsed({ quantity: 6 }));

          expect(prismaMock.reserve_item_stock.delete).toHaveBeenCalledWith({
            where: { id: "r1" },
          });
          expect(prismaMock.item.updateMany).toHaveBeenCalledWith({
            where: { item_id: "ITEM-A", quantity: { gte: 4 } },
            data: { quantity: { decrement: 4 } },
          });
        });

        it("spreads across several reservations in order", async () => {
          mockMto({
            reservations: [
              reservation({ id: "r1", quantity: 2 }),
              reservation({ id: "r2", quantity: 5 }),
            ],
          });

          await post(mtoUsed({ quantity: 4 }));

          expect(prismaMock.reserve_item_stock.delete).toHaveBeenCalledWith({
            where: { id: "r1" },
          });
          expect(prismaMock.reserve_item_stock.update).toHaveBeenCalledWith({
            where: { id: "r2" },
            data: { used_quantity: { increment: 2 } },
          });
          expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
        });

        it("clears away a reservation that was already fully used and moves on", async () => {
          mockMto({
            reservations: [
              reservation({ id: "r0", quantity: 3, used_quantity: 3 }),
              reservation({ id: "r1", quantity: 5 }),
            ],
          });

          await post(mtoUsed({ quantity: 2 }));

          expect(prismaMock.reserve_item_stock.delete).toHaveBeenCalledWith({
            where: { id: "r0" },
          });
          expect(prismaMock.reserve_item_stock.update).toHaveBeenCalledWith({
            where: { id: "r1" },
            data: { used_quantity: { increment: 2 } },
          });
        });

        it("leaves later reservations alone once the quantity is covered", async () => {
          mockMto({
            reservations: [
              reservation({ id: "r1", quantity: 5 }),
              reservation({ id: "r2", quantity: 5 }),
            ],
          });

          await post(mtoUsed({ quantity: 5 }));

          expect(prismaMock.reserve_item_stock.delete).toHaveBeenCalledTimes(1);
          expect(prismaMock.reserve_item_stock.update).not.toHaveBeenCalled();
        });
      });

      describe("completing the MTO", () => {
        it("marks used material completed once every line is fully used", async () => {
          mockMto({
            mto: {
              items: [
                { quantity: 10, quantity_used: 10 },
                { quantity: 4, quantity_used: 6 },
              ],
            },
          });

          await post(mtoUsed());

          expect(prismaMock.materials_to_order.update).toHaveBeenCalledWith({
            where: { id: "mto-1" },
            data: { used_material_completed: true },
          });
        });

        it("does not complete it while a line is still short", async () => {
          mockMto({
            mto: {
              items: [
                { quantity: 10, quantity_used: 10 },
                { quantity: 4, quantity_used: 1 },
              ],
            },
          });

          await post(mtoUsed());

          expect(prismaMock.materials_to_order.update).not.toHaveBeenCalled();
        });

        it("does not complete it again when it is already complete", async () => {
          mockMto({
            mto: {
              used_material_completed: true,
              items: [{ quantity: 10, quantity_used: 10 }],
            },
          });

          await post(mtoUsed());

          expect(prismaMock.materials_to_order.update).not.toHaveBeenCalled();
        });
      });

      describe("errors", () => {
        it.each([
          ["does not exist", null],
          [
            "belongs to a deleted MTO",
            { id: "mi-1", quantity: 10, mto: { is_deleted: true } },
          ],
        ])("returns 404 when the MTO item %s", async (_, found) => {
          prismaMock.materials_to_order_item.findFirst.mockResolvedValue(found);

          const res = await post(mtoUsed());

          expect(res.status).toBe(404);
          expect(await res.json()).toEqual({
            status: false,
            message: "Materials to order item not found",
          });
          expect(prismaMock.$transaction).not.toHaveBeenCalled();
        });

        it("returns 404 when the inventory item does not exist", async () => {
          prismaMock.item.findUnique.mockResolvedValue(null);

          const res = await post(mtoUsed());

          expect(res.status).toBe(404);
          expect(await res.json()).toEqual({
            status: false,
            message: "Item not found",
          });
        });

        it("returns 400 when the total used would exceed what is required", async () => {
          const res = await post(mtoUsed({ quantity: 9 }));

          expect(res.status).toBe(400);
          expect(await res.json()).toEqual({
            status: false,
            message:
              "Used quantity cannot exceed total quantity. Total: 10, Current used: 2, Requested: 9",
          });
          expect(prismaMock.$transaction).not.toHaveBeenCalled();
        });

        it("allows using up to exactly the required quantity", async () => {
          expect((await post(mtoUsed({ quantity: 8 }))).status).toBe(200);
        });

        // Current behaviour (bug): the route splits the internal error text
        // "INSUFFICIENT_INVENTORY:item:requested:available" with the wrong
        // indexes, so the message shows the requested quantity as "Available"
        // and the item id as "Requested".
        it("returns 400 with a scrambled message when stock is insufficient", async () => {
          prismaMock.item.updateMany.mockResolvedValue({ count: 0 });
          prismaMock.item.findUnique.mockImplementation(async (args) =>
            args?.select?.quantity && !args.select.item_id
              ? { quantity: 1 }
              : { item_id: "ITEM-A" },
          );

          const res = await post(mtoUsed({ quantity: 3 }));

          expect(res.status).toBe(400);
          expect(await res.json()).toEqual({
            status: false,
            message:
              "Not enough quantity in inventory. Available: 3, Requested: ITEM-A",
          });
          expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
        });

        it("returns 500 when the transaction fails", async () => {
          prismaMock.materials_to_order_item.update.mockRejectedValue(
            new Error("DB down"),
          );

          const res = await post(mtoUsed());

          expect(res.status).toBe(500);
          expect(await res.json()).toEqual({
            status: false,
            message: "Internal server error",
          });
        });
      });
    });

    describe("ADDED (purchase order)", () => {
      beforeEach(() => {
        mockPo();
      });

      it("raises the PO line's received quantity and stock, and records the transaction", async () => {
        const res = await post(added({ quantity: 3 }));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "Quantity received updated successfully",
          data: FINAL_PO,
        });
        expect(prismaMock.purchase_order_item.findFirst).toHaveBeenCalledWith({
          where: { order_id: "po-1", item_id: "ITEM-A" },
          include: { order: true, item: true },
        });
        expect(prismaMock.purchase_order_item.update).toHaveBeenCalledWith({
          where: { id: "poi-1" },
          data: { quantity_received: 5 },
        });
        expect(prismaMock.item.update).toHaveBeenCalledWith({
          where: { item_id: "ITEM-A" },
          data: { quantity: { increment: 3 } },
        });
        expect(prismaMock.stock_transaction.create).toHaveBeenCalledWith({
          data: {
            item_id: "ITEM-A",
            quantity: 3,
            type: "ADDED",
            purchase_order_id: "po-1",
            notes: "Received from PO po-1",
          },
        });
      });

      it("uses the caller's note when given", async () => {
        await post(added({ notes: "Pallet 2" }));

        expect(
          prismaMock.stock_transaction.create.mock.calls[0][0].data.notes,
        ).toBe("Pallet 2");
      });

      it("treats a missing quantity_received as zero", async () => {
        mockPo({ line: { quantity_received: null } });

        await post(added({ quantity: 3 }));

        expect(
          prismaMock.purchase_order_item.update.mock.calls[0][0].data,
        ).toEqual({
          quantity_received: 3,
        });
      });

      // Current behaviour: unlike POST /purchase_order/received_items, there
      // is no check against the ordered quantity.
      it("accepts receiving more than was ordered", async () => {
        const res = await post(added({ quantity: 50 }));

        expect(res.status).toBe(200);
      });

      describe("PO status", () => {
        it("becomes FULLY_RECEIVED when every line is complete", async () => {
          mockPo({ poItems: [{ quantity: 10, quantity_received: 10 }] });

          await post(added());

          expect(prismaMock.purchase_order.update).toHaveBeenCalledWith({
            where: { id: "po-1" },
            data: { status: "FULLY_RECEIVED" },
          });
        });

        it("becomes PARTIALLY_RECEIVED when only some stock has arrived", async () => {
          mockPo({ poItems: [{ quantity: 10, quantity_received: 5 }] });

          await post(added());

          expect(prismaMock.purchase_order.update).toHaveBeenCalledWith({
            where: { id: "po-1" },
            data: { status: "PARTIALLY_RECEIVED" },
          });
        });

        it("is left alone when it is already correct", async () => {
          mockPo({
            status: "PARTIALLY_RECEIVED",
            poItems: [{ quantity: 10, quantity_received: 5 }],
          });

          await post(added());

          expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
        });

        it("never changes a CANCELLED purchase order", async () => {
          mockPo({
            status: "CANCELLED",
            poItems: [{ quantity: 10, quantity_received: 10 }],
          });

          const res = await post(added());

          expect(res.status).toBe(200);
          expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
        });
      });

      it("returns the PO with its relations after the transaction", async () => {
        await post(added());

        const finalCall = prismaMock.purchase_order.findUnique.mock.calls.find(
          ([args]) => args.include.supplier,
        );
        expect(finalCall[0].where).toEqual({ id: "po-1" });
      });

      it("returns 404 when the PO line does not exist", async () => {
        prismaMock.purchase_order_item.findFirst.mockResolvedValue(null);

        const res = await post(added());

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Purchase order item not found",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it("returns 404 when the inventory item does not exist", async () => {
        prismaMock.item.findUnique.mockResolvedValue(null);

        const res = await post(added());

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Item not found",
        });
      });

      // Current behaviour: the ADDED transaction code has no try/catch of its
      // own, so a failed write reaches the outer handler.
      it("returns 500 when the transaction fails", async () => {
        prismaMock.purchase_order_item.update.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await post(added());

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
      });
    });

    describe("WASTED", () => {
      it("reduces stock, records the transaction and returns the updated item", async () => {
        const res = await post(wasted({ notes: "Dropped" }));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "Wasted quantity recorded successfully",
          data: fullItem(),
        });
        expect(prismaMock.item.updateMany).toHaveBeenCalledWith({
          where: { item_id: "ITEM-A", quantity: { gte: 3 } },
          data: { quantity: { decrement: 3 } },
        });
        expect(prismaMock.stock_transaction.create).toHaveBeenCalledWith({
          data: {
            item_id: "ITEM-A",
            quantity: 3,
            type: "WASTED",
            notes: "Dropped",
          },
        });
      });

      it("uses a default note", async () => {
        await post(wasted());

        expect(
          prismaMock.stock_transaction.create.mock.calls[0][0].data.notes,
        ).toBe("Wasted item quantity");
      });

      it("returns 404 when the item does not exist", async () => {
        mockBase({ exists: false });

        const res = await post(wasted());

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Item not found",
        });
      });

      it("returns 400 when stock is insufficient", async () => {
        prismaMock.item.updateMany.mockResolvedValue({ count: 0 });
        prismaMock.item.findUnique.mockImplementation(async (args) =>
          args?.select?.quantity && !args.select.item_id
            ? { quantity: 1 }
            : { item_id: "ITEM-A" },
        );

        const res = await post(wasted({ quantity: 5 }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Not enough quantity in inventory for item ITEM-A. Available: 1, Requested: 5",
        });
        expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
      });

      it("returns 500 when the write fails", async () => {
        prismaMock.stock_transaction.create.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await post(wasted());

        expect(res.status).toBe(500);
      });
    });

    describe("logging", () => {
      it("logs a manual USED transaction against the transaction id", async () => {
        await post(manualUsed());

        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: {
            user_id: "user-1",
            entity_type: "stock_transaction",
            entity_id: "txn-1",
            action: "CREATE",
            description:
              "Stock transaction created successfully: USED for item: ITEM-A",
          },
        });
      });

      // Current behaviour: the log uses the id of whatever the handler returns,
      // which is not the stock transaction for these two types.
      it("logs an MTO USED transaction against the MTO item id", async () => {
        mockMto();

        await post(mtoUsed());

        expect(prismaMock.logs.create.mock.calls[0][0].data.entity_id).toBe(
          "mi-1",
        );
      });

      it("logs an ADDED transaction against the purchase order id", async () => {
        mockPo();

        await post(added());

        expect(prismaMock.logs.create.mock.calls[0][0].data.entity_id).toBe(
          "po-1",
        );
      });

      // Current behaviour (bug): WASTED returns the item, which has no `id`
      // field (its key is item_id), so no log entry is ever written.
      it("writes no log for a WASTED transaction", async () => {
        const res = await post(wasted());

        expect(res.status).toBe(200);
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 200 with a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await post(manualUsed());

        expect(res.status).toBe(200);
        expect((await res.json()).warning).toBe(
          "Note: Creation succeeded but logging failed",
        );
      });

      it("does not log or notify when the handler fails", async () => {
        mockBase({ stock: 1 });

        await post(manualUsed({ quantity: 5 }));

        expect(prismaMock.logs.create).not.toHaveBeenCalled();
        expect(sendNotification).not.toHaveBeenCalled();
      });
    });

    describe("notification", () => {
      const notified = () => sendNotification.mock.calls[0];

      it("is sent with the item name and transaction details", async () => {
        mockBase({
          full: fullItem({
            sheet: {
              brand: "Polytec",
              color: "White",
              finish: "Matte",
              dimensions: "2400x1200",
            },
          }),
        });

        await post(manualUsed({ quantity: 3 }));

        expect(sendNotification).toHaveBeenCalledTimes(1);
        expect(notified()).toEqual([
          {
            type: "stock_transaction",
            item_id: "ITEM-A",
            quantity: 3,
            transaction_type: "USED",
            item_name: "Brand: Polytec, Color: White, Finish: Matte",
            dimensions: "2400x1200",
          },
          "stock_transaction_created",
        ]);
      });

      it.each([
        [
          "a handle",
          {
            handle: {
              brand: "Hafele",
              color: "Black",
              type: "Bar",
              material: "Steel",
              dimensions: "128mm",
            },
          },
          "Handle: Hafele, Color: Black, Type: Bar, Material: Steel",
          "128mm",
        ],
        [
          "hardware",
          {
            hardware: {
              brand: "Blum",
              name: "Hinge",
              type: "Soft",
              dimensions: "35mm",
            },
          },
          "Hardware: Blum, Name: Hinge, Type: Soft",
          "35mm",
        ],
        [
          "an accessory",
          { accessory: { name: "Bin" } },
          "Accessory: Bin",
          "N/A",
        ],
        [
          "edging tape",
          {
            edging_tape: {
              brand: "Rehau",
              color: "Oak",
              finish: "Gloss",
              dimensions: "22mm",
            },
          },
          "Edging Tape: Rehau, Color: Oak, Finish: Gloss",
          "22mm",
        ],
      ])("describes %s", async (_, detail, name, dimensions) => {
        mockBase({ full: fullItem(detail) });

        await post(manualUsed());

        expect(notified()[0]).toMatchObject({ item_name: name, dimensions });
      });

      it("uses N/A for a missing brand", async () => {
        mockBase({
          full: fullItem({ sheet: { brand: null, color: "White" } }),
        });

        await post(manualUsed());

        expect(notified()[0].item_name).toBe("Brand: N/A, Color: White");
      });

      it("falls back to the item id when there is no detail record", async () => {
        await post(manualUsed());

        expect(notified()[0]).toMatchObject({
          item_name: "ITEM-A",
          dimensions: "N/A",
        });
      });

      it("falls back to Unknown Item when the item cannot be found afterwards", async () => {
        prismaMock.item.findUnique.mockImplementation(async (args) =>
          args?.include
            ? null
            : args?.select?.item_id
              ? { item_id: "ITEM-A", quantity: 10 }
              : { item_id: "ITEM-A" },
        );

        await post(manualUsed());

        expect(notified()[0]).toMatchObject({
          item_name: "Unknown Item",
          dimensions: "N/A",
        });
      });

      it.each([
        ["USED", manualUsed()],
        ["WASTED", wasted()],
      ])("reports the %s transaction type", async (type, body) => {
        await post(body);

        expect(notified()[0].transaction_type).toBe(type);
      });

      it("still returns 200 when the notification fails", async () => {
        sendNotification.mockRejectedValue(new Error("WhatsApp down"));

        const res = await post(manualUsed());

        expect(res.status).toBe(200);
      });
    });

    it("returns 500 for a malformed JSON body", async () => {
      const res = await POST(
        buildRequest(URL, {
          method: "POST",
          rawBody: "{not json",
          headers: { "content-type": "application/json" },
        }),
      );

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
