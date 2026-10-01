// Tests for src/app/api/v1/item/by-supplier/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/item/by-supplier/[id]/route");

const SUPPLIER = "supplier-1";
const get = (options) =>
  GET(
    buildRequest(`/api/v1/item/by-supplier/${SUPPLIER}`, options),
    routeContext({ id: SUPPLIER }),
  );

const WHERE = {
  itemSuppliers: { some: { supplier_id: SUPPLIER } },
  is_deleted: false,
};

describe("GET /api/v1/item/by-supplier/[id]", () => {
  describeAuthorization(get, {
    modules: ["supplier_details", "purchaseorder"],
    setup: () => prismaMock.item.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.item.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    // First call: which categories exist; second call: the items themselves
    function mockItems(categories, items) {
      prismaMock.item.findMany
        .mockResolvedValueOnce(categories.map((category) => ({ category })))
        .mockResolvedValueOnce(items);
    }

    it("returns the supplier's non-deleted items", async () => {
      const items = [{ item_id: "i1", category: "SHEET" }];
      mockItems(["SHEET"], items);

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Items fetched successfully",
        data: items,
      });
      expect(prismaMock.item.findMany).toHaveBeenNthCalledWith(1, {
        where: WHERE,
        select: { category: true },
      });
    });

    it("includes the detail relation for each category present, once", async () => {
      mockItems(["SHEET", "HANDLE", "SHEET"], []);

      await get();

      expect(prismaMock.item.findMany).toHaveBeenNthCalledWith(2, {
        where: WHERE,
        include: {
          image: true,
          itemSuppliers: { include: { supplier: true } },
          sheet: true,
          handle: true,
        },
      });
    });

    it("includes every detail relation when all categories are present", async () => {
      mockItems(
        ["SHEET", "HANDLE", "HARDWARE", "ACCESSORY", "EDGING_TAPE"],
        [],
      );

      await get();

      const { include } = prismaMock.item.findMany.mock.calls[1][0];
      for (const relation of [
        "sheet",
        "handle",
        "hardware",
        "accessory",
        "edging_tape",
      ]) {
        expect(include[relation]).toBe(true);
      }
    });

    it("returns an empty list for a supplier with no items (or unknown supplier)", async () => {
      mockItems([], []);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
      const { include } = prismaMock.item.findMany.mock.calls[1][0];
      expect(Object.keys(include)).toEqual(["image", "itemSuppliers"]);
    });

    it("returns 500 when a query fails", async () => {
      prismaMock.item.findMany.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal Server Error",
      });
    });
  });
});
