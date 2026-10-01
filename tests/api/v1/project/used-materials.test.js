// Tests for src/app/api/v1/project/[id]/used-materials/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/project/[id]/used-materials/route");

const ID = "ikc-btto-0001";
const URL = `/api/v1/project/${ID}/used-materials`;
const get = (options) =>
  GET(buildRequest(URL, options), routeContext({ id: ID }));

// A USED stock transaction; `item` overrides merge over a sheet item
const tx = (id, quantity, itemOverrides = {}, overrides = {}) => ({
  id,
  createdAt: "2026-03-01T00:00:00.000Z",
  quantity,
  notes: null,
  lot: null,
  materials_to_order: null,
  item: {
    item_id: `ITEM-${id}`,
    category: "SHEET",
    measurement_unit: "SHEET",
    description: null,
    sheet: { brand: "Polytec", color: "White", finish: "Matte" },
    handle: null,
    hardware: null,
    accessory: null,
    edging_tape: null,
    itemSuppliers: [{ price: 10 }],
    ...itemOverrides,
  },
  ...overrides,
});

function mockData(transactions = [], project = { project_id: ID }) {
  prismaMock.project.findFirst.mockResolvedValue(project);
  prismaMock.stock_transaction.findMany.mockResolvedValue(transactions);
}

const body = async (res) => (await res.json()).data;

describe("GET /api/v1/project/[id]/used-materials", () => {
  describeAuthorization(get, {
    modules: "project_details",
    setup: () => mockData(),
    untouched: () => [
      prismaMock.project.findFirst,
      prismaMock.stock_transaction.findMany,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockData();
    });

    it("returns empty data and zeroed summaries when nothing was used", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Used materials fetched successfully",
        data: {
          transactions: [],
          summary: {
            total_quantity: 0,
            transaction_count: 0,
            estimated_total_expense: 0,
            unpriced_transaction_count: 0,
            unpriced_quantity: 0,
          },
          category_summaries: [],
        },
      });
    });

    describe("queries", () => {
      it("looks up a non-deleted project", async () => {
        await get();

        expect(prismaMock.project.findFirst).toHaveBeenCalledWith({
          where: { project_id: ID, is_deleted: false },
          select: { project_id: true },
        });
      });

      it("fetches USED transactions for the project directly or via its MTOs, newest first", async () => {
        await get();

        const args = prismaMock.stock_transaction.findMany.mock.calls[0][0];
        expect(args.where).toEqual({
          type: "USED",
          OR: [
            { project_id: ID },
            { materials_to_order: { is: { project_id: ID } } },
          ],
        });
        expect(args.orderBy).toEqual({ createdAt: "desc" });
        expect(args.include.item.include.itemSuppliers).toEqual({
          where: { price: { not: null } },
          select: { price: true },
        });
      });

      it("returns 404 when the project does not exist", async () => {
        mockData([], null);

        const res = await get();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Project not found",
        });
        expect(prismaMock.stock_transaction.findMany).not.toHaveBeenCalled();
      });
    });

    describe("transaction rows", () => {
      it("maps a transaction with its cost and lot details", async () => {
        mockData([
          tx(
            "t1",
            3,
            { itemSuppliers: [{ price: "12.5" }] },
            {
              notes: "cut",
              lot: { lot_id: "L1", name: "Kitchen" },
              materials_to_order: {
                id: "mto-1",
                lots: [{ lot_id: "L2", name: "Laundry" }],
              },
            },
          ),
        ]);

        const [row] = (await body(await get())).transactions;

        expect(row).toEqual({
          id: "t1",
          created_at: "2026-03-01T00:00:00.000Z",
          quantity: 3,
          notes: "cut",
          category: "SHEET",
          item_id: "ITEM-t1",
          item_name: "Polytec - White - Matte",
          measurement_unit: "SHEET",
          unit_price: 12.5,
          estimated_cost: 37.5,
          lot: { lot_id: "L1", name: "Kitchen" },
          mto_lots: [{ lot_id: "L2", name: "Laundry" }],
        });
      });

      it("uses the cheapest supplier price", async () => {
        mockData([
          tx("t1", 2, {
            itemSuppliers: [{ price: 30 }, { price: "8" }, { price: 15 }],
          }),
        ]);

        const [row] = (await body(await get())).transactions;

        expect(row.unit_price).toBe(8);
        expect(row.estimated_cost).toBe(16);
      });

      it("leaves cost null when no supplier has a price", async () => {
        mockData([tx("t1", 4, { itemSuppliers: [] })]);

        const [row] = (await body(await get())).transactions;

        expect(row.unit_price).toBeNull();
        expect(row.estimated_cost).toBeNull();
      });

      it("ignores non-numeric supplier prices", async () => {
        mockData([
          tx("t1", 1, { itemSuppliers: [{ price: "abc" }, { price: 5 }] }),
        ]);

        expect((await body(await get())).transactions[0].unit_price).toBe(5);
      });

      it("returns an empty mto_lots list when there is no MTO", async () => {
        mockData([tx("t1", 1)]);

        const [row] = (await body(await get())).transactions;

        expect(row.mto_lots).toEqual([]);
        expect(row.lot).toBeNull();
      });
    });

    describe("item names", () => {
      const nameOf = async (itemOverrides) => {
        mockData([
          tx("t1", 1, {
            description: null,
            sheet: null,
            handle: null,
            hardware: null,
            accessory: null,
            edging_tape: null,
            ...itemOverrides,
          }),
        ]);
        return (await body(await get())).transactions[0].item_name;
      };

      it("prefers the description", async () => {
        expect(
          await nameOf({ description: "Custom thing", sheet: { brand: "X" } }),
        ).toBe("Custom thing");
      });

      it.each([
        [
          "a sheet",
          { sheet: { brand: "Polytec", color: "White", finish: "Matte" } },
          "Polytec - White - Matte",
        ],
        [
          "a handle",
          { handle: { brand: "Hafele", type: "Bar", color: "Black" } },
          "Hafele - Bar - Black",
        ],
        [
          "hardware",
          { hardware: { brand: "Blum", name: "Hinge", type: "Soft" } },
          "Blum - Hinge - Soft",
        ],
        ["an accessory", { accessory: { name: "Bin" } }, "Bin"],
        [
          "edging tape",
          { edging_tape: { brand: "Rehau", color: "Oak", finish: "Gloss" } },
          "Rehau - Oak - Gloss",
        ],
      ])("builds the name from %s", async (_, overrides, expected) => {
        expect(await nameOf(overrides)).toBe(expected);
      });

      it("skips missing parts when joining", async () => {
        expect(
          await nameOf({
            sheet: { brand: "Polytec", color: null, finish: "Matte" },
          }),
        ).toBe("Polytec - Matte");
      });

      it("falls back to the item id when there is no detail record", async () => {
        expect(await nameOf({})).toBe("ITEM-t1");
      });

      it("falls back to the item id for an accessory without a name", async () => {
        expect(await nameOf({ accessory: { name: null } })).toBe("ITEM-t1");
      });

      // Current behaviour: a detail record with every field empty yields "".
      it("returns an empty name for a sheet with no brand, color or finish", async () => {
        expect(
          await nameOf({ sheet: { brand: null, color: null, finish: null } }),
        ).toBe("");
      });
    });

    describe("summaries", () => {
      it("totals quantity and priced expense, and counts unpriced transactions", async () => {
        mockData([
          tx("t1", 2, { itemSuppliers: [{ price: 10 }] }), // 20
          tx("t2", 3, { itemSuppliers: [{ price: 5 }] }), // 15
          tx("t3", 4, { itemSuppliers: [] }), // unpriced
        ]);

        const { summary } = await body(await get());

        expect(summary).toEqual({
          total_quantity: 9,
          transaction_count: 3,
          estimated_total_expense: 35,
          unpriced_transaction_count: 1,
          unpriced_quantity: 4,
        });
      });

      it("groups by category and sorts by expense, highest first", async () => {
        mockData([
          tx("t1", 1, { category: "HANDLE", itemSuppliers: [{ price: 5 }] }), // 5
          tx("t2", 2, { category: "SHEET", itemSuppliers: [{ price: 50 }] }), // 100
          tx("t3", 3, { category: "SHEET", itemSuppliers: [] }), // unpriced
          tx("t4", 1, { category: "HARDWARE", itemSuppliers: [{ price: 20 }] }), // 20
        ]);

        const { category_summaries } = await body(await get());

        expect(category_summaries).toEqual([
          {
            category: "SHEET",
            quantity: 5,
            estimated_expense: 100,
            transaction_count: 2,
            unpriced_transaction_count: 1,
            unpriced_quantity: 3,
          },
          {
            category: "HARDWARE",
            quantity: 1,
            estimated_expense: 20,
            transaction_count: 1,
            unpriced_transaction_count: 0,
            unpriced_quantity: 0,
          },
          {
            category: "HANDLE",
            quantity: 1,
            estimated_expense: 5,
            transaction_count: 1,
            unpriced_transaction_count: 0,
            unpriced_quantity: 0,
          },
        ]);
      });
    });

    it("returns 500 when the transaction query fails", async () => {
      prismaMock.stock_transaction.findMany.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });

    it("returns 500 when the project query fails", async () => {
      prismaMock.project.findFirst.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
    });
  });
});
