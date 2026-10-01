// Tests for src/app/api/v1/supplier/all/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/supplier/all/route");

const get = (options) => GET(buildRequest("/api/v1/supplier/all", options));

const storedSuppliers = () => [
  {
    supplier_id: "SUP-1",
    name: "Alpha",
    statements: [{ amount: "120.00" }],
    _count: { purchase_order: 2 },
  },
];

const MODULES = [
  "all_suppliers",
  "statements",
  "add_items",
  "item_details",
  "purchaseorder",
  "supplier_details",
  "materialstoorder",
  "project_details",
];

describe("GET /api/v1/supplier/all", () => {
  describeAuthorization(get, {
    modules: MODULES,
    setup: () => prismaMock.supplier.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.supplier.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.supplier.findMany.mockResolvedValue(storedSuppliers());
    });

    it("returns the suppliers", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Suppliers fetched successfully",
        data: storedSuppliers(),
      });
    });

    it("excludes deleted suppliers", async () => {
      await get();

      expect(prismaMock.supplier.findMany.mock.calls[0][0].where).toEqual({
        is_deleted: false,
      });
    });

    it("selects the supplier fields only", async () => {
      await get();

      const { select } = prismaMock.supplier.findMany.mock.calls[0][0];
      expect(select).toMatchObject({
        supplier_id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        website: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      });
      expect(select).not.toHaveProperty("abn_number");
    });

    it("includes only pending statement amounts", async () => {
      await get();

      expect(
        prismaMock.supplier.findMany.mock.calls[0][0].select.statements,
      ).toEqual({
        where: { payment_status: "PENDING" },
        select: { amount: true },
      });
    });

    it("counts only purchase orders that are not fully received or cancelled", async () => {
      await get();

      expect(
        prismaMock.supplier.findMany.mock.calls[0][0].select._count,
      ).toEqual({
        select: {
          purchase_order: {
            where: { NOT: { status: { in: ["FULLY_RECEIVED", "CANCELLED"] } } },
          },
        },
      });
    });

    it("returns an empty list when there are no suppliers", async () => {
      prismaMock.supplier.findMany.mockResolvedValue([]);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.supplier.findMany.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
