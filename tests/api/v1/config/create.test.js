import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { POST } = await import("@/app/api/v1/config/create/route");

const URL = "/api/v1/config/create";
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

const post = (body = { category: "role", value: "Installer" }, options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

function mockCreate() {
  prismaMock.constants_config.create.mockImplementation(async ({ data }) => ({
    id: "config-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...data,
  }));
  prismaMock.logs.create.mockResolvedValue({});
}

describe("POST /api/v1/config/create", () => {
  describeAuthorization((options) => post(undefined, options), {
    modules: CONFIG_MODULES,
    setup: mockCreate,
    untouched: () => [prismaMock.constants_config.create],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockCreate();
    });

    it("creates the config and logs it", async () => {
      const res = await post({ category: "role", value: "Installer" });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Config created successfully",
        data: {
          id: "config-1",
          category: "role",
          value: "Installer",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.constants_config.create).toHaveBeenCalledWith({
        data: { category: "role", value: "Installer" },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "constants_config",
          entity_id: "config-1",
          action: "CREATE",
          description: "Config created successfully: role",
        },
      });
    });

    it("ignores fields other than category and value", async () => {
      await post({
        category: "role",
        value: "Installer",
        id: "forced-id",
        createdAt: "2000-01-01",
      });

      expect(prismaMock.constants_config.create).toHaveBeenCalledWith({
        data: { category: "role", value: "Installer" },
      });
    });

    it.each([
      ["category is missing", { value: "Installer" }],
      ["value is missing", { category: "role" }],
      ["category is empty", { category: "", value: "Installer" }],
      ["value is empty", { category: "role", value: "" }],
      ["value is null", { category: "role", value: null }],
      ["the body is empty", {}],
    ])("returns 400 when %s", async (_, body) => {
      const res = await post(body);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Category and value are required",
      });
      expect(prismaMock.constants_config.create).not.toHaveBeenCalled();
    });

    // Current behaviour: the check is a falsy test, so 0 and false are
    // rejected even though they are present.
    it.each([0, false])(
      "rejects the falsy value %j as missing",
      async (value) => {
        const res = await post({ category: "role", value });

        expect(res.status).toBe(400);
      },
    );

    // Current behaviour: no trimming, so whitespace-only values are saved.
    it("accepts a whitespace-only value", async () => {
      const res = await post({ category: "role", value: "   " });

      expect(res.status).toBe(201);
      expect(prismaMock.constants_config.create).toHaveBeenCalledWith({
        data: { category: "role", value: "   " },
      });
    });

    // Current behaviour: there is no duplicate check, so the same
    // category/value pair can be created repeatedly.
    it("does not check for an existing identical config", async () => {
      await post();

      expect(prismaMock.constants_config.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.constants_config.findUnique).not.toHaveBeenCalled();
    });

    it("returns 201 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await post();

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.status).toBe(true);
      expect(json.data.id).toBe("config-1");
      expect(json.warning).toBe("Note: Creation succeeded but logging failed");
    });

    it("returns 500 when the create fails", async () => {
      prismaMock.constants_config.create.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await post();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
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
      expect(prismaMock.constants_config.create).not.toHaveBeenCalled();
    });
  });
});
