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

const poItem = (overrides = {}) => ({
  id: "poi-a",
  order_id: PO_ID,
  item_id: "ITEM-A",
  quantity: 10,
  quantity_received: 0,
  ...overrides,
});

// `before` = PO items as first read; `after` = PO items after the increments
function mockReceive({
  status = "ORDERED",
  before = [poItem()],
  after,
  missingPo = false,
  missingInventory = false,
} = {}) {
  const final = { id: PO_ID, status: "FINAL", items: [] };
  prismaMock.purchase_order.findUnique.mockImplementation(async (args) => {
    if (args.include?.supplier) return final; // post-transaction fetch
    return missingPo ? null : { id: PO_ID, status, items: before };
  });
  prismaMock.item.findUnique.mockResolvedValue(
    missingInventory ? null : { item_id: "ITEM-A" },
  );
  prismaMock.purchase_order_item.update.mockResolvedValue({});
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

      it("returns 400 for a negative quantity", async () => {
        const res = await post({
          purchase_order_id: PO_ID,
          items: [{ item_id: "ITEM-A", quantity: -1 }],
        });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Quantity must be non-negative for item ITEM-A",
        });
      });

      it("accepts a quantity of zero", async () => {
        const res = await post({
          purchase_order_id: PO_ID,
          items: [{ item_id: "ITEM-A", quantity: 0 }],
        });

        expect(res.status).toBe(200);
      });
    });

    describe("receiving stock", () => {
      it("locks the PO row, then records the receipt and returns the PO", async () => {
        const final = mockReceive();

        const res = await post();

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "Successfully received 1 item(s)",
          data: final,
        });
        expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
        // tagged template: first arg is the strings array, then the id
        expect(prismaMock.$executeRaw.mock.calls[0][1]).toBe(PO_ID);
        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
      });

      it("increments the PO line, the stock, and writes an ADDED transaction", async () => {
        await post({
          purchase_order_id: PO_ID,
          items: [{ item_id: "ITEM-A", quantity: 3, notes: "Pallet 1" }],
        });

        expect(prismaMock.purchase_order_item.update).toHaveBeenCalledWith({
          where: { id: "poi-a" },
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
        prismaMock.item.findUnique.mockImplementation(async ({ where }) => ({
          item_id: where.item_id,
        }));

        const res = await post({
          purchase_order_id: PO_ID,
          items: [
            { item_id: "ITEM-A", quantity: 2 },
            { item_id: "ITEM-B", quantity: 5 },
          ],
        });

        expect(res.status).toBe(200);
        expect((await res.json()).message).toBe(
          "Successfully received 2 item(s)",
        );
        expect(prismaMock.purchase_order_item.update).toHaveBeenCalledTimes(2);
        expect(prismaMock.item.update).toHaveBeenCalledTimes(2);
        expect(prismaMock.stock_transaction.create).toHaveBeenCalledTimes(2);
      });

      it("treats a null quantity_received as zero", async () => {
        mockReceive({
          before: [poItem({ quantity: 5, quantity_received: null })],
        });

        const res = await post({
          purchase_order_id: PO_ID,
          items: [{ item_id: "ITEM-A", quantity: 5 }],
        });

        expect(res.status).toBe(200);
      });

      it("allows receiving up to exactly the ordered quantity", async () => {
        mockReceive({
          before: [poItem({ quantity: 10, quantity_received: 7 })],
        });

        const res = await post({
          purchase_order_id: PO_ID,
          items: [{ item_id: "ITEM-A", quantity: 3 }],
        });

        expect(res.status).toBe(200);
      });
    });

    describe("PO status", () => {
      const receive = (qty = 3) =>
        post({
          purchase_order_id: PO_ID,
          items: [{ item_id: "ITEM-A", quantity: qty }],
        });

      it("becomes FULLY_RECEIVED when every line is complete", async () => {
        mockReceive({
          after: [poItem({ quantity: 10, quantity_received: 10 })],
        });

        await receive(10);

        expect(prismaMock.purchase_order.update).toHaveBeenCalledWith({
          where: { id: PO_ID },
          data: { status: "FULLY_RECEIVED" },
        });
      });

      it("becomes PARTIALLY_RECEIVED when only some stock has arrived", async () => {
        mockReceive({
          after: [poItem({ quantity: 10, quantity_received: 3 })],
        });

        await receive();

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

        await receive(10);

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

        await receive();

        expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
      });

      it("keeps the status when nothing has been received (zero quantity)", async () => {
        mockReceive({
          after: [poItem({ quantity: 10, quantity_received: 0 })],
        });

        await receive(0);

        expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
      });

      it("never changes a CANCELLED purchase order", async () => {
        mockReceive({
          status: "CANCELLED",
          after: [poItem({ quantity: 10, quantity_received: 10 })],
        });

        const res = await receive(10);

        expect(res.status).toBe(200);
        expect(prismaMock.purchase_order.update).not.toHaveBeenCalled();
      });

      it("reads the updated lines scoped to this PO", async () => {
        await receive();

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
        expect(prismaMock.purchase_order_item.update).not.toHaveBeenCalled();
      });

      it("returns 404 when the item is not on this purchase order", async () => {
        const res = await post({
          purchase_order_id: PO_ID,
          items: [{ item_id: "ITEM-Z", quantity: 1 }],
        });

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: `Item ITEM-Z not found in purchase order ${PO_ID}`,
        });
      });

      it("returns 404 when the inventory item no longer exists", async () => {
        mockReceive({ missingInventory: true });

        const res = await post();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Inventory item not found: ITEM-A",
        });
        expect(prismaMock.item.update).not.toHaveBeenCalled();
      });

      it("returns 400 when receiving more than was ordered", async () => {
        mockReceive({
          before: [poItem({ quantity: 10, quantity_received: 8 })],
        });

        const res = await post({
          purchase_order_id: PO_ID,
          items: [{ item_id: "ITEM-A", quantity: 3 }],
        });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Cannot receive more than ordered quantity for item ITEM-A. Ordered: 10, Already received: 8, Requested: 3, Remaining: 2",
        });
        expect(prismaMock.purchase_order_item.update).not.toHaveBeenCalled();
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
        prismaMock.item.findUnique.mockImplementation(async ({ where }) => ({
          item_id: where.item_id,
        }));

        const res = await post({
          purchase_order_id: PO_ID,
          items: [
            { item_id: "ITEM-A", quantity: 1 },
            { item_id: "ITEM-B", quantity: 5 }, // over-receive
          ],
        });

        expect(res.status).toBe(400);
        expect(prismaMock.purchase_order_item.update).not.toHaveBeenCalled();
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

      it("returns 500 with the error message when a write fails", async () => {
        prismaMock.item.update.mockRejectedValue(new Error("DB down"));

        const res = await post();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Failed to process received items",
          error: "DB down",
        });
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 when the row lock fails", async () => {
        prismaMock.$executeRaw.mockRejectedValue(new Error("lock timeout"));

        const res = await post();

        expect(res.status).toBe(500);
        expect((await res.json()).error).toBe("lock timeout");
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
