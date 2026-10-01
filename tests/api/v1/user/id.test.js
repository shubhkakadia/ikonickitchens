// Tests for src/app/api/v1/user/[id]/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthorizedUser, mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, formBody, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";
import { MODULE_ACCESS_KEYS } from "@/lib/userAccounts";

// Real bcrypt is slow; recognisable fakes are enough to check what is stored.
vi.mock("bcrypt", () => ({ default: { compare: vi.fn(), hash: vi.fn() } }));

const { GET, PATCH, DELETE } = await import("@/app/api/v1/user/[id]/route");
const bcrypt = (await import("bcrypt")).default;

const ALL_ROLES = ["master-admin", "admin", "manager", "employee"];
const SELF_ID = "user-1"; // the id the auth helpers give the signed-in user
const OTHER_ID = "user-2";
const SESSION_ID = "session-1"; // the signed-in user's own session

const url = (id) => `/api/v1/user/${id}`;
const ctx = (id) => routeContext({ id });

const publicUser = (id = SELF_ID, overrides = {}) => ({
  id,
  username: "ann.lee.smith",
  user_type: "manager",
  is_active: true,
  employee_id: "emp-1",
  ...overrides,
});

describe("GET /api/v1/user/[id]", () => {
  const get = (id = SELF_ID, options) =>
    GET(buildRequest(url(id), options), ctx(id));

  // (no return value: beforeEach would treat a returned function as teardown)
  const mockFetch = () => {
    prismaMock.users.findUnique.mockImplementation(async ({ where }) =>
      publicUser(where.id),
    );
  };

  describeAuthorization((options) => get(SELF_ID, options), {
    roles: ALL_ROLES,
    setup: mockFetch,
    untouched: () => [prismaMock.users.findUnique],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockFetch();
    });

    it.each(["admin", "manager", "employee"])(
      "lets a %s read their own record",
      async (userType) => {
        mockAuthorizedUser({ userType });

        const res = await get(SELF_ID);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "User fetched successfully",
          data: publicUser(SELF_ID),
        });
      },
    );

    it.each(["admin", "manager", "employee"])(
      "returns 403 when a %s reads someone else's record",
      async (userType) => {
        mockAuthorizedUser({ userType });

        const res = await get(OTHER_ID);

        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({
          status: false,
          message: "Insufficient permissions",
        });
        expect(prismaMock.users.findUnique).not.toHaveBeenCalled();
      },
    );

    it("lets a master-admin read anyone", async () => {
      mockMasterAdmin();

      const res = await get(OTHER_ID);

      expect(res.status).toBe(200);
      expect((await res.json()).data.id).toBe(OTHER_ID);
    });

    it("omits the password and includes the employee, image and module access", async () => {
      mockMasterAdmin();

      await get();

      expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
        where: { id: SELF_ID },
        omit: { password: true },
        include: {
          employee: { include: { image: true } },
          module_access: true,
        },
      });
    });

    it("returns 404 when the user does not exist", async () => {
      mockMasterAdmin();
      prismaMock.users.findUnique.mockResolvedValue(null);

      const res = await get(OTHER_ID);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "User not found",
      });
    });

    it("returns 500 when the query fails", async () => {
      mockMasterAdmin();
      prismaMock.users.findUnique.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal Server Error",
      });
    });
  });
});

describe("PATCH /api/v1/user/[id]", () => {
  const patch = (body = {}, options = {}, id = SELF_ID) =>
    PATCH(
      buildRequest(url(id), { method: "PATCH", body, ...options }),
      ctx(id),
    );
  const patchForm = (fields, id = SELF_ID) =>
    PATCH(
      buildRequest(url(id), { method: "PATCH", body: formBody(fields) }),
      ctx(id),
    );

  const storedUser = (overrides = {}) => ({
    id: SELF_ID,
    username: "ann.lee.smith",
    password: "hashed:old-password",
    user_type: "manager",
    is_active: true,
    module_access: { calendar: true, logs: false },
    ...overrides,
  });

  function mockUpdate({ existing = storedUser() } = {}) {
    prismaMock.users.findUnique.mockResolvedValue(existing);
    prismaMock.users.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      username: "ann.lee.smith",
      user_type: data.user_type ?? existing?.user_type,
      is_active: data.is_active ?? existing?.is_active,
      employee: { first_name: "Ann", last_name: "Lee" },
    }));
    prismaMock.module_access.upsert.mockImplementation(async ({ update }) => ({
      id: "access-1",
      ...existing?.module_access,
      ...update,
    }));
    prismaMock.sessions.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.logs.create.mockResolvedValue({});
    bcrypt.compare.mockImplementation(
      async (password, hash) => hash === `hashed:${password}`,
    );
    bcrypt.hash.mockImplementation(async (password) => `hashed:${password}`);
  }

  const updateArgs = () => prismaMock.users.update.mock.calls[0][0];

  // The matrix edits the caller's own record with an empty (no-change) body
  describeAuthorization((options) => patch({}, options), {
    roles: ALL_ROLES,
    setup: () => mockUpdate(),
    untouched: () => [prismaMock.users.findUnique, prismaMock.users.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    describe("who may edit", () => {
      it.each(["admin", "manager", "employee"])(
        "returns 403 when a %s edits someone else",
        async (userType) => {
          mockAuthorizedUser({ userType });

          const res = await patch({ is_active: false }, {}, OTHER_ID);

          expect(res.status).toBe(403);
          expect(await res.json()).toEqual({
            status: false,
            message: "Insufficient permissions",
          });
          expect(prismaMock.users.findUnique).not.toHaveBeenCalled();
        },
      );

      it.each(["admin", "manager", "employee"])(
        "lets a %s edit their own record",
        async (userType) => {
          mockAuthorizedUser({ userType });
          mockUpdate();

          const res = await patch({});

          expect(res.status).toBe(200);
        },
      );

      it("lets a master-admin edit anyone", async () => {
        mockUpdate({ existing: storedUser({ id: OTHER_ID }) });

        const res = await patch({ is_active: false }, {}, OTHER_ID);

        expect(res.status).toBe(200);
      });

      it("returns 404 when the user does not exist", async () => {
        mockUpdate({ existing: null });

        const res = await patch({}, {}, OTHER_ID);

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "User not found",
        });
        expect(prismaMock.users.update).not.toHaveBeenCalled();
      });

      it("looks the user up with the password hash and module access", async () => {
        await patch({}, {}, OTHER_ID);

        expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
          where: { id: OTHER_ID },
          omit: { password: false },
          include: { module_access: true },
        });
      });
    });

    describe("updating role and status", () => {
      beforeEach(() => {
        mockUpdate({ existing: storedUser({ id: OTHER_ID }) });
      });

      it("changes the role, lowercasing it, and logs the update", async () => {
        const res = await patch({ user_type: "ADMIN" }, {}, OTHER_ID);

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.message).toBe("User updated successfully");
        expect(json.warning).toBeUndefined();
        expect(updateArgs()).toEqual({
          where: { id: OTHER_ID },
          omit: { password: true },
          data: {
            user_type: "admin",
            is_active: undefined,
            password: undefined,
          },
          include: {
            employee: { select: { first_name: true, last_name: true } },
          },
        });
        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: {
            user_id: "user-1",
            entity_type: "user",
            entity_id: OTHER_ID,
            action: "UPDATE",
            description: "User updated successfully: Ann Lee",
          },
        });
      });

      it.each([
        [true, true],
        ["true", true],
        [false, false],
        ["false", false],
        ["yes", false],
      ])("sets is_active from %j", async (input, expected) => {
        mockUpdate({
          existing: storedUser({ id: OTHER_ID, is_active: !expected }),
        });

        await patch({ is_active: input }, {}, OTHER_ID);

        expect(updateArgs().data.is_active).toBe(expected);
      });

      it("leaves role and status out of the update when they do not change", async () => {
        await patch({ user_type: "Manager", is_active: true }, {}, OTHER_ID);

        expect(updateArgs().data).toEqual({
          user_type: undefined,
          is_active: undefined,
          password: undefined,
        });
        expect(prismaMock.sessions.deleteMany).not.toHaveBeenCalled();
      });

      it("returns 400 for an unknown role", async () => {
        const res = await patch({ user_type: "superuser" }, {}, OTHER_ID);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Invalid user type",
        });
        expect(prismaMock.users.update).not.toHaveBeenCalled();
      });

      it("runs in a transaction", async () => {
        await patch({ user_type: "admin" }, {}, OTHER_ID);

        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
      });
    });

    describe("module access", () => {
      beforeEach(() => {
        mockUpdate({ existing: storedUser({ id: OTHER_ID }) });
      });

      it("upserts the changed flags and returns the new module access", async () => {
        const res = await patch(
          { module_access: { logs: true } },
          {},
          OTHER_ID,
        );

        expect(prismaMock.module_access.upsert).toHaveBeenCalledWith({
          where: { user_id: OTHER_ID },
          update: { logs: true },
          create: { user_id: OTHER_ID, logs: true },
        });
        expect((await res.json()).data.module_access).toMatchObject({
          calendar: true,
          logs: true,
        });
      });

      it("only touches the flags that are sent", async () => {
        await patch({ module_access: { dashboard: true } }, {}, OTHER_ID);

        expect(prismaMock.module_access.upsert.mock.calls[0][0].update).toEqual(
          {
            dashboard: true,
          },
        );
      });

      it("ignores unknown keys", async () => {
        await patch(
          { module_access: { logs: true, bogus: true, user_id: "x" } },
          {},
          OTHER_ID,
        );

        expect(prismaMock.module_access.upsert.mock.calls[0][0].update).toEqual(
          {
            logs: true,
          },
        );
      });

      it("does not write when the flags already have those values", async () => {
        await patch(
          { module_access: { calendar: true, logs: false } },
          {},
          OTHER_ID,
        );

        expect(prismaMock.module_access.upsert).not.toHaveBeenCalled();
      });

      it("returns the existing module access when it did not change", async () => {
        const res = await patch(
          { module_access: { calendar: true } },
          {},
          OTHER_ID,
        );

        expect((await res.json()).data.module_access).toEqual({
          calendar: true,
          logs: false,
        });
      });

      it.each([
        ["omitted", undefined],
        ["null", null],
      ])(
        "leaves module access alone when it is %s",
        async (_, module_access) => {
          await patch({ module_access }, {}, OTHER_ID);

          expect(prismaMock.module_access.upsert).not.toHaveBeenCalled();
        },
      );

      it("creates the module access when the user has none", async () => {
        mockUpdate({
          existing: storedUser({ id: OTHER_ID, module_access: null }),
        });

        await patch({ module_access: { calendar: false } }, {}, OTHER_ID);

        expect(prismaMock.module_access.upsert).toHaveBeenCalledOnce();
      });

      it("accepts every known flag", async () => {
        const all = Object.fromEntries(
          MODULE_ACCESS_KEYS.map((k) => [k, true]),
        );

        await patch({ module_access: all }, {}, OTHER_ID);

        expect(prismaMock.module_access.upsert.mock.calls[0][0].update).toEqual(
          all,
        );
      });

      it("does not end any sessions for a permissions-only change", async () => {
        await patch({ module_access: { logs: true } }, {}, OTHER_ID);

        expect(prismaMock.sessions.deleteMany).not.toHaveBeenCalled();
      });
    });

    describe("form data requests", () => {
      beforeEach(() => {
        mockUpdate({ existing: storedUser({ id: OTHER_ID }) });
      });

      it("reads fields from a multipart form", async () => {
        const res = await patchForm(
          { user_type: "admin", is_active: "false" },
          OTHER_ID,
        );

        expect(res.status).toBe(200);
        expect(updateArgs().data).toMatchObject({
          user_type: "admin",
          is_active: false,
        });
      });

      it("parses module_access sent as a JSON string", async () => {
        await patchForm(
          { module_access: JSON.stringify({ logs: true }) },
          OTHER_ID,
        );

        expect(prismaMock.module_access.upsert.mock.calls[0][0].update).toEqual(
          {
            logs: true,
          },
        );
      });

      it("returns 400 for module_access that is not valid JSON", async () => {
        const res = await patchForm({ module_access: "{not json" }, OTHER_ID);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Invalid module access",
        });
        expect(prismaMock.users.update).not.toHaveBeenCalled();
      });
    });

    describe("changing your own record", () => {
      beforeEach(() => {
        mockUpdate();
      });

      it.each([
        ["role", { user_type: "admin" }],
        ["status", { is_active: false }],
        ["permissions", { module_access: { logs: true } }],
      ])("returns 403 when you change your own %s", async (_, body) => {
        const res = await patch(body);

        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({
          status: false,
          message: "You cannot change your own role, status or permissions",
        });
        expect(prismaMock.users.update).not.toHaveBeenCalled();
      });

      it("applies to master-admins too", async () => {
        mockMasterAdmin();

        const res = await patch({ user_type: "admin" });

        expect(res.status).toBe(403);
      });

      it("allows sending your current role, status and permissions unchanged", async () => {
        const res = await patch({
          user_type: "MANAGER",
          is_active: true,
          module_access: { calendar: true, logs: false },
        });

        expect(res.status).toBe(200);
      });
    });

    describe("changing a password", () => {
      describe("for someone else (master-admin)", () => {
        beforeEach(() => {
          mockUpdate({ existing: storedUser({ id: OTHER_ID }) });
        });

        it("hashes and stores the new password without needing the old one", async () => {
          const res = await patch(
            { password: "brand-new-password" },
            {},
            OTHER_ID,
          );

          expect(res.status).toBe(200);
          expect(bcrypt.hash).toHaveBeenCalledWith("brand-new-password", 10);
          expect(bcrypt.compare).not.toHaveBeenCalled();
          expect(updateArgs().data.password).toBe("hashed:brand-new-password");
        });

        it("ends all of that user's sessions", async () => {
          await patch({ password: "brand-new-password" }, {}, OTHER_ID);

          expect(prismaMock.sessions.deleteMany).toHaveBeenCalledWith({
            where: { user_id: OTHER_ID },
          });
        });

        it("returns 400 for a weak password", async () => {
          const res = await patch({ password: "short" }, {}, OTHER_ID);

          expect(res.status).toBe(400);
          expect(await res.json()).toEqual({
            status: false,
            message: "Password must be at least 8 characters",
          });
          expect(bcrypt.hash).not.toHaveBeenCalled();
        });

        it("returns 400 when the password matches the username", async () => {
          const res = await patch({ password: "Ann.Lee.Smith" }, {}, OTHER_ID);

          expect(res.status).toBe(400);
          expect((await res.json()).message).toBe(
            "Password must not be the same as the username",
          );
        });

        it.each([
          ["an empty string", ""],
          ["only spaces", "     "],
          ["not a string", 12345678],
          ["null", null],
        ])("ignores a password that is %s", async (_, password) => {
          const res = await patch({ password }, {}, OTHER_ID);

          expect(res.status).toBe(200);
          expect(bcrypt.hash).not.toHaveBeenCalled();
          expect(updateArgs().data.password).toBeUndefined();
        });
      });

      describe("for yourself", () => {
        const body = (overrides = {}) => ({
          password: "brand-new-password",
          old_password: "old-password",
          ...overrides,
        });

        it("checks the current password, then stores the new hash", async () => {
          const res = await patch(body());

          expect(res.status).toBe(200);
          expect(bcrypt.compare).toHaveBeenCalledWith(
            "old-password",
            "hashed:old-password",
          );
          expect(updateArgs().data.password).toBe("hashed:brand-new-password");
        });

        it("ends your other sessions but keeps the current one", async () => {
          await patch(body());

          expect(prismaMock.sessions.deleteMany).toHaveBeenCalledWith({
            where: { user_id: SELF_ID, NOT: { id: SESSION_ID } },
          });
        });

        it("returns 400 when the current password is missing", async () => {
          const res = await patch(body({ old_password: undefined }));

          expect(res.status).toBe(400);
          expect(await res.json()).toEqual({
            status: false,
            message: "Current password is required",
          });
          expect(prismaMock.users.update).not.toHaveBeenCalled();
        });

        it("returns 401 when the current password is wrong", async () => {
          const res = await patch(body({ old_password: "wrong" }));

          expect(res.status).toBe(401);
          expect(await res.json()).toEqual({
            status: false,
            message: "Current password is incorrect",
          });
          expect(bcrypt.hash).not.toHaveBeenCalled();
          expect(prismaMock.users.update).not.toHaveBeenCalled();
        });

        it("checks the current password before the strength of the new one", async () => {
          const res = await patch(
            body({ old_password: "wrong", password: "x" }),
          );

          expect(res.status).toBe(401);
        });

        it("returns 400 for a weak new password", async () => {
          const res = await patch(body({ password: "short" }));

          expect(res.status).toBe(400);
          expect(bcrypt.hash).not.toHaveBeenCalled();
        });

        it("does not ask for the current password when no new one is sent", async () => {
          const res = await patch({});

          expect(res.status).toBe(200);
          expect(bcrypt.compare).not.toHaveBeenCalled();
        });
      });
    });

    describe("ending sessions", () => {
      beforeEach(() => {
        mockUpdate({ existing: storedUser({ id: OTHER_ID }) });
      });

      it.each([
        ["a role change", { user_type: "admin" }],
        ["a status change", { is_active: false }],
        ["a password change", { password: "brand-new-password" }],
      ])("ends the user's sessions after %s", async (_, body) => {
        await patch(body, {}, OTHER_ID);

        expect(prismaMock.sessions.deleteMany).toHaveBeenCalledWith({
          where: { user_id: OTHER_ID },
        });
      });

      it("does nothing to sessions when only unchanged values are sent", async () => {
        await patch({ is_active: true }, {}, OTHER_ID);

        expect(prismaMock.sessions.deleteMany).not.toHaveBeenCalled();
      });
    });

    describe("failures", () => {
      it("returns 200 with a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await patch({});

        expect(res.status).toBe(200);
        expect((await res.json()).warning).toBe(
          "Note: Update succeeded but logging failed",
        );
      });

      // Current behaviour: a user with no employee record is logged as
      // "undefined undefined".
      it("logs undefined names for a user without an employee record", async () => {
        prismaMock.users.update.mockImplementation(async ({ where }) => ({
          id: where.id,
          employee: null,
        }));

        await patch({});

        expect(prismaMock.logs.create.mock.calls[0][0].data.description).toBe(
          "User updated successfully: undefined undefined",
        );
      });

      it("returns 500 'User not updated' when the transaction fails", async () => {
        prismaMock.users.update.mockRejectedValue(new Error("DB down"));

        const res = await patch({});

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "User not updated",
        });
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 when the lookup fails", async () => {
        prismaMock.users.findUnique.mockRejectedValue(new Error("DB down"));

        const res = await patch({});

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal Server Error",
        });
      });

      it("returns 500 for a malformed JSON body", async () => {
        const res = await PATCH(
          buildRequest(url(SELF_ID), {
            method: "PATCH",
            rawBody: "{not json",
            headers: { "content-type": "application/json" },
          }),
          ctx(SELF_ID),
        );

        expect(res.status).toBe(500);
        expect(prismaMock.users.update).not.toHaveBeenCalled();
      });
    });
  });
});

describe("DELETE /api/v1/user/[id]", () => {
  const del = (id = OTHER_ID, options) =>
    DELETE(buildRequest(url(id), { method: "DELETE", ...options }), ctx(id));

  const stored = (id = OTHER_ID, overrides = {}) => ({
    id,
    username: "bob",
    is_active: true,
    employee_id: "EMP-2",
    employee: { first_name: "Bob", last_name: "Ray" },
    ...overrides,
  });

  function mockDelete(existing = stored()) {
    prismaMock.users.findUnique.mockResolvedValue(existing);
    prismaMock.users.update.mockImplementation(async ({ where, data }) => ({
      ...(existing ?? stored(where.id)),
      ...data,
    }));
    prismaMock.sessions.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization((options) => del(OTHER_ID, options), {
    roles: ["master-admin"],
    setup: () => mockDelete(),
    untouched: () => [prismaMock.users.update, prismaMock.users.delete],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    it("deactivates the user instead of deleting it, and logs it", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe(true);
      expect(json.message).toBe("User deleted successfully");
      expect(json.data).toMatchObject({
        id: OTHER_ID,
        is_active: false,
        employee_id: null,
      });
      expect(json.warning).toBeUndefined();
      // the row stays: every log entry points at it
      expect(prismaMock.users.delete).not.toHaveBeenCalled();
      expect(prismaMock.users.update).toHaveBeenCalledWith({
        where: { id: OTHER_ID },
        data: { is_active: false, employee_id: null },
        omit: { password: true },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "user",
          entity_id: OTHER_ID,
          action: "DELETE",
          description:
            "User deleted (deactivated, kept for the audit trail): Bob Ray",
        },
      });
    });

    it("never selects the password hash", async () => {
      await del();

      expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
        where: { id: OTHER_ID },
        omit: { password: true },
        include: {
          employee: { select: { first_name: true, last_name: true } },
        },
      });
    });

    it("revokes every session of the user, in the same transaction", async () => {
      await del();

      expect(prismaMock.$transaction).toHaveBeenCalledOnce();
      expect(prismaMock.sessions.deleteMany).toHaveBeenCalledWith({
        where: { user_id: OTHER_ID },
      });
      expect(
        prismaMock.sessions.deleteMany.mock.invocationCallOrder[0],
      ).toBeLessThan(prismaMock.users.update.mock.invocationCallOrder[0]);
    });

    it("releases the employee link so a new account can be created for them", async () => {
      await del();

      expect(
        prismaMock.users.update.mock.calls[0][0].data.employee_id,
      ).toBeNull();
    });

    it("keeps the signed-in session when removing your own account", async () => {
      mockDelete(stored(SELF_ID));

      const res = await del(SELF_ID);

      expect(res.status).toBe(200);
      expect(prismaMock.sessions.deleteMany).toHaveBeenCalledWith({
        where: { user_id: SELF_ID, NOT: { id: "session-1" } },
      });
      // so the log entry can still be attributed
      expect(prismaMock.logs.create).toHaveBeenCalled();
    });

    it("is a no-op when the account was already removed", async () => {
      mockDelete(stored(OTHER_ID, { is_active: false, employee_id: null }));

      const res = await del();

      expect(res.status).toBe(200);
      expect((await res.json()).message).toBe(
        "User account is already removed",
      );
      expect(prismaMock.users.update).not.toHaveBeenCalled();
      expect(prismaMock.sessions.deleteMany).not.toHaveBeenCalled();
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("also removes an inactive account that is still linked to an employee", async () => {
      mockDelete(stored(OTHER_ID, { is_active: false }));

      await del();

      expect(prismaMock.users.update).toHaveBeenCalledOnce();
    });

    it("returns 404 when the user does not exist", async () => {
      prismaMock.users.findUnique.mockResolvedValue(null);

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "User not found",
      });
      expect(prismaMock.users.update).not.toHaveBeenCalled();
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Deletion succeeded but logging failed",
      );
    });

    it("returns 500 when the update fails", async () => {
      prismaMock.users.update.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal Server Error",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });
  });
});
