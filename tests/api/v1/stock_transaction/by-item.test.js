// Tests for src/app/api/v1/stock_transaction/by-item/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } =
  await import("@/app/api/v1/stock_transaction/by-item/[id]/route");

const ITEM_ID = "ITEM-A";
const get = (options) =>
  GET(
    buildRequest(`/api/v1/stock_transaction/by-item/${ITEM_ID}`, options),
    routeContext({ id: ITEM_ID }),
  );

const storedTransactions = () => [
  {
    id: "t2",
    item_id: ITEM_ID,
    type: "USED",
    quantity: 2,
    project: null,
    lot: { lot_id: "L1" },
  },
  {
    id: "t1",
    item_id: ITEM_ID,
    type: "ADDED",
    quantity: 10,
    project: null,
    lot: null,
  },
];

describe("GET /api/v1/stock_transaction/by-item/[id]", () => {
  describeAuthorization(get, {
    modules: "item_details",
    setup: () => prismaMock.stock_transaction.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.stock_transaction.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.stock_transaction.findMany.mockResolvedValue(
        storedTransactions(),
      );
    });

    it("returns the item's transactions", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Stock transactions fetched successfully",
        data: storedTransactions(),
      });
    });

    it("filters by item, newest first, with the project and lot id", async () => {
      await get();

      expect(prismaMock.stock_transaction.findMany).toHaveBeenCalledWith({
        where: { item_id: ITEM_ID },
        include: { project: true, lot: { select: { lot_id: true } } },
        orderBy: { createdAt: "desc" },
      });
    });

    // Current behaviour: no item existence check; an unknown item is just empty.
    it("returns an empty list when there are no transactions", async () => {
      prismaMock.stock_transaction.findMany.mockResolvedValue([]);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
    });

    it("returns 500 when the query fails", async () => {
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
  });
});
