// Tests for src/app/api/v1/stock_tally/route.js
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

// Stock by item id; anything not listed does not exist. Quantities come back
// as strings, like Prisma's Decimal values do.
function mockTally(stock = { A: { quantity: 5 } }) {
  prismaMock.item.findMany.mockImplementation(async ({ where }) =>
    where.item_id.in
      .filter((id) => stock[id])
      .map((id) => ({
        item_id: id,
        is_deleted: false,
        itemSuppliers: [],
        ...stock[id],
        quantity:
          stock[id].quantity === null ? null : String(stock[id].quantity),
      })),
  );
  prismaMock.item.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.stock_transaction.createMany.mockResolvedValue({ count: 1 });
  prismaMock.logs.create.mockResolvedValue({});
}

const body = async (res) => (await res.json()).data;
const ledger = () =>
  prismaMock.stock_transaction.createMany.mock.calls[0][0].data;

describe("POST /api/v1/stock_tally", () => {
  describeAuthorization((options) => post(undefined, options), {
    modules: "all_items",
    setup: () => mockTally(),
    untouched: () => [prismaMock.item.findMany, prismaMock.$transaction],
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
        [
          "a numeric quantity (text)",
          { item_id: "A", new_quantity: "abc" },
          "new_quantity must be a number",
        ],
        [
          "a numeric quantity (empty)",
          { item_id: "A", new_quantity: "" },
          "new_quantity must be a number",
        ],
        [
          "a finite quantity",
          { item_id: "A", new_quantity: "Infinity" },
          "new_quantity must be a number",
        ],
      ])("returns 400 when an item has no %s", async (_, line, message) => {
        const res = await post({
          items: [{ item_id: "B", new_quantity: 1 }, line],
        });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ status: false, message });
      });

      it("rejects the same item twice, which would double-apply", async () => {
        const res = await post({
          items: [
            { item_id: "A", new_quantity: 8 },
            { item_id: "A", new_quantity: 9 },
          ],
        });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Duplicate item_id in request: A",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it("validates every item before changing any stock", async () => {
        const res = await post({
          items: [
            { item_id: "A", new_quantity: 8 },
            { item_id: "B", new_quantity: -1 },
          ],
        });

        expect(res.status).toBe(400);
        expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.stock_transaction.createMany).not.toHaveBeenCalled();
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
        expect(ledger()).toEqual([
          {
            item_id: "A",
            quantity: 3,
            type: "ADDED",
            notes: "Stock tally adjustment: 5 → 8",
          },
        ]);
      });

      it("lowers stock and records a WASTED transaction for the size of the drop", async () => {
        const res = await post({ items: [{ item_id: "A", new_quantity: 2 }] });

        expect((await body(res)).updated[0]).toMatchObject({
          difference: -3,
          type: "WASTED",
        });
        expect(ledger()).toEqual([
          {
            item_id: "A",
            quantity: 3,
            type: "WASTED",
            notes: "Stock tally adjustment: 5 → 2",
          },
        ]);
      });

      it("only writes if the quantity is still the one that was read", async () => {
        await post({ items: [{ item_id: "A", new_quantity: 8 }] });

        expect(prismaMock.item.updateMany).toHaveBeenCalledWith({
          where: { item_id: "A", quantity: "5" },
          data: { quantity: 8 },
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
        expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.stock_transaction.createMany).not.toHaveBeenCalled();
      });

      it("keeps a fractional quantity (to 2 decimal places) instead of truncating it", async () => {
        const res = await post({
          items: [{ item_id: "A", new_quantity: 7.456 }],
        });

        expect((await body(res)).updated[0]).toMatchObject({
          new_quantity: 7.46,
          difference: 2.46,
        });
        expect(prismaMock.item.updateMany.mock.calls[0][0].data.quantity).toBe(
          7.46,
        );
        // The ledger is an integer; the exact values are in the notes
        expect(ledger()[0]).toMatchObject({
          quantity: 2,
          notes: "Stock tally adjustment: 5 → 7.46",
        });
      });

      it("never records a ledger quantity of zero for a small real change", async () => {
        mockTally({ A: { quantity: 5.5 } });

        await post({ items: [{ item_id: "A", new_quantity: 5.7 }] });

        expect(ledger()[0].quantity).toBe(1);
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
        expect(prismaMock.item.updateMany.mock.calls[0][0].where).toEqual({
          item_id: "A",
          quantity: null,
        });
      });

      it("reads every item in one query, without the dropped supplier_reference column", async () => {
        mockTally({ A: { quantity: 5 }, B: { quantity: 5 } });

        await post({
          items: [
            { item_id: "A", new_quantity: 6 },
            { item_id: "B", new_quantity: 6 },
          ],
        });

        expect(prismaMock.item.findMany).toHaveBeenCalledTimes(1);
        expect(prismaMock.item.findMany).toHaveBeenCalledWith({
          where: { item_id: { in: ["A", "B"] } },
          select: {
            item_id: true,
            quantity: true,
            is_deleted: true,
            itemSuppliers: {
              include: { supplier: { select: { name: true } } },
            },
          },
        });
      });

      it("handles several items in one transaction and one ledger insert", async () => {
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
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(prismaMock.stock_transaction.createMany).toHaveBeenCalledTimes(
          1,
        );
        expect(ledger().map((l) => l.item_id)).toEqual(["A", "B"]);
      });
    });

    describe("conflicts", () => {
      it("reports a conflict when stock moved since the sheet was exported", async () => {
        const res = await post({
          items: [{ item_id: "A", new_quantity: 8, current_quantity: 100 }],
        });

        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.status).toBe(false);
        expect(json.data.errors).toEqual([
          expect.objectContaining({ item_id: "A", conflict: true }),
        ]);
        expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.stock_transaction.createMany).not.toHaveBeenCalled();
      });

      it("tolerates the sheet having dropped the decimals", async () => {
        mockTally({ A: { quantity: 5.5 } });

        const res = await post({
          items: [{ item_id: "A", new_quantity: 8, current_quantity: 5 }],
        });

        expect(res.status).toBe(200);
        expect((await body(res)).updated).toHaveLength(1);
      });

      it("reports a conflict when the guarded write matches no row", async () => {
        prismaMock.item.updateMany.mockResolvedValue({ count: 0 });

        const res = await post();

        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.data.errors).toEqual([
          expect.objectContaining({ item_id: "A", conflict: true }),
        ]);
        expect(prismaMock.stock_transaction.createMany).not.toHaveBeenCalled();
      });

      it("applies the other rows when only one conflicts", async () => {
        mockTally({ A: { quantity: 5 }, B: { quantity: 5 } });
        prismaMock.item.updateMany.mockImplementation(async ({ where }) => ({
          count: where.item_id === "A" ? 0 : 1,
        }));

        const res = await post({
          items: [
            { item_id: "A", new_quantity: 6 },
            { item_id: "B", new_quantity: 7 },
          ],
        });

        expect(res.status).toBe(200);
        const data = await body(res);
        expect(data.updated.map((u) => u.item_id)).toEqual(["B"]);
        expect(data.errors).toEqual([
          expect.objectContaining({ item_id: "A", conflict: true }),
        ]);
        expect(ledger().map((l) => l.item_id)).toEqual(["B"]);
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

      it("is null when the item has no suppliers", async () => {
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

      it("treats a soft-deleted item as not found", async () => {
        mockTally({ A: { quantity: 5, is_deleted: true }, B: { quantity: 5 } });

        const res = await post({
          items: [
            { item_id: "A", new_quantity: 6 },
            { item_id: "B", new_quantity: 7 },
          ],
        });

        const data = await body(res);
        expect(data.errors).toEqual([
          { item_id: "A", error: "Item not found" },
        ]);
        expect(data.updated.map((u) => u.item_id)).toEqual(["B"]);
      });

      it("returns status false (422) when nothing could be updated", async () => {
        mockTally({});

        const res = await post({
          items: [
            { item_id: "A", new_quantity: 6 },
            { item_id: "B", new_quantity: 7 },
          ],
        });

        expect(res.status).toBe(422);
        const json = await res.json();
        expect(json.status).toBe(false);
        expect(json.data.summary).toEqual({
          total_items: 2,
          updated_count: 0,
          error_count: 2,
        });
      });

      it("returns a generic 500, never database error text, and writes no ledger rows", async () => {
        prismaMock.item.updateMany.mockRejectedValue(
          new Error("Unknown field `supplier_reference` on model item"),
        );

        const res = await post();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
        expect(prismaMock.stock_transaction.createMany).not.toHaveBeenCalled();
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
      expect(prismaMock.item.findMany).not.toHaveBeenCalled();
    });
  });
});
