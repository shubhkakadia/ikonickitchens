// Tests for src/app/api/v1/materials_to_order/all/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/materials_to_order/all/route");

const URL = "/api/v1/materials_to_order/all";
const get = (options) => GET(buildRequest(URL, options));

const storedMtos = () => [
  { id: "mto-2", project: { name: "B", project_id: "P2" }, items: [] },
  { id: "mto-1", project: { name: "A", project_id: "P1" }, items: [] },
];

describe("GET /api/v1/materials_to_order/all", () => {
  describeAuthorization(get, {
    modules: "materialstoorder",
    setup: () => prismaMock.materials_to_order.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.materials_to_order.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.materials_to_order.findMany.mockResolvedValue(storedMtos());
    });

    it("returns the MTOs", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Materials to orders fetched successfully",
        data: storedMtos(),
      });
    });

    it("excludes soft-deleted MTOs and sorts newest first", async () => {
      await get();

      const args = prismaMock.materials_to_order.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ is_deleted: false });
      expect(args.orderBy).toEqual({ createdAt: "desc" });
    });

    it("includes related data and only non-deleted media", async () => {
      await get();

      const { include } =
        prismaMock.materials_to_order.findMany.mock.calls[0][0];
      expect(Object.keys(include).sort()).toEqual(
        ["createdBy", "items", "lots", "media", "project"].sort(),
      );
      expect(include.media).toEqual({ where: { is_deleted: false } });
    });

    it("returns an empty list when there are no MTOs", async () => {
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
