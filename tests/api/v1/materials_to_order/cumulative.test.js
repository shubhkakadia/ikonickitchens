// Tests for src/app/api/v1/materials_to_order/cumulative/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } =
  await import("@/app/api/v1/materials_to_order/cumulative/route");

const URL = "/api/v1/materials_to_order/cumulative";
const get = (options) => GET(buildRequest(URL, options));

const supplier = (id, name, reference) => ({
  supplier_reference: reference,
  supplier: { supplier_id: id, name },
});

const catalogItem = (overrides = {}) => ({
  item_id: "ITEM-1",
  category: "SHEET",
  description: "White melamine",
  measurement_unit: "SHEET",
  quantity: 7,
  image: null,
  sheet: { finish: "matte" },
  handle: null,
  hardware: null,
  accessory: null,
  edging_tape: null,
  itemSuppliers: [supplier("SUP-1", "Alpha", "A-100")],
  ...overrides,
});

const mtoItem = (overrides = {}) => ({
  id: "mi-1",
  quantity: 10,
  quantity_ordered_po: 0,
  item: catalogItem(),
  ...overrides,
});

const mto = (items, overrides = {}) => ({
  id: "mto-1",
  project: { id: "p1", name: "Smith House" },
  items,
  ...overrides,
});

function mockData(mtos, reservations = []) {
  prismaMock.materials_to_order.findMany.mockResolvedValue(mtos);
  prismaMock.reserve_item_stock.findMany.mockResolvedValue(reservations);
}

const body = async (res) => (await res.json()).data;

describe("GET /api/v1/materials_to_order/cumulative", () => {
  describeAuthorization(get, {
    modules: "materialstoorder",
    setup: () => mockData([]),
    untouched: () => [prismaMock.materials_to_order.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockData([]);
    });

    it("queries only active (DRAFT / PARTIALLY_ORDERED) non-deleted MTOs", async () => {
      await get();

      expect(
        prismaMock.materials_to_order.findMany.mock.calls[0][0].where,
      ).toEqual({
        is_deleted: false,
        status: { in: ["DRAFT", "PARTIALLY_ORDERED"] },
      });
    });

    it("looks up reservations for the MTO item ids", async () => {
      mockData([
        mto([mtoItem({ id: "mi-1" }), mtoItem({ id: "mi-2" })]),
        mto([mtoItem({ id: "mi-3" })], { id: "mto-2" }),
      ]);

      await get();

      expect(prismaMock.reserve_item_stock.findMany).toHaveBeenCalledWith({
        where: { mto_id: { in: ["mi-1", "mi-2", "mi-3"] } },
        select: { mto_id: true, quantity: true, used_quantity: true },
      });
    });

    it("returns an empty list when there is nothing to order", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        data: [],
        message: "Cumulative materials fetched successfully",
      });
    });

    it("groups items under their supplier with the remaining quantity", async () => {
      mockData([mto([mtoItem({ quantity: 10, quantity_ordered_po: 4 })])]);

      const data = await body(await get());

      expect(data).toEqual([
        {
          supplier_id: "SUP-1",
          supplier_name: "Alpha",
          items: [
            {
              item_id: "ITEM-1",
              category: "SHEET",
              description: "White melamine",
              supplier_reference: "A-100",
              image: null,
              sheet: { finish: "matte" },
              handle: null,
              hardware: null,
              accessory: null,
              edging_tape: null,
              measurement_unit: "SHEET",
              stock_on_hand: 7,
              cumulative_quantity: 6,
              mto_sources: [
                {
                  mto_id: "mto-1",
                  mto_item_id: "mi-1",
                  project_name: "Smith House",
                  quantity: 6,
                },
              ],
            },
          ],
        },
      ]);
    });

    it("sums the same item across MTOs and records each source", async () => {
      mockData([
        mto([mtoItem({ id: "mi-1", quantity: 5 })], { id: "mto-1" }),
        mto([mtoItem({ id: "mi-2", quantity: 3 })], {
          id: "mto-2",
          project: { id: "p2", name: "Jones Unit" },
        }),
      ]);

      const [group] = await body(await get());

      expect(group.items).toHaveLength(1);
      expect(group.items[0].cumulative_quantity).toBe(8);
      expect(group.items[0].mto_sources).toEqual([
        {
          mto_id: "mto-1",
          mto_item_id: "mi-1",
          project_name: "Smith House",
          quantity: 5,
        },
        {
          mto_id: "mto-2",
          mto_item_id: "mi-2",
          project_name: "Jones Unit",
          quantity: 3,
        },
      ]);
    });

    it("lists an item under every supplier that stocks it", async () => {
      mockData([
        mto([
          mtoItem({
            item: catalogItem({
              itemSuppliers: [
                supplier("SUP-1", "Alpha", "A-100"),
                supplier("SUP-2", "Beta", "B-200"),
              ],
            }),
          }),
        ]),
      ]);

      const data = await body(await get());

      expect(data.map((g) => g.supplier_id)).toEqual(["SUP-1", "SUP-2"]);
      expect(data[0].items[0].supplier_reference).toBe("A-100");
      expect(data[1].items[0].supplier_reference).toBe("B-200");
      expect(data[0].items[0].cumulative_quantity).toBe(10);
      expect(data[1].items[0].cumulative_quantity).toBe(10);
    });

    it("puts items with no suppliers under Unassigned", async () => {
      mockData([mto([mtoItem({ item: catalogItem({ itemSuppliers: [] }) })])]);

      const data = await body(await get());

      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        supplier_id: "unassigned",
        supplier_name: "Unassigned",
      });
      expect(data[0].items[0].supplier_reference).toBeNull();
    });

    it("puts a supplier link with no supplier record under Unassigned", async () => {
      mockData([
        mto([
          mtoItem({
            item: catalogItem({
              itemSuppliers: [{ supplier_reference: "X", supplier: null }],
            }),
          }),
        ]),
      ]);

      const data = await body(await get());

      expect(data[0].supplier_id).toBe("unassigned");
      expect(data[0].items[0].supplier_reference).toBe("X");
    });

    it("sorts suppliers by name", async () => {
      mockData([
        mto([
          mtoItem({
            id: "mi-1",
            item: catalogItem({
              item_id: "I1",
              itemSuppliers: [supplier("S-Z", "Zeta")],
            }),
          }),
          mtoItem({
            id: "mi-2",
            item: catalogItem({
              item_id: "I2",
              itemSuppliers: [supplier("S-A", "Alpha")],
            }),
          }),
          mtoItem({
            id: "mi-3",
            item: catalogItem({ item_id: "I3", itemSuppliers: [] }),
          }),
        ]),
      ]);

      const data = await body(await get());

      expect(data.map((g) => g.supplier_name)).toEqual([
        "Alpha",
        "Unassigned",
        "Zeta",
      ]);
    });

    it("skips MTO items that have stock reserved", async () => {
      mockData(
        [
          mto([
            mtoItem({ id: "mi-1" }),
            mtoItem({ id: "mi-2", item: catalogItem({ item_id: "ITEM-2" }) }),
          ]),
        ],
        [{ mto_id: "mi-1", quantity: 10, used_quantity: 0 }],
      );

      const [group] = await body(await get());

      expect(group.items.map((i) => i.item_id)).toEqual(["ITEM-2"]);
    });

    it.each([
      ["fully ordered", { quantity: 5, quantity_ordered_po: 5 }],
      ["over ordered", { quantity: 5, quantity_ordered_po: 8 }],
      ["zero quantity", { quantity: 0, quantity_ordered_po: 0 }],
    ])("skips MTO items that are %s", async (_, overrides) => {
      mockData([mto([mtoItem(overrides)])]);

      expect(await body(await get())).toEqual([]);
    });

    it("parses string quantities and treats junk as zero", async () => {
      mockData([
        mto([
          mtoItem({ id: "mi-1", quantity: "10.5", quantity_ordered_po: "0.5" }),
          mtoItem({
            id: "mi-2",
            item: catalogItem({ item_id: "ITEM-2" }),
            quantity: "abc",
          }),
        ]),
      ]);

      const [group] = await body(await get());

      expect(group.items).toHaveLength(1);
      expect(group.items[0].cumulative_quantity).toBe(10);
    });

    it("skips MTO items whose catalog item is missing", async () => {
      mockData([mto([mtoItem({ item: null })])]);

      expect(await body(await get())).toEqual([]);
    });

    it("reports stock on hand as 0 when the item has no quantity", async () => {
      mockData([mto([mtoItem({ item: catalogItem({ quantity: null }) })])]);

      const [group] = await body(await get());

      expect(group.items[0].stock_on_hand).toBe(0);
    });

    it("returns 500 with the error message when a query fails", async () => {
      prismaMock.materials_to_order.findMany.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
        error: "DB down",
      });
    });

    it("returns 500 when the reservation query fails", async () => {
      prismaMock.reserve_item_stock.findMany.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await get();

      expect(res.status).toBe(500);
    });
  });
});
