// Tests for src/app/api/v1/purchase_order/received_items/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { POST } =
  await import("@/app/api/v1/purchase_order/received_items/route");

const URL = "/api/v1/purchase_order/received_items";
const PO_ID = "po-1";

const post = (body, options = {}) =>
  POST(
    buildRequest(URL, {
      method: "POST",
      body: body ?? {
        purchase_order_id: PO_ID,
        items: [{ item_id: "ITEM-A", quantity: 3 }],
      },
      ...options,
    }),
  );

const receive = (items) => post({ purchase_order_id: PO_ID, items });

const poItem = (overrides = {}) => ({
  id: "poi-a",
  order_id: PO_ID,
  item_id: "ITEM-A",
  quantity: 10,
  quantity_received: 0,
  ...overrides,
});

// `before` = PO items as first read; `after` = PO items after the updates;
// `claims` = whether the guarded line updates still apply
function mockReceive({
  status = "ORDERED",
  before = [poItem()],
  after,
  missingPo = false,
  missingInventory = false,
  claims = true,
} = {}) {
  const final = { id: PO_ID, status: "FINAL", items: [] };
  prismaMock.purchase_order.findUnique.mockImplementation(async (args) => {
    if (args.include?.supplier) return final; // post-transaction fetch
    return missingPo ? null : { id: PO_ID, status, items: before };
  });
  prismaMock.item.findUnique.mockImplementation(async ({ where }) =>
    missingInventory ? null : { item_id: where.item_id },
  );
  prismaMock.purchase_order_item.updateMany.mockResolvedValue({
    count: claims ? 1 : 0,
  });
  prismaMock.item.update.mockResolvedValue({});
  prismaMock.stock_transaction.create.mockResolvedValue({});
  prismaMock.purchase_order_item.findMany.mockResolvedValue(after ?? before);
  prismaMock.purchase_order.update.mockResolvedValue({});
  prismaMock.logs.create.mockResolvedValue({});
  return final;
}

describe("POST /api/v1/purchase_order/received_items", () => {
  describeAuthorization((options) => post(undefined, options), {
    modules: "purchaseorder",
    setup: () => mockReceive(),
    untouched: () => [
      prismaMock.purchase_order.findUnique,
      prismaMock.$transaction,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockReceive();
    });

    describe("validation", () => {
      it("returns 400 when purchase_order_id is missing", async () => {
        const res = await post({ items: [{ item_id: "A", quantity: 1 }] });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "purchase_order_id is required",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it.each([
        ["missing", undefined],
        ["not an array", "x"],
        ["empty", []],
      ])("returns 400 when items is %s", async (_, items) => {
        const res = await post({ purchase_order_id: PO_ID, items });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "items array is required and must not be empty",
        });
      });

      it.each([
        ["item_id", { quantity: 1 }],
        ["quantity", { item_id: "A" }],
        ["a quantity of null", { item_id: "A", quantity: null }],
      ])("returns 400 when an item has no %s", async (_, line) => {
        const res = await post({ purchase_order_id: PO_ID, items: [line] });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Each item must have item_id and quantity",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it.each([
        ["negative", -1],
        ["zero", 0],
        ["a fraction", 2.5],
        ["not a number", "abc"],
        ["Infinity", "Infinity"],
      ])("returns 400 when a quantity is %s", async (_, quantity) => {
        const res = await receive([{ item_id: "ITEM-A", quantity }]);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Quantity must be a positive whole number for item ITEM-A",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it("accepts a whole number sent as a string", async () => {
        const res = await receive([{ item_id: "ITEM-A", quantity: "3" }]);

        expect(res.status).toBe(200);
        expect(
          prismaMock.purchase_order_item.updateMany.mock.calls[0][0].data,
        ).toEqual({ quantity_received: { increment: 3 } });
      });
    });

    describe("receiving stock", () => {
      it("locks the PO row first, then records the receipt and returns the PO", async () => {
        const final = mockReceive();

        const res = await post();

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "Successfully received 1 item(s)",
          data: final,
        });
        expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
        const [strings, ...values] = prismaMock.$queryRaw.mock.calls[0];
        expect(strings.join("?")).toMatch(/FROM purchase_order[\s\S]*FOR UPDATE/);
        expect(values).toEqual([PO_ID]);
        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
        expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
          prismaMock.purchase_order_item.updateMany.mock.invocationCallOrder[0],
        );
      });

      it("claims the PO line with a guarded increment, raises stock, and writes an ADDED transaction", async () => {
        await receive([{ item_id: "ITEM-A", quantity: 3, notes: "Pallet 1" }]);

        // only applies while the line still has room: 10 ordered - 3 = 7
        expect(prismaMock.purchase_order_item.updateMany).toHaveBeenCalledWith({
          where: { id: "poi-a", quantity_received: { lte: 7 } },
          data: { quantity_received: { increment: 3 } },
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
            purchase_order_id: PO_ID,
            notes: "Pallet 1",
          },
        });
      });

      it("uses a default note when none is given", async () => {
        await post();

        expect(
          prismaMock.stock_transaction.create.mock.calls[0][0].data.notes,
        ).toBe(`Received from PO ${PO_ID}`);
      });

      it("handles several items in one request", async () => {
        mockReceive({
          before: [
            poItem(),
            poItem({ id: "poi-b", item_id: "ITEM-B", quantity: 5 }),
          ],
        });

        const res = await receive([
          { item_id: "ITEM-A", quantity: 2 },
          { item_id: "ITEM-B", quantity: 5 },
        ]);

        expect(res.status).toBe(200);
        expect((await res.json()).message).toBe(
          "Successfully received 2 item(s)",
        );
        expect(prismaMock.purchase_order_item.updateMany).toHaveBeenCalledTimes(
          2,
        );
        expect(prismaMock.item.update).toHaveBeenCalledTimes(2);
        expect(prismaMock.stock_transaction.create).toHaveBeenCalledTimes(2);
      });

      it("treats a null quantity_received as zero", async () => {
        mockReceive({
          before: [poItem({ quantity: 5, quantity_received: null })],
        });

        const res = await receive([{ item_id: "ITEM-A", quantity: 5 }]);

        expect(res.status).toBe(200);
        // an increment on NULL stays NULL, so the first receipt is set directly
        expect(prismaMock.purchase_order_item.updateMany).toHaveBeenCalledWith({
          where: { id: "poi-a", quantity_received: null },
          data: { quantity_received: 5 },
        });
      });

      it("allows receiving up to exactly the ordered quantity", async () => {
        mockReceive({
          before: [poItem({ quantity: 10, quantity_received: 7 })],
        });

        const res = await receive([{ item_id: "ITEM-A", quantity: 3 }]);

        expect(res.status).toBe(200);
      });
    });

    describe("duplicate entries for the same item", () => {
      // The audit's example: two entries of 10 against a line of 10 used to
      // record 20 received and add 20 to stock.
      it("adds duplicate entries together before the over-receive check", async () => {
        const res = await receive([
          { item_id: "ITEM-A", quantity: 10 },
          { item_id: "ITEM-A", quantity: 10 },
        ]);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Cannot receive more than ordered quantity for item ITEM-A. Ordered: 10, Already received: 0, Requested: 20, Remaining: 10",
        });
        expect(prismaMock.purchase_order_item.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.item.update).not.toHaveBeenCalled();
        expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
      });

      it("accepts duplicates that together fit, raising stock once and keeping one ledger row each", async () => {
        const res = await receive([
          { item_id: "ITEM-A", quantity: 4, notes: "first" },
          { item_id: "ITEM-A", quantity: 6, notes: "second" },
        ]);

        expect(res.status).toBe(200);
        expect(prismaMock.purchase_order_item.updateMany).toHaveBeenCalledTimes(
          1,
        );
        expect(prismaMock.purchase_order_item.updateMany).toHaveBeenCalledWith({
          where: { id: "poi-a", quantity_received: { lte: 0 } },
          data: { quantity_received: { increment: 10 } },
        });
        expect(prismaMock.item.update).toHaveBeenCalledTimes(1);
        expect(prismaMock.item.update).toHaveBeenCalledWith({
          where: { item_id: "ITEM-A" },
          data: { quantity: { increment: 10 } },
        });
        expect(prismaMock.stock_transaction.create).toHaveBeenCalledTimes(2);
        expect(
          prismaMock.stock_transaction.create.mock.calls.map(
            (c) => c[0].data.notes,
          ),
        ).toEqual(["first", "second"]);
      });

      it("spreads a delivery over several PO lines for the same item, oldest first", async () => {
        mockReceive({
          before: [
            poItem({ id: "poi-1", quantity: 5, createdAt: "2026-01-01" }),
            poItem({ id: "poi-2", quantity: 5, createdAt: "2026-01-02" }),
          ],
        });

        const res = await receive([{ item_id: "ITEM-A", quantity: 7 }]);

        expect(res.status).toBe(200);
        expect(
          prismaMock.purchase_order_item.updateMany.mock.calls.map((c) => [
            c[0].where.id,
            c[0].data.quantity_received.increment,
          ]),
        ).toEqual([
          ["poi-1", 5],
          ["poi-2", 2],
        ]);
        // stock still goes up once, by the whole 7
        expect(prismaMock.item.update).toHaveBeenCalledTimes(1);
        expect(prismaMock.item.update.mock.calls[0][0].data).toEqual({
          quantity: { increment: 7 },
        });
      });

      it("refuses more than all lines for the item can take", async () => {
        mockReceive({
          before: [
            poItem({ id: "poi-1", quantity: 5, quantity_received: 3 }),
            poItem({ id: "poi-2", quantity: 5, quantity_received: 5 }),
          ],
        });

        const res = await receive([{ item_id: "ITEM-A", quantity: 3 }]);

        expect(res.status).toBe(400);
        expect((await res.json()).message).toBe(
          "Cannot receive more than ordered quantity for item ITEM-A. Ordered: 10, Already received: 8, Requested: 3, Remaining: 2",
        );
      });
    });

    describe("purchase order status", () => {
      it.each(["DRAFT", "CANCELLED"])(
        "refuses to receive against a %s purchase order",
        async (status) => {
          mockReceive({ status });

          const res = await post();

          expect(res.status).toBe(400);
          expect((await res.json()).message).toMatch(
            new RegExp(`${status} purchase order`),
          );
          expect(prismaMock.purchase_order_item.updateMany).not.toHaveBeenCalled();
          expect(prismaMock.item.update).not.toHaveBeenCalled();
          expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
          expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
        },
      );

      it.each(["ORDERED", "PARTIALLY_RECEIVED"])(
        "accepts deliveries against a %s purchase order",
        async (status) => {
          mockReceive({ status });

          const res = await post();

          expect(res.status).toBe(200);
        },
      );

      it("still answers a FULLY_RECEIVED order precisely: nothing left to receive", async () => {
        mockReceive({
          status: "FULLY_RECEIVED",
          before: [poItem({ quantity: 10, quantity_received: 10 })],
        });

        const res = await post();

        expect(res.status).toBe(400);
        expect((await res.json()).message).toMatch(/Remaining: 0/);
      });
    });

    describe("PO status recalculation", () => {
      it("becomes FULLY_RECEIVED when every line is complete", async () => {
        mockReceive({
          after: [poItem({ quantity: 10, quantity_received: 10 })],
        });

        await receive([{ item_id: "ITEM-A", quantity: 10 }]);

        expect(prismaMock.purchase_order.update).toHaveBeenCalledWith({
          where: { id: PO_ID },
          data: { status: "FULLY_RECEIVED" },
        });
      });

      it("becomes PARTIALLY_RECEIVED when only some stock has arrived", async () => {
        mockReceive({
          after: [poItem({ quantity: 10, quantity_received: 3 })],
        });

        await post();

        expect(prismaMock.purchase_order.update).toHaveBeenCalledWith({
          where: { id: PO_ID },
          data: { status: "PARTIALLY_RECEIVED" },
        });
      });

      it("stays PARTIALLY_RECEIVED while another line is still short", async () => {
        mockReceive({
          after: [
            poItem({ quantity: 10, quantity_received: 10 }),
            poItem({
              id: "poi-b",
              item_id: "ITEM-B",
              quantity: 4,
              quantity_received: 0,
            }),
          ],
        });

        await receive([{ item_id: "ITEM-A", quantity: 10 }]);

        expect(prismaMock.purchase_order.update).toHaveBeenCalledWith({
          where: { id: PO_ID },
          data: { status: "PARTIALLY_RECEIVED" },
        });
      });

      it("does not update the status when it is already correct", async () => {
        mockReceive({
          status: "PARTIALLY_RECEIVED",
          after: [poItem({ quantity: 10, quantity_received: 6 })],
        });

        await post();

        expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
      });

      it("reads the updated lines scoped to this PO", async () => {
        await post();

        expect(prismaMock.purchase_order_item.findMany).toHaveBeenCalledWith({
          where: { order_id: PO_ID },
        });
      });
    });

    describe("business rules", () => {
      it("returns 404 when the purchase order does not exist", async () => {
        mockReceive({ missingPo: true });

        const res = await post();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: `Purchase order not found: ${PO_ID}`,
        });
        expect(prismaMock.purchase_order_item.updateMany).not.toHaveBeenCalled();
      });

      it("returns 404 when the item is not on this purchase order", async () => {
        const res = await receive([{ item_id: "ITEM-Z", quantity: 1 }]);

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: `Item ITEM-Z not found in purchase order ${PO_ID}`,
        });
      });

      it.each([
        ["no longer exists", { missingInventory: true }],
      ])("returns 404 when the inventory item %s", async (_, opts) => {
        mockReceive(opts);

        const res = await post();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Inventory item not found: ITEM-A",
        });
        expect(prismaMock.item.update).not.toHaveBeenCalled();
      });

      it("returns 404 when the inventory item is soft deleted", async () => {
        prismaMock.item.findUnique.mockResolvedValue({
          item_id: "ITEM-A",
          is_deleted: true,
        });

        const res = await post();

        expect(res.status).toBe(404);
        expect(prismaMock.item.update).not.toHaveBeenCalled();
      });

      it("returns 400 when receiving more than was ordered", async () => {
        mockReceive({
          before: [poItem({ quantity: 10, quantity_received: 8 })],
        });

        const res = await receive([{ item_id: "ITEM-A", quantity: 3 }]);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Cannot receive more than ordered quantity for item ITEM-A. Ordered: 10, Already received: 8, Requested: 3, Remaining: 2",
        });
        expect(prismaMock.purchase_order_item.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.item.update).not.toHaveBeenCalled();
        expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
      });

      it("validates every line before writing any of them", async () => {
        mockReceive({
          before: [
            poItem(),
            poItem({ id: "poi-b", item_id: "ITEM-B", quantity: 2 }),
          ],
        });

        const res = await receive([
          { item_id: "ITEM-A", quantity: 1 },
          { item_id: "ITEM-B", quantity: 5 }, // over-receive
        ]);

        expect(res.status).toBe(400);
        expect(prismaMock.purchase_order_item.updateMany).not.toHaveBeenCalled();
      });

      it("returns 409 when a line was changed since it was read", async () => {
        mockReceive({ claims: false });

        const res = await post();

        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Received quantity was changed by someone else. Reload and try again.",
        });
        expect(prismaMock.item.update).not.toHaveBeenCalled();
        expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("does not over-receive when two deliveries race for the last units", async () => {
        // Both read a line with 10 ordered and 0 received; only one guarded
        // write can win.
        let received = 0;
        prismaMock.purchase_order_item.updateMany.mockImplementation(
          async ({ where, data }) => {
            if (received <= where.quantity_received.lte) {
              received += data.quantity_received.increment;
              return { count: 1 };
            }
            return { count: 0 };
          },
        );

        const [a, b] = await Promise.all([
          receive([{ item_id: "ITEM-A", quantity: 10 }]),
          receive([{ item_id: "ITEM-A", quantity: 10 }]),
        ]);

        expect([a.status, b.status].sort()).toEqual([200, 409]);
        expect(received).toBe(10);
      });
    });

    describe("logging and failures", () => {
      it("logs the receipt against the PO", async () => {
        await post();

        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: {
            user_id: "user-1",
            entity_type: "purchase_order",
            entity_id: PO_ID,
            action: "UPDATE",
            description: `Received 1 item(s) for PO: ${PO_ID}`,
          },
        });
      });

      it("returns 200 with a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await post();

        expect(res.status).toBe(200);
        expect((await res.json()).warning).toBe(
          "Note: Operation succeeded but logging failed",
        );
      });

      it("returns a generic 500 without the database error when a write fails", async () => {
        prismaMock.item.update.mockRejectedValue(new Error("DB down"));

        const res = await post();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Failed to process received items",
        });
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 when the row lock fails", async () => {
        prismaMock.$queryRaw.mockRejectedValue(new Error("lock timeout"));

        const res = await post();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Failed to process received items",
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
});
