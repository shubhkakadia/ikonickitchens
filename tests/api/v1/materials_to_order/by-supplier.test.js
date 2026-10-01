// Tests for src/app/api/v1/materials_to_order/by-supplier/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } =
  await import("@/app/api/v1/materials_to_order/by-supplier/[id]/route");

const SUPPLIER_ID = "SUP-1";
const URL = `/api/v1/materials_to_order/by-supplier/${SUPPLIER_ID}`;
const get = (options) =>
  GET(buildRequest(URL, options), routeContext({ id: SUPPLIER_ID }));

const storedMtos = () => [{ id: "mto-1", items: [{ id: "mi-1" }] }];

describe("GET /api/v1/materials_to_order/by-supplier/[id]", () => {
  describeAuthorization(get, {
    modules: "supplier_details",
    setup: () => prismaMock.materials_to_order.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.materials_to_order.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.materials_to_order.findMany.mockResolvedValue(storedMtos());
    });

    it("returns the MTOs for the supplier", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Materials to orders fetched successfully",
        data: storedMtos(),
      });
    });

    it("filters to non-deleted MTOs that contain an item from the supplier", async () => {
      await get();

      const { where, orderBy } =
        prismaMock.materials_to_order.findMany.mock.calls[0][0];
      expect(where).toEqual({
        is_deleted: false,
        items: {
          some: {
            item: { itemSuppliers: { some: { supplier_id: SUPPLIER_ID } } },
          },
        },
      });
      expect(orderBy).toEqual({ createdAt: "desc" });
    });

    it("only includes this supplier's non-deleted items and non-deleted media", async () => {
      await get();

      const { include } =
        prismaMock.materials_to_order.findMany.mock.calls[0][0];
      expect(include.items.where).toEqual({
        item: {
          itemSuppliers: { some: { supplier_id: SUPPLIER_ID } },
          is_deleted: false,
        },
      });
      expect(include.media).toEqual({ where: { is_deleted: false } });
    });

    it("returns an empty list when the supplier has no MTOs", async () => {
      prismaMock.materials_to_order.findMany.mockResolvedValue([]);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.materials_to_order.findMany.mockRejectedValue(
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
