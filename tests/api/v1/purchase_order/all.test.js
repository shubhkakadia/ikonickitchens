// Tests for src/app/api/v1/purchase_order/all/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/purchase_order/all/route");

const get = (options) =>
  GET(buildRequest("/api/v1/purchase_order/all", options));

const storedPos = () => [
  { id: "po-2", order_no: "PO-2", items: [] },
  { id: "po-1", order_no: "PO-1", items: [] },
];

describe("GET /api/v1/purchase_order/all", () => {
  describeAuthorization(get, {
    modules: "purchaseorder",
    setup: () => prismaMock.purchase_order.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.purchase_order.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.purchase_order.findMany.mockResolvedValue(storedPos());
    });

    it("returns the purchase orders", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Purchase orders fetched successfully",
        data: storedPos(),
      });
    });

    it("sorts newest first and includes the related records", async () => {
      await get();

      const args = prismaMock.purchase_order.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual({ createdAt: "desc" });
      expect(Object.keys(args.include).sort()).toEqual(
        ["invoice_url", "items", "mto", "orderedBy", "supplier"].sort(),
      );
      expect(args.include.invoice_url).toBe(true);
      expect(args.include.items.include.item.include.itemSuppliers).toEqual({
        include: { supplier: true },
      });
    });

    it("returns an empty list when there are no purchase orders", async () => {
      prismaMock.purchase_order.findMany.mockResolvedValue([]);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.purchase_order.findMany.mockRejectedValue(
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
