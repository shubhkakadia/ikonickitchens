// Tests for src/app/api/v1/stock_transaction/used/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/stock_transaction/used/route");

const get = (options) =>
  GET(buildRequest("/api/v1/stock_transaction/used", options));

const storedTransactions = () => [
  { id: "t2", type: "USED", quantity: 2, item: { item_id: "A" } },
  { id: "t1", type: "USED", quantity: 5, item: { item_id: "B" } },
];

describe("GET /api/v1/stock_transaction/used", () => {
  describeAuthorization(get, {
    modules: "usedmaterial",
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

    it("returns the USED transactions", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        data: storedTransactions(),
        message: "Recently used materials fetched successfully",
      });
    });

    it("only fetches USED transactions, newest first", async () => {
      await get();

      const args = prismaMock.stock_transaction.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ type: "USED" });
      expect(args.orderBy).toEqual({ createdAt: "desc" });
    });

    it("includes the item, project, lot and the MTO's project and lots", async () => {
      await get();

      const { include } =
        prismaMock.stock_transaction.findMany.mock.calls[0][0];
      expect(Object.keys(include).sort()).toEqual(
        ["item", "lot", "materials_to_order", "project"].sort(),
      );
      expect(include.item.select).toMatchObject({
        item_id: true,
        category: true,
        description: true,
        measurement_unit: true,
        image: { select: { url: true } },
        sheet: true,
        handle: true,
        hardware: true,
        accessory: true,
        edging_tape: true,
      });
      expect(include.project).toEqual({
        select: { project_id: true, name: true },
      });
      expect(include.lot).toEqual({ select: { lot_id: true, name: true } });
      expect(include.materials_to_order.select).toEqual({
        project: { select: { project_id: true, name: true } },
        lots: { select: { lot_id: true, name: true } },
      });
    });

    it("returns an empty list when nothing has been used", async () => {
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
