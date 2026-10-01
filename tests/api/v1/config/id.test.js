// Tests for src/app/api/v1/config/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET, PATCH, DELETE } = await import("@/app/api/v1/config/[id]/route");

const ID = "config-1";
const URL = `/api/v1/config/${ID}`;
const ctx = () => routeContext({ id: ID });

const storedConfig = (overrides = {}) => ({
  id: ID,
  category: "role",
  value: "Installer",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("GET /api/v1/config/[id]", () => {
  const get = (options) => GET(buildRequest(URL, options), ctx());

  describeAuthorization(get, {
    modules: "config",
    setup: () =>
      prismaMock.constants_config.findUnique.mockResolvedValue(storedConfig()),
    untouched: () => [prismaMock.constants_config.findUnique],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("returns the config", async () => {
      prismaMock.constants_config.findUnique.mockResolvedValue(storedConfig());

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Config fetched successfully",
        data: storedConfig(),
      });
      expect(prismaMock.constants_config.findUnique).toHaveBeenCalledWith({
        where: { id: ID },
      });
    });

    it("returns 404 when the config does not exist", async () => {
      prismaMock.constants_config.findUnique.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Config not found",
      });
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.constants_config.findUnique.mockRejectedValue(
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

describe("PATCH /api/v1/config/[id]", () => {
  const patch = (body = { value: "Lead Installer" }, options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());

  function mockUpdate() {
    prismaMock.constants_config.findUnique.mockResolvedValue(storedConfig());
    prismaMock.constants_config.update.mockImplementation(async ({ data }) =>
      storedConfig(data),
    );
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization((options) => patch(undefined, options), {
    modules: "config",
    setup: mockUpdate,
    untouched: () => [prismaMock.constants_config.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    it("updates both fields and logs the update", async () => {
      const res = await patch({ category: "position", value: "Lead" });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Config updated successfully",
        data: storedConfig({ category: "position", value: "Lead" }),
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.constants_config.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { category: "position", value: "Lead" },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "constants_config",
          entity_id: ID,
          action: "UPDATE",
          description: "Config updated successfully: position",
        },
      });
    });

    it("updates only the value when only value is sent", async () => {
      await patch({ value: "Lead Installer" });

      expect(prismaMock.constants_config.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { value: "Lead Installer" },
      });
    });

    it("updates only the category when only category is sent", async () => {
      await patch({ category: "position" });

      expect(prismaMock.constants_config.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { category: "position" },
      });
    });

    it("ignores fields other than category and value", async () => {
      await patch({ value: "Lead", id: "other-id", createdAt: "2000-01-01" });

      expect(prismaMock.constants_config.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { value: "Lead" },
      });
    });

    it.each([
      ["the body is empty", {}],
      ["only unknown fields are sent", { foo: "bar" }],
    ])("returns 400 when %s", async (_, body) => {
      const res = await patch(body);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "No fields to update",
      });
      expect(prismaMock.constants_config.update).not.toHaveBeenCalled();
    });

    // Current behaviour: unlike create, PATCH does not reject empty values.
    it("allows setting value to an empty string", async () => {
      const res = await patch({ value: "" });

      expect(res.status).toBe(200);
      expect(prismaMock.constants_config.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { value: "" },
      });
    });

    // Current behaviour: null is passed to Prisma; both columns are required,
    // so the real database would reject it and the route would return 500.
    it("passes null values through to the update", async () => {
      await patch({ category: null });

      expect(prismaMock.constants_config.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { category: null },
      });
    });

    it("returns 404 when the config does not exist", async () => {
      prismaMock.constants_config.findUnique.mockResolvedValue(null);

      const res = await patch();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Config not found",
      });
      expect(prismaMock.constants_config.update).not.toHaveBeenCalled();
    });

    it("checks existence before validating the fields", async () => {
      prismaMock.constants_config.findUnique.mockResolvedValue(null);

      const res = await patch({});

      expect(res.status).toBe(404);
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await patch();

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Update succeeded but logging failed",
      );
    });

    it("returns 500 when the update fails", async () => {
      prismaMock.constants_config.update.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await patch();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 500 for a malformed JSON body", async () => {
      const res = await PATCH(
        buildRequest(URL, {
          method: "PATCH",
          rawBody: "{not json",
          headers: { "content-type": "application/json" },
        }),
        ctx(),
      );

      expect(res.status).toBe(500);
      expect(prismaMock.constants_config.update).not.toHaveBeenCalled();
    });
  });
});

describe("DELETE /api/v1/config/[id]", () => {
  const del = (options) =>
    DELETE(buildRequest(URL, { method: "DELETE", ...options }), ctx());

  function mockDelete() {
    prismaMock.constants_config.findUnique.mockResolvedValue(storedConfig());
    prismaMock.constants_config.delete.mockResolvedValue(storedConfig());
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization(del, {
    modules: "config",
    setup: mockDelete,
    untouched: () => [prismaMock.constants_config.delete],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    // Note: constants_config has no is_deleted column, so this is a hard
    // delete (unlike clients, which are soft deleted).
    it("deletes the config and logs the deletion", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Config deleted successfully",
        data: storedConfig(),
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.constants_config.delete).toHaveBeenCalledWith({
        where: { id: ID },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "constants_config",
          entity_id: ID,
          action: "DELETE",
          description: "Config deleted successfully: role",
        },
      });
    });

    it("returns 404 when the config does not exist", async () => {
      prismaMock.constants_config.findUnique.mockResolvedValue(null);

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Config not found",
      });
      expect(prismaMock.constants_config.delete).not.toHaveBeenCalled();
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Config deleted successfully",
        data: storedConfig(),
        warning: "Note: Deletion succeeded but logging failed",
      });
    });

    // e.g. the row was removed between the existence check and the delete
    it("returns 500 when the delete fails", async () => {
      prismaMock.constants_config.delete.mockRejectedValue(
        Object.assign(new Error("Record to delete does not exist."), {
          code: "P2025",
        }),
      );

      const res = await del();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });
  });
});
