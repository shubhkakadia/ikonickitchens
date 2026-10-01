// Tests for src/app/api/v1/material_selection/version/[version_id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } =
  await import("@/app/api/v1/material_selection/version/[version_id]/route");

const VERSION_ID = "v-1";
const URL = `/api/v1/material_selection/version/${VERSION_ID}`;
const get = (options, params = { version_id: VERSION_ID }) =>
  GET(buildRequest(URL, options), routeContext(params));

const storedVersion = () => ({
  id: VERSION_ID,
  version_number: 1,
  is_current: true,
  areas: [{ area_name: "Kitchen", items: [{ name: "Benchtop" }] }],
  material_selection: { id: "ms-1", lot_id: "LOT-1" },
});

describe("GET /api/v1/material_selection/version/[version_id]", () => {
  describeAuthorization(get, {
    modules: "project_details",
    setup: () =>
      prismaMock.material_selection_versions.findUnique.mockResolvedValue(
        storedVersion(),
      ),
    untouched: () => [prismaMock.material_selection_versions.findUnique],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.material_selection_versions.findUnique.mockResolvedValue(
        storedVersion(),
      );
    });

    it("returns the version", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Version fetched successfully",
        data: storedVersion(),
      });
    });

    it("looks the version up by id with areas and items sorted by name", async () => {
      await get();

      const args =
        prismaMock.material_selection_versions.findUnique.mock.calls[0][0];
      expect(args.where).toEqual({ id: VERSION_ID });
      expect(args.include.areas).toEqual({
        include: { items: { orderBy: { name: "asc" } } },
        orderBy: { area_name: "asc" },
      });
      expect(Object.keys(args.include).sort()).toEqual(
        ["areas", "material_selection", "quote"].sort(),
      );
    });

    it("returns 404 when the version does not exist", async () => {
      prismaMock.material_selection_versions.findUnique.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Version not found",
      });
    });

    it("returns 400 when the version_id param is missing", async () => {
      const res = await get(undefined, {});

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Version ID is required",
      });
      expect(
        prismaMock.material_selection_versions.findUnique,
      ).not.toHaveBeenCalled();
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.material_selection_versions.findUnique.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal Server Error",
      });
    });
  });
});
