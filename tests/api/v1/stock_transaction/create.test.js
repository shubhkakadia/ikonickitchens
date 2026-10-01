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

// MTO flow: a line with 10 required, 2 already used, nothing reserved.
// `claims` is whether the guarded quantity_used increment still applies.
function mockMto({
  line = {},
  reservations = [],
  mto = {},
  claims = true,
} = {}) {
  mockBase();
  const stored = {
    id: "mi-1",
    quantity: 10,
    quantity_used: 2,
    mto: { is_deleted: false },
    ...line,
  };
  prismaMock.materials_to_order_item.findFirst.mockResolvedValue(stored);
  // inside the transaction: the locked re-read, then the row for the response
  prismaMock.materials_to_order_item.findUnique.mockImplementation(
    async (args) =>
      args?.include
        ? { id: "mi-1", quantity_used: "after-increment" }
        : { quantity: stored.quantity, quantity_used: stored.quantity_used },
  );
  prismaMock.materials_to_order_item.updateMany.mockResolvedValue({
    count: claims ? 1 : 0,
  });
  prismaMock.reserve_item_stock.findMany.mockResolvedValue(reservations);
  prismaMock.reserve_item_stock.delete.mockResolvedValue({});
  prismaMock.reserve_item_stock.update.mockResolvedValue({});
  prismaMock.materials_to_order.findUnique.mockResolvedValue({
    id: "mto-1",
    used_material_completed: false,
    items: [{ quantity: 10, quantity_used: 5 }],
    ...mto,
  });
  prismaMock.materials_to_order.update.mockResolvedValue({});
}

// Purchase order flow: a line of 10 with 2 already received.
// `after` = the PO lines as they look once the receipt has been applied.
const FINAL_PO = { id: "po-1", status: "FINAL", items: [] };
const poLine = (overrides = {}) => ({
  id: "poi-1",
  order_id: "po-1",
  item_id: "ITEM-A",
  quantity: 10,
  quantity_received: 2,
  ...overrides,
});
function mockPo({
  lines = [poLine()],
  after,
  status = "ORDERED",
  claims = true,
} = {}) {
  mockBase();
  prismaMock.purchase_order.findUnique.mockImplementation(async (args) =>
    args?.include?.supplier ? FINAL_PO : { id: "po-1", status, items: lines },
  );
  prismaMock.purchase_order_item.updateMany.mockResolvedValue({
    count: claims ? 1 : 0,
  });
  prismaMock.purchase_order_item.findMany.mockResolvedValue(after ?? lines);
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
          data: { id: "mi-1", quantity_used: "after-increment" },
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
        // quantity_used is incremented under a guard, never written as an
        // absolute value computed from an earlier read
        expect(
          prismaMock.materials_to_order_item.updateMany,
        ).toHaveBeenCalledWith({
          where: { id: "mi-1", quantity_used: { lte: 7 } },
          data: { quantity_used: { increment: 3 } },
        });
        expect(prismaMock.materials_to_order_item.update).not.toHaveBeenCalled();
        expect(
          prismaMock.materials_to_order_item.findUnique,
        ).toHaveBeenLastCalledWith({
          where: { id: "mi-1" },
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

        const res = await post(mtoUsed({ quantity: 4 }));

        expect(res.status).toBe(200);
        expect(
          prismaMock.materials_to_order_item.updateMany.mock.calls[0][0].where
            .quantity_used,
        ).toEqual({ lte: 6 });
      });

      it("locks the MTO line before reading or writing anything", async () => {
        await post(mtoUsed());

        expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
        const [strings, ...values] = prismaMock.$queryRaw.mock.calls[0];
        expect(strings.join("?")).toMatch(
          /FROM materials_to_order_item[\s\S]*FOR UPDATE/,
        );
        expect(values).toEqual(["mi-1"]);
        const lockedAt = prismaMock.$queryRaw.mock.invocationCallOrder[0];
        expect(lockedAt).toBeLessThan(
          prismaMock.materials_to_order_item.updateMany.mock
            .invocationCallOrder[0],
        );
        expect(lockedAt).toBeLessThan(
          prismaMock.reserve_item_stock.findMany.mock.invocationCallOrder[0],
        );
      });

      it("does not over-use when two requests race for the last units", async () => {
        // A line needing 10 with 2 used leaves room for 8. Two requests of 5
        // each pass a stale read, but only one guarded increment can win.
        let used = 2;
        prismaMock.materials_to_order_item.findUnique.mockImplementation(
          async (args) =>
            args?.include
              ? { id: "mi-1", quantity_used: used }
              : { quantity: 10, quantity_used: 2 }, // stale for the loser
        );
        prismaMock.materials_to_order_item.updateMany.mockImplementation(
          async ({ where, data }) => {
            if (used <= where.quantity_used.lte) {
              used += data.quantity_used.increment;
              return { count: 1 };
            }
            return { count: 0 };
          },
        );

        const [a, b] = await Promise.all([
          post(mtoUsed({ quantity: 5 })),
          post(mtoUsed({ quantity: 5 })),
        ]);

        expect([a.status, b.status].sort()).toEqual([200, 409]);
        expect(used).toBe(7);
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
          // refused inside the transaction, so nothing was written
          expect(
            prismaMock.materials_to_order_item.updateMany,
          ).not.toHaveBeenCalled();
          expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
          expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
        });

        it("checks the cap against the locked, current row rather than the first read", async () => {
          // the lookup before the lock saw 2 used; by the time we hold the
          // lock another request has used 7
          mockMto();
          prismaMock.materials_to_order_item.findUnique.mockImplementation(
            async () => ({ quantity: 10, quantity_used: 9 }),
          );

          const res = await post(mtoUsed({ quantity: 3 }));

          expect(res.status).toBe(400);
          expect((await res.json()).message).toBe(
            "Used quantity cannot exceed total quantity. Total: 10, Current used: 9, Requested: 3",
          );
          expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
        });

        it("returns 409 when the guarded increment no longer applies", async () => {
          mockMto({ claims: false });

          const res = await post(mtoUsed({ quantity: 3 }));

          expect(res.status).toBe(409);
          expect(await res.json()).toEqual({
            status: false,
            message:
              "Used quantity was changed by someone else. Reload and try again.",
          });
          expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
          expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
        });

        it("returns 404 when the line disappears before the lock is taken", async () => {
          mockMto();
          prismaMock.materials_to_order_item.findUnique.mockResolvedValue(null);

          const res = await post(mtoUsed());

          expect(res.status).toBe(404);
        });

        it("allows using up to exactly the required quantity", async () => {
          expect((await post(mtoUsed({ quantity: 8 }))).status).toBe(200);
        });

        it.each([
          ["a fraction", 2.5],
          ["a numeric string with a fraction", "1.5"],
          ["not a number", "abc"],
          ["zero", 0],
        ])("returns 400 when the quantity is %s", async (_, quantity) => {
          const res = await post(mtoUsed({ quantity }));

          expect(res.status).toBe(400);
          expect(await res.json()).toEqual({
            status: false,
            message: "quantity must be a positive whole number",
          });
          expect(prismaMock.$transaction).not.toHaveBeenCalled();
        });

        it("accepts a whole number sent as a string", async () => {
          const res = await post(mtoUsed({ quantity: "3" }));

          expect(res.status).toBe(200);
          expect(
            prismaMock.materials_to_order_item.updateMany.mock.calls[0][0].data,
          ).toEqual({ quantity_used: { increment: 3 } });
        });

        it("returns 400 with the real available and requested figures when stock is insufficient", async () => {
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
              "Not enough quantity in inventory. Available: 1, Requested: 3",
          });
          expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
        });

        it("returns 500 when the transaction fails", async () => {
          prismaMock.materials_to_order_item.updateMany.mockRejectedValue(
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

      it("claims the PO line with a guarded increment, raises stock, and records the transaction", async () => {
        const res = await post(added({ quantity: 3 }));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "Quantity received updated successfully",
          data: FINAL_PO,
        });
        // 10 ordered - 3 = 7: the write only applies while the line has room
        expect(prismaMock.purchase_order_item.updateMany).toHaveBeenCalledWith({
          where: { id: "poi-1", quantity_received: { lte: 7 } },
          data: { quantity_received: { increment: 3 } },
        });
        expect(prismaMock.purchase_order_item.update).not.toHaveBeenCalled();
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

      it("uses the same locked logic as received_items: locks the PO row first", async () => {
        await post(added());

        expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
        const [strings, ...values] = prismaMock.$queryRaw.mock.calls[0];
        expect(strings.join("?")).toMatch(/FROM purchase_order[\s\S]*FOR UPDATE/);
        expect(values).toEqual(["po-1"]);
        expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
          prismaMock.purchase_order_item.updateMany.mock.invocationCallOrder[0],
        );
      });

      it("uses the caller's note when given", async () => {
        await post(added({ notes: "Pallet 2" }));

        expect(
          prismaMock.stock_transaction.create.mock.calls[0][0].data.notes,
        ).toBe("Pallet 2");
      });

      it("treats a missing quantity_received as zero", async () => {
        mockPo({ lines: [poLine({ quantity_received: null })] });

        await post(added({ quantity: 3 }));

        expect(prismaMock.purchase_order_item.updateMany).toHaveBeenCalledWith({
          where: { id: "poi-1", quantity_received: null },
          data: { quantity_received: 3 },
        });
      });

      it("allows receiving up to exactly the ordered quantity", async () => {
        const res = await post(added({ quantity: 8 }));

        expect(res.status).toBe(200);
      });

      it("refuses to receive more than was ordered", async () => {
        const res = await post(added({ quantity: 50 }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Cannot receive more than ordered quantity for item ITEM-A. Ordered: 10, Already received: 2, Requested: 50, Remaining: 8",
        });
        expect(prismaMock.purchase_order_item.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.item.update).not.toHaveBeenCalled();
        expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
      });

      it.each(["DRAFT", "CANCELLED"])(
        "refuses to receive against a %s purchase order",
        async (status) => {
          mockPo({ status });

          const res = await post(added());

          expect(res.status).toBe(400);
          expect((await res.json()).message).toMatch(
            new RegExp(`${status} purchase order`),
          );
          expect(prismaMock.item.update).not.toHaveBeenCalled();
          expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
          expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
          expect(prismaMock.logs.create).not.toHaveBeenCalled();
        },
      );

      it.each([
        ["a fraction", 2.5],
        ["zero", 0],
        ["not a number", "abc"],
      ])("returns 400 when the quantity is %s", async (_, quantity) => {
        const res = await post(added({ quantity }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Quantity must be a positive whole number for item ITEM-A",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it("returns 409 when the line was changed since it was read", async () => {
        mockPo({ claims: false });

        const res = await post(added());

        expect(res.status).toBe(409);
        expect(prismaMock.item.update).not.toHaveBeenCalled();
        expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
      });

      describe("PO status", () => {
        it("becomes FULLY_RECEIVED when every line is complete", async () => {
          mockPo({ after: [poLine({ quantity_received: 10 })] });

          await post(added());

          expect(prismaMock.purchase_order.update).toHaveBeenCalledWith({
            where: { id: "po-1" },
            data: { status: "FULLY_RECEIVED" },
          });
        });

        it("becomes PARTIALLY_RECEIVED when only some stock has arrived", async () => {
          mockPo({ after: [poLine({ quantity_received: 5 })] });

          await post(added());

          expect(prismaMock.purchase_order.update).toHaveBeenCalledWith({
            where: { id: "po-1" },
            data: { status: "PARTIALLY_RECEIVED" },
          });
        });

        it("is left alone when it is already correct", async () => {
          mockPo({
            status: "PARTIALLY_RECEIVED",
            after: [poLine({ quantity_received: 5 })],
          });

          await post(added());

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

      it("returns 404 when the item is not on the purchase order", async () => {
        mockPo({ lines: [poLine({ item_id: "ITEM-OTHER" })] });

        const res = await post(added());

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Item ITEM-A not found in purchase order po-1",
        });
      });

      it("returns 404 when the purchase order does not exist", async () => {
        prismaMock.purchase_order.findUnique.mockResolvedValue(null);

        const res = await post(added());

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Purchase order not found: po-1",
        });
      });

      it("returns 404 when the inventory item does not exist", async () => {
        prismaMock.item.findUnique.mockResolvedValue(null);

        const res = await post(added());

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Inventory item not found: ITEM-A",
        });
      });

      // Unexpected failures reach the outer handler
      it("returns 500 when the transaction fails", async () => {
        prismaMock.purchase_order_item.updateMany.mockRejectedValue(
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
