// Tests for src/app/api/v1/materials_to_order/used_material_list/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } =
  await import("@/app/api/v1/materials_to_order/used_material_list/route");

const URL = "/api/v1/materials_to_order/used_material_list";
const get = (options) => GET(buildRequest(URL, options));

const received = () => [{ order: { id: "po-1", status: "RECEIVED" } }];
const pending = () => [{ order: { id: "po-2", status: "ORDERED" } }];

const mtoItem = (overrides = {}) => ({
  id: "mi-1",
  quantity: 5,
  item: { item_id: "ITEM-1", itemSuppliers: [] },
  ordered_items: [],
  reserve_item_stock: [],
  ...overrides,
});

const mto = (id, items) => ({
  id,
  project: { id: "p1", name: "Smith" },
  items,
});

const body = async (res) => res.json();

describe("GET /api/v1/materials_to_order/used_material_list", () => {
  describeAuthorization(get, {
    modules: "usedmaterial",
    setup: () => prismaMock.materials_to_order.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.materials_to_order.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.materials_to_order.findMany.mockResolvedValue([]);
    });

    it("queries non-deleted MTOs, newest first", async () => {
      await get();

      const args = prismaMock.materials_to_order.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ is_deleted: false });
      expect(args.orderBy).toEqual({ createdAt: "desc" });
    });

    it("returns empty lists and zero counts when there are no MTOs", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await body(res)).toEqual({
        status: true,
        data: { ready_to_use: [], upcoming: [] },
        counts: { ready_to_use: 0, upcoming: 0, total: 0 },
        message: "Used material list fetched successfully",
      });
    });

    it("skips MTOs that have no items", async () => {
      prismaMock.materials_to_order.findMany.mockResolvedValue([
        mto("empty", []),
        { id: "null-items", items: null },
      ]);

      const json = await body(await get());

      expect(json.counts.total).toBe(0);
    });

    it("marks an MTO ready when every item has a received PO or reserved stock", async () => {
      prismaMock.materials_to_order.findMany.mockResolvedValue([
        mto("ready", [
          mtoItem({ id: "a", ordered_items: received() }),
          mtoItem({ id: "b", reserve_item_stock: [{ id: "r1" }] }),
        ]),
      ]);

      const json = await body(await get());

      expect(json.data.upcoming).toEqual([]);
      expect(json.data.ready_to_use).toHaveLength(1);
      expect(json.data.ready_to_use[0]).toMatchObject({
        id: "ready",
        is_ready: true,
        statistics: expect.objectContaining({
          total_items: 2,
          received_items: 2,
          pending_items: 0,
        }),
      });
    });

    it("marks an MTO upcoming when any item is still pending", async () => {
      prismaMock.materials_to_order.findMany.mockResolvedValue([
        mto("waiting", [
          mtoItem({ id: "a", ordered_items: received() }),
          mtoItem({ id: "b", ordered_items: pending() }),
          mtoItem({ id: "c" }),
        ]),
      ]);

      const json = await body(await get());

      expect(json.data.ready_to_use).toEqual([]);
      expect(json.data.upcoming[0]).toMatchObject({
        id: "waiting",
        is_ready: false,
        statistics: expect.objectContaining({
          total_items: 3,
          received_items: 1,
          pending_items: 2,
        }),
      });
    });

    it("counts a received PO even when other POs for the item are still open", async () => {
      prismaMock.materials_to_order.findMany.mockResolvedValue([
        mto("mixed", [
          mtoItem({ ordered_items: [...pending(), ...received()] }),
        ]),
      ]);

      const json = await body(await get());

      expect(json.counts).toEqual({ ready_to_use: 1, upcoming: 0, total: 1 });
    });

    it("sums quantities, parsing strings and ignoring junk", async () => {
      prismaMock.materials_to_order.findMany.mockResolvedValue([
        mto("m", [
          mtoItem({ id: "a", quantity: "2.5" }),
          mtoItem({ id: "b", quantity: 4 }),
          mtoItem({ id: "c", quantity: "abc" }),
        ]),
      ]);

      const json = await body(await get());

      expect(json.data.upcoming[0].statistics.total_quantity).toBe(6.5);
    });

    it("splits several MTOs into the right buckets and counts them", async () => {
      prismaMock.materials_to_order.findMany.mockResolvedValue([
        mto("r1", [mtoItem({ ordered_items: received() })]),
        mto("u1", [mtoItem()]),
        mto("r2", [mtoItem({ reserve_item_stock: [{ id: "r" }] })]),
      ]);

      const json = await body(await get());

      expect(json.data.ready_to_use.map((m) => m.id)).toEqual(["r1", "r2"]);
      expect(json.data.upcoming.map((m) => m.id)).toEqual(["u1"]);
      expect(json.counts).toEqual({ ready_to_use: 2, upcoming: 1, total: 3 });
    });

    // Current behaviour (bug): the route reads item.item.supplier, but the
    // query only selects itemSuppliers, so every item lands in "Unassigned".
    it("groups every item under Unassigned regardless of its suppliers", async () => {
      prismaMock.materials_to_order.findMany.mockResolvedValue([
        mto("m", [
          mtoItem({
            id: "a",
            item: {
              item_id: "I1",
              itemSuppliers: [
                {
                  supplier_id: "S1",
                  supplier: { supplier_id: "S1", name: "Alpha" },
                },
              ],
            },
          }),
          mtoItem({ id: "b" }),
        ]),
      ]);

      const json = await body(await get());

      const { suppliers } = json.data.upcoming[0].statistics;
      expect(suppliers).toHaveLength(1);
      expect(suppliers[0]).toMatchObject({
        supplier_id: "unassigned",
        supplier_name: "Unassigned",
        item_count: 2,
      });
      expect(suppliers[0].items.map((i) => i.id)).toEqual(["a", "b"]);
    });

    it("returns 500 with the error message when the query fails", async () => {
      prismaMock.materials_to_order.findMany.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await get();

      expect(res.status).toBe(500);
      expect(await body(res)).toEqual({
        status: false,
        message: "Internal server error",
        error: "DB down",
      });
    });
  });
});
