// Tests for src/app/api/v1/module_access/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthorizedUser, mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";
import { MODULE_ACCESS_KEYS } from "@/lib/userAccounts";

const { GET, PATCH } = await import("@/app/api/v1/module_access/[id]/route");

const ALL_ROLES = ["master-admin", "admin", "manager", "employee"];
const SELF_ID = "user-1"; // the id the auth helpers give the signed-in user
const OTHER_ID = "user-2";

const storedAccess = (userId = SELF_ID, overrides = {}) => ({
  id: "access-1",
  user_id: userId,
  dashboard: true,
  calendar: false,
  ...overrides,
});

describe("GET /api/v1/module_access/[id]", () => {
  const get = (id = SELF_ID, options) =>
    GET(
      buildRequest(`/api/v1/module_access/${id}`, options),
      routeContext({ id }),
    );

  // Matrix runs against the caller's own id, which every role may read.
  describeAuthorization((options) => get(SELF_ID, options), {
    roles: ALL_ROLES,
    setup: () =>
      prismaMock.module_access.findUnique.mockResolvedValue(storedAccess()),
    untouched: () => [prismaMock.module_access.findUnique],
  });

  describe("handler", () => {
    beforeEach(() => {
      prismaMock.module_access.findUnique.mockImplementation(
        async ({ where }) => storedAccess(where.user_id),
      );
    });

    it.each(["admin", "manager", "employee"])(
      "lets a %s read their own permissions",
      async (userType) => {
        mockAuthorizedUser({ userType });

        const res = await get(SELF_ID);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "Module access fetched successfully",
          data: storedAccess(SELF_ID),
        });
        expect(prismaMock.module_access.findUnique).toHaveBeenCalledWith({
          where: { user_id: SELF_ID },
        });
      },
    );

    it.each(["admin", "manager", "employee"])(
      "returns 403 when a %s reads someone else's permissions",
      async (userType) => {
        mockAuthorizedUser({ userType });

        const res = await get(OTHER_ID);

        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({
          status: false,
          message: "Insufficient permissions",
        });
        expect(prismaMock.module_access.findUnique).not.toHaveBeenCalled();
      },
    );

    it("lets a master-admin read anyone's permissions", async () => {
      mockMasterAdmin();

      const res = await get(OTHER_ID);

      expect(res.status).toBe(200);
      expect((await res.json()).data.user_id).toBe(OTHER_ID);
      expect(prismaMock.module_access.findUnique).toHaveBeenCalledWith({
        where: { user_id: OTHER_ID },
      });
    });

    // Current behaviour: a user with no module_access row is not a 404.
    it("returns 200 with null data when there is no record", async () => {
      mockMasterAdmin();
      prismaMock.module_access.findUnique.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toBeNull();
    });

    it("returns 500 when the query fails", async () => {
      mockMasterAdmin();
      prismaMock.module_access.findUnique.mockRejectedValue(
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

describe("PATCH /api/v1/module_access/[id]", () => {
  const patch = (body = { calendar: true }, options = {}) =>
    PATCH(
      buildRequest(`/api/v1/module_access/${OTHER_ID}`, {
        method: "PATCH",
        body,
        ...options,
      }),
      routeContext({ id: OTHER_ID }),
    );

  function mockUpdate() {
    prismaMock.module_access.update.mockImplementation(
      async ({ where, data }) => storedAccess(where.user_id, data),
    );
    prismaMock.logs.create.mockResolvedValue({});
  }

  const updateData = () =>
    prismaMock.module_access.update.mock.calls[0][0].data;

  describeAuthorization((options) => patch(undefined, options), {
    roles: ["master-admin"],
    setup: mockUpdate,
    untouched: () => [prismaMock.module_access.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    it("updates the flags and logs the update", async () => {
      const res = await patch({ calendar: true, logs: false });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Module access updated successfully",
        data: storedAccess(OTHER_ID, { calendar: true, logs: false }),
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.module_access.update).toHaveBeenCalledWith({
        where: { user_id: OTHER_ID },
        data: { calendar: true, logs: false },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "module_access",
          entity_id: OTHER_ID,
          action: "UPDATE",
          description: `Module access updated successfully: ${OTHER_ID}`,
        },
      });
    });

    it("leaves omitted flags out of the update", async () => {
      await patch({ dashboard: true });

      expect(updateData()).toEqual({ dashboard: true });
    });

    it("accepts every known flag", async () => {
      const all = Object.fromEntries(MODULE_ACCESS_KEYS.map((k) => [k, true]));

      await patch(all);

      expect(updateData()).toEqual(all);
    });

    it("ignores unknown keys, including ids and the owner", async () => {
      await patch({
        calendar: true,
        id: "forced",
        user_id: "someone-else",
        user_type: "master-admin",
        not_a_flag: true,
      });

      expect(updateData()).toEqual({ calendar: true });
      expect(prismaMock.module_access.update.mock.calls[0][0].where).toEqual({
        user_id: OTHER_ID,
      });
    });

    it.each([
      [true, true],
      ["true", true],
      [false, false],
      ["false", false],
      [1, false],
      ["yes", false],
      [null, false],
    ])("coerces %j to %s", async (input, expected) => {
      await patch({ calendar: input });

      expect(updateData()).toEqual({ calendar: expected });
    });

    it.each([
      ["an empty object", {}],
      ["a null body", null],
      ["an array", []],
    ])("sends an empty update for %s", async (_, body) => {
      const res = await patch(body);

      expect(res.status).toBe(200);
      expect(updateData()).toEqual({});
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await patch();

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Update succeeded but logging failed",
      );
    });

    // Current behaviour: no existence check, so a user with no module_access
    // row (Prisma P2025) is a 500 rather than a 404.
    it("returns 500 when the update fails", async () => {
      prismaMock.module_access.update.mockRejectedValue(
        Object.assign(new Error("Record to update not found."), {
          code: "P2025",
        }),
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
        buildRequest(`/api/v1/module_access/${OTHER_ID}`, {
          method: "PATCH",
          rawBody: "{not json",
          headers: { "content-type": "application/json" },
        }),
        routeContext({ id: OTHER_ID }),
      );

      expect(res.status).toBe(500);
      expect(prismaMock.module_access.update).not.toHaveBeenCalled();
    });
  });
});
