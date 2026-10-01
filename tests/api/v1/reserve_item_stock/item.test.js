// Tests for src/app/api/v1/reserve_item_stock/item/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/reserve_item_stock/item/[id]/route");

const ITEM_ID = "ITEM-A";
const get = (options) =>
  GET(
    buildRequest(`/api/v1/reserve_item_stock/item/${ITEM_ID}`, options),
    routeContext({ id: ITEM_ID }),
  );

const storedItem = () => ({ item_id: ITEM_ID, quantity: 20 });
const reservations = () => [
  { id: "res-2", item_id: ITEM_ID, quantity: 5 },
  { id: "res-1", item_id: ITEM_ID, quantity: 3 },
];

function mockFetch({ item = storedItem(), list = reservations() } = {}) {
  prismaMock.item.findUnique.mockResolvedValue(item);
  prismaMock.reserve_item_stock.findMany.mockResolvedValue(list);
}

describe("GET /api/v1/reserve_item_stock/item/[id]", () => {
  describeAuthorization(get, {
    modules: "materialstoorder",
    setup: () => mockFetch(),
    untouched: () => [
      prismaMock.item.findUnique,
      prismaMock.reserve_item_stock.findMany,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockFetch();
    });

    it("returns the item's reservations with the total reserved", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Stock reservations retrieved successfully",
        data: {
          reservations: reservations(),
          totalReserved: 8,
          itemDetails: storedItem(),
        },
      });
    });

    it("looks up the item, then its reservations newest first with item details", async () => {
      await get();

      expect(prismaMock.item.findUnique).toHaveBeenCalledWith({
        where: { item_id: ITEM_ID },
      });
      const args = prismaMock.reserve_item_stock.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ item_id: ITEM_ID });
      expect(args.orderBy).toEqual({ createdAt: "desc" });
      expect(args.include.item.include).toEqual({
        sheet: true,
        handle: true,
        hardware: true,
        accessory: true,
        edging_tape: true,
      });
    });

    it("reports zero reserved when there are no reservations", async () => {
      mockFetch({ list: [] });

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toMatchObject({
        reservations: [],
        totalReserved: 0,
      });
    });

    it("returns 404 when the item does not exist", async () => {
      mockFetch({ item: null });

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Item not found",
      });
      expect(prismaMock.reserve_item_stock.findMany).not.toHaveBeenCalled();
    });

    it("returns 500 when the item lookup fails", async () => {
      prismaMock.item.findUnique.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
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
