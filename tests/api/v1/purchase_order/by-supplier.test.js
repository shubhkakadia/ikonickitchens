// Tests for src/app/api/v1/purchase_order/by-supplier/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } =
  await import("@/app/api/v1/purchase_order/by-supplier/[id]/route");

const SUPPLIER_ID = "SUP-1";
const get = (options) =>
  GET(
    buildRequest(`/api/v1/purchase_order/by-supplier/${SUPPLIER_ID}`, options),
    routeContext({ id: SUPPLIER_ID }),
  );

const storedPos = () => [{ id: "po-1", supplier_id: SUPPLIER_ID, items: [] }];

describe("GET /api/v1/purchase_order/by-supplier/[id]", () => {
  describeAuthorization(get, {
    modules: "supplier_details",
    setup: () => prismaMock.purchase_order.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.purchase_order.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.purchase_order.findMany.mockResolvedValue(storedPos());
    });

    it("returns the supplier's purchase orders", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Purchase orders fetched successfully",
        data: storedPos(),
      });
    });

    it("filters by supplier and sorts newest first", async () => {
      await get();

      const args = prismaMock.purchase_order.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ supplier_id: SUPPLIER_ID });
      expect(args.orderBy).toEqual({ createdAt: "desc" });
    });

    it("includes the ordering user with username and employee name", async () => {
      await get();

      const { include } = prismaMock.purchase_order.findMany.mock.calls[0][0];
      expect(include.orderedBy.select).toEqual({
        id: true,
        username: true,
        employee: {
          select: { employee_id: true, first_name: true, last_name: true },
        },
      });
      expect(include.invoice_url).toBe(true);
    });

    it("returns an empty list when the supplier has no purchase orders", async () => {
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
