// Tests for src/app/api/v1/item/all/[category]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/item/all/[category]/route");

const get = (category = "sheet", options) =>
  GET(
    buildRequest(`/api/v1/item/all/${category}`, options),
    routeContext({ category }),
  );

describe("GET /api/v1/item/all/[category]", () => {
  describeAuthorization((options) => get("sheet", options), {
    modules: [
      "all_items",
      "project_details",
      "materialstoorder",
      "usedmaterial",
    ],
    setup: () => prismaMock.item.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.item.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.item.findMany.mockResolvedValue([]);
    });

    it("returns non-deleted items of the category", async () => {
      const items = [
        { item_id: "i1", category: "SHEET", sheet: { brand: "Polytec" } },
      ];
      prismaMock.item.findMany.mockResolvedValue(items);

      const res = await get("sheet");

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Items fetched successfully",
        data: items,
      });
    });

    it.each(["sheet", "handle", "hardware", "accessory", "edging_tape"])(
      "includes image, suppliers and only the %s details",
      async (category) => {
        await get(category);

        expect(prismaMock.item.findMany).toHaveBeenCalledWith({
          where: { category: category.toUpperCase(), is_deleted: false },
          include: {
            image: true,
            [category]: true,
            itemSuppliers: { include: { supplier: true } },
          },
        });
      },
    );

    it("accepts the category in any letter case", async () => {
      const res = await get("Edging_Tape");

      expect(res.status).toBe(200);
      expect(prismaMock.item.findMany.mock.calls[0][0].where.category).toBe(
        "EDGING_TAPE",
      );
    });

    it.each(["panel", "sheets", "edging-tape", ""])(
      "returns 400 for unknown category %j",
      async (category) => {
        const res = await get(category);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Invalid category",
        });
        expect(prismaMock.item.findMany).not.toHaveBeenCalled();
      },
    );

    it("returns 500 when the query fails", async () => {
      prismaMock.item.findMany.mockRejectedValue(new Error("DB down"));

      const res = await get("sheet");

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
