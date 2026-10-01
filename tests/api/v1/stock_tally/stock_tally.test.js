// Tests for src/app/api/v1/stock_tally/route.js
//
// NOTE: the route selects `supplier_reference` on the item model, but that
// column only exists on item_suppliers in prisma/schema.prisma. Prisma would
// reject the query, so against a real database every item would land in the
// per-item `errors` list and nothing would be updated. These tests use the
// in-memory Prisma mock, which cannot catch that.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { POST } = await import("@/app/api/v1/stock_tally/route");

const URL = "/api/v1/stock_tally";
const post = (
  body = { items: [{ item_id: "A", new_quantity: 8 }] },
  options = {},
) => POST(buildRequest(URL, { method: "POST", body, ...options }));

const supplier = (name, reference) => ({
  supplier_reference: reference,
  supplier: name === null ? null : { name },
});

// Stock by item id; anything not listed does not exist
function mockTally(stock = { A: { quantity: 5 } }) {
  prismaMock.item.findUnique.mockImplementation(async ({ where }) => {
    const entry = stock[where.item_id];
    return entry
      ? { supplier_reference: null, itemSuppliers: [], ...entry }
      : null;
  });
  prismaMock.item.update.mockResolvedValue({});
  prismaMock.stock_transaction.create.mockResolvedValue({});
  prismaMock.logs.create.mockResolvedValue({});
}

const body = async (res) => (await res.json()).data;

describe("POST /api/v1/stock_tally", () => {
  describeAuthorization((options) => post(undefined, options), {
    modules: "all_items",
    setup: () => mockTally(),
    untouched: () => [prismaMock.item.findUnique, prismaMock.$transaction],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockTally();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe("validation", () => {
      it.each([
        ["missing", {}],
        ["not an array", { items: "A" }],
        ["empty", { items: [] }],
      ])("returns 400 when items is %s", async (_, payload) => {
        const res = await post(payload);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "items array is required and must not be empty",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it.each([
        ["an item_id", { new_quantity: 1 }, "Each item must have an item_id"],
        [
          "a new_quantity",
          { item_id: "A" },
          "Each item must have a new_quantity",
        ],
        [
          "a non-null new_quantity",
          { item_id: "A", new_quantity: null },
          "Each item must have a new_quantity",
        ],
        [
          "a non-negative quantity",
          { item_id: "A", new_quantity: -1 },
          "new_quantity must be non-negative",
        ],
        [
          "a non-negative fraction",
          { item_id: "A", new_quantity: -0.5 },
          "new_quantity must be non-negative",
        ],
      ])("returns 400 when an item has no %s", async (_, line, message) => {
        const res = await post({
          items: [{ item_id: "B", new_quantity: 1 }, line],
        });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ status: false, message });
      });

      it("validates every item before changing any stock", async () => {
        const res = await post({
          items: [
            { item_id: "A", new_quantity: 8 },
            { item_id: "B", new_quantity: -1 },
          ],
        });

        expect(res.status).toBe(400);
        expect(prismaMock.item.update).not.toHaveBeenCalled();
        expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
      });

      it("accepts a new quantity of zero", async () => {
        const res = await post({ items: [{ item_id: "A", new_quantity: 0 }] });

        expect(res.status).toBe(200);
        expect((await body(res)).updated[0]).toMatchObject({
          new_quantity: 0,
          difference: -5,
          type: "WASTED",
        });
      });
    });

    describe("adjusting stock", () => {
      it("raises stock and records an ADDED transaction", async () => {
        const res = await post({ items: [{ item_id: "A", new_quantity: 8 }] });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "Stock tally completed: 1 items updated",
          data: {
            updated: [
              {
                item_id: "A",
                supplier_reference: null,
                old_quantity: 5,
                new_quantity: 8,
                difference: 3,
                type: "ADDED",
              },
            ],
            errors: [],
            summary: { total_items: 1, updated_count: 1, error_count: 0 },
          },
        });
        expect(prismaMock.item.update).toHaveBeenCalledWith({
          where: { item_id: "A" },
          data: { quantity: 8 },
        });
        expect(prismaMock.stock_transaction.create).toHaveBeenCalledWith({
          data: {
            item_id: "A",
            quantity: 3,
            type: "ADDED",
            notes: "Stock tally adjustment: 5 → 8",
          },
        });
      });

      it("lowers stock and records a WASTED transaction for the size of the drop", async () => {
        const res = await post({ items: [{ item_id: "A", new_quantity: 2 }] });

        expect((await body(res)).updated[0]).toMatchObject({
          difference: -3,
          type: "WASTED",
        });
        expect(prismaMock.stock_transaction.create).toHaveBeenCalledWith({
          data: {
            item_id: "A",
            quantity: 3,
            type: "WASTED",
            notes: "Stock tally adjustment: 5 → 2",
          },
        });
      });

      it("skips items whose quantity is unchanged", async () => {
        const res = await post({ items: [{ item_id: "A", new_quantity: 5 }] });

        const data = await body(res);
        expect(data.updated).toEqual([]);
        expect(data.errors).toEqual([]);
        expect(data.summary).toEqual({
          total_items: 1,
          updated_count: 0,
          error_count: 0,
        });
        expect(prismaMock.item.update).not.toHaveBeenCalled();
        expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
      });

      it("rounds a fractional new quantity down", async () => {
        const res = await post({
          items: [{ item_id: "A", new_quantity: 7.9 }],
        });

        expect((await body(res)).updated[0]).toMatchObject({
          new_quantity: 7,
          difference: 2,
        });
        expect(prismaMock.item.update.mock.calls[0][0].data.quantity).toBe(7);
      });

      it("accepts a numeric string", async () => {
        const res = await post({
          items: [{ item_id: "A", new_quantity: "9" }],
        });

        expect((await body(res)).updated[0].new_quantity).toBe(9);
      });

      it("treats a missing current quantity as zero", async () => {
        mockTally({ A: { quantity: null } });

        const res = await post({ items: [{ item_id: "A", new_quantity: 4 }] });

        expect((await body(res)).updated[0]).toMatchObject({
          old_quantity: 0,
          difference: 4,
          type: "ADDED",
        });
      });

      it("ignores a client-supplied current_quantity and uses the stored one", async () => {
        const res = await post({
          items: [{ item_id: "A", new_quantity: 8, current_quantity: 100 }],
        });

        expect((await body(res)).updated[0]).toMatchObject({
          old_quantity: 5,
          difference: 3,
        });
      });

      it("reads the stored quantity and suppliers for the item", async () => {
        await post();

        expect(prismaMock.item.findUnique).toHaveBeenCalledWith({
          where: { item_id: "A" },
          select: {
            quantity: true,
            supplier_reference: true,
            itemSuppliers: {
              include: { supplier: { select: { name: true } } },
            },
          },
        });
      });

      it("handles several items, mixing adds, drops and no-ops", async () => {
        mockTally({
          A: { quantity: 5 },
          B: { quantity: 10 },
          C: { quantity: 3 },
        });

        const res = await post({
          items: [
            { item_id: "A", new_quantity: 6 },
            { item_id: "B", new_quantity: 4 },
            { item_id: "C", new_quantity: 3 },
          ],
        });

        const data = await body(res);
        expect(data.updated.map((u) => [u.item_id, u.type])).toEqual([
          ["A", "ADDED"],
          ["B", "WASTED"],
        ]);
        expect(data.summary).toEqual({
          total_items: 3,
          updated_count: 2,
          error_count: 0,
        });
      });

      it("runs each item in its own transaction", async () => {
        mockTally({ A: { quantity: 5 }, B: { quantity: 5 } });

        await post({
          items: [
            { item_id: "A", new_quantity: 6 },
            { item_id: "B", new_quantity: 7 },
          ],
        });

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
      });

      // Current behaviour: a non-numeric quantity passes validation (the "< 0"
      // check is false for NaN) and NaN is written to the database.
      it("passes NaN through for a non-numeric new_quantity", async () => {
        await post({ items: [{ item_id: "A", new_quantity: "abc" }] });

        expect(prismaMock.item.update.mock.calls[0][0].data.quantity).toBeNaN();
        expect(
          prismaMock.stock_transaction.create.mock.calls[0][0].data.type,
        ).toBe("WASTED");
      });
    });

    describe("supplier reference", () => {
      const refFor = async (itemEntry) => {
        mockTally({ A: { quantity: 5, ...itemEntry } });
        const res = await post({ items: [{ item_id: "A", new_quantity: 6 }] });
        return (await body(res)).updated[0].supplier_reference;
      };

      it("joins every supplier as 'name: reference'", async () => {
        expect(
          await refFor({
            itemSuppliers: [
              supplier("Alpha", "A-100"),
              supplier("Beta", "B-200"),
            ],
          }),
        ).toBe("Alpha: A-100, Beta: B-200");
      });

      it("uses Unassigned and N/A for missing values", async () => {
        expect(
          await refFor({
            itemSuppliers: [supplier(null, null), supplier("Beta", "")],
          }),
        ).toBe("Unassigned: N/A, Beta: N/A");
      });

      it("falls back to the item's own reference when it has no suppliers", async () => {
        expect(
          await refFor({ supplier_reference: "LEGACY-1", itemSuppliers: [] }),
        ).toBe("LEGACY-1");
      });

      it("is null when there is no reference at all", async () => {
        expect(await refFor({})).toBeNull();
      });
    });

    describe("per-item errors", () => {
      it("reports items that do not exist and carries on with the rest", async () => {
        mockTally({ A: { quantity: 5 }, C: { quantity: 1 } });

        const res = await post({
          items: [
            { item_id: "A", new_quantity: 6 },
            { item_id: "GHOST", new_quantity: 3 },
            { item_id: "C", new_quantity: 9 },
          ],
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.message).toBe("Stock tally completed: 2 items updated");
        expect(json.data.updated.map((u) => u.item_id)).toEqual(["A", "C"]);
        expect(json.data.errors).toEqual([
          { item_id: "GHOST", error: "Item not found" },
        ]);
        expect(json.data.summary).toEqual({
          total_items: 3,
          updated_count: 2,
          error_count: 1,
        });
      });

      it("reports a database failure for one item and carries on", async () => {
        mockTally({ A: { quantity: 5 }, B: { quantity: 5 } });
        prismaMock.item.update.mockImplementation(async ({ where }) => {
          if (where.item_id === "A") throw new Error("deadlock");
          return {};
        });

        const res = await post({
          items: [
            { item_id: "A", new_quantity: 6 },
            { item_id: "B", new_quantity: 7 },
          ],
        });

        expect(res.status).toBe(200);
        const data = await body(res);
        expect(data.errors).toEqual([{ item_id: "A", error: "deadlock" }]);
        expect(data.updated.map((u) => u.item_id)).toEqual(["B"]);
      });

      it("reports every item as an error when all fail", async () => {
        prismaMock.item.findUnique.mockRejectedValue(new Error("DB down"));

        const res = await post({
          items: [
            { item_id: "A", new_quantity: 6 },
            { item_id: "B", new_quantity: 7 },
          ],
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.message).toBe("Stock tally completed: 0 items updated");
        expect(json.data.summary).toEqual({
          total_items: 2,
          updated_count: 0,
          error_count: 2,
        });
      });
    });

    describe("logging", () => {
      it("logs one entry for the whole tally with the counts", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
        mockTally({ A: { quantity: 5 } });

        await post({
          items: [
            { item_id: "A", new_quantity: 6 },
            { item_id: "GHOST", new_quantity: 1 },
          ],
        });

        expect(prismaMock.logs.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: {
            user_id: "user-1",
            entity_type: "stock_tally",
            entity_id: `stock-tally-${new Date("2026-03-01T00:00:00.000Z").getTime()}`,
            action: "CREATE",
            description: "Stock tally completed: 1 items updated, 1 errors",
          },
        });
      });

      it("still logs when nothing changed", async () => {
        await post({ items: [{ item_id: "A", new_quantity: 5 }] });

        expect(prismaMock.logs.create.mock.calls[0][0].data.description).toBe(
          "Stock tally completed: 0 items updated, 0 errors",
        );
      });

      // Current behaviour: the log result is ignored, so there is no warning.
      it("returns 200 without a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await post();

        expect(res.status).toBe(200);
        expect(await res.json()).not.toHaveProperty("warning");
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
      expect(prismaMock.item.findUnique).not.toHaveBeenCalled();
    });
  });
});
