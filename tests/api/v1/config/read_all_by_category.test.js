import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { POST } = await import("@/app/api/v1/config/read_all_by_category/route");

const URL = "/api/v1/config/read_all_by_category";
const CONFIG_MODULES = [
  "config",
  "add_employees",
  "employee_details",
  "add_items",
  "item_details",
  "project_details",
  "materialstoorder",
  "purchaseorder",
  "supplier_details",
];

const post = (body = { category: "role" }, options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

describe("POST /api/v1/config/read_all_by_category", () => {
  describeAuthorization((options) => post(undefined, options), {
    modules: CONFIG_MODULES,
    setup: () => prismaMock.constants_config.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.constants_config.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("returns every config in the category, newest first", async () => {
      const configs = [
        { id: "c2", category: "role", value: "Installer" },
        { id: "c1", category: "role", value: "Designer" },
      ];
      prismaMock.constants_config.findMany.mockResolvedValue(configs);

      const res = await post({ category: "role" });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Configs fetched successfully",
        data: configs,
      });
      expect(prismaMock.constants_config.findMany).toHaveBeenCalledWith({
        where: { category: "role" },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns an empty list for an unknown category", async () => {
      prismaMock.constants_config.findMany.mockResolvedValue([]);

      const res = await post({ category: "does-not-exist" });

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
    });

    it("does not write an activity log for a read", async () => {
      prismaMock.constants_config.findMany.mockResolvedValue([]);

      await post();

      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it.each([
      ["missing", {}],
      ["empty", { category: "" }],
      ["null", { category: null }],
    ])("returns 400 when category is %s", async (_, body) => {
      const res = await post(body);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Category is required in request body",
      });
      expect(prismaMock.constants_config.findMany).not.toHaveBeenCalled();
    });

    // Current behaviour: category is not type-checked, so an object reaches
    // the Prisma where clause as-is (Prisma would treat it as a filter).
    it("passes a non-string category straight into the query", async () => {
      prismaMock.constants_config.findMany.mockResolvedValue([]);

      await post({ category: { contains: "" } });

      expect(prismaMock.constants_config.findMany).toHaveBeenCalledWith({
        where: { category: { contains: "" } },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.constants_config.findMany.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await post();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });

    // Current behaviour: a malformed body is a 500 rather than a 400.
    it("returns 500 for a malformed JSON body", async () => {
      const res = await POST(
        buildRequest(URL, {
          method: "POST",
          rawBody: "{not json",
          headers: { "content-type": "application/json" },
        }),
      );

      expect(res.status).toBe(500);
      expect(prismaMock.constants_config.findMany).not.toHaveBeenCalled();
    });
  });
});
