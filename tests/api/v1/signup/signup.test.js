// Tests for src/app/api/v1/signup/route.js
// (re-exports the handler from src/server/api/v1/auth/signup.js)
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";
import { MODULE_ACCESS_KEYS, MIN_PASSWORD_LENGTH } from "@/lib/userAccounts";

// Real bcrypt is slow; a recognisable fake hash is enough to check what is stored.
vi.mock("bcrypt", () => ({ default: { hash: vi.fn() } }));

const { POST } = await import("@/app/api/v1/signup/route");
const bcrypt = (await import("bcrypt")).default;

const URL = "/api/v1/signup";
const validBody = (overrides = {}) => ({
  username: "ann.lee",
  password: "correct-horse",
  user_type: "manager",
  ...overrides,
});
const post = (body = validBody(), options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

const allFlags = (value) =>
  Object.fromEntries(MODULE_ACCESS_KEYS.map((key) => [key, value]));

function mockSignup() {
  bcrypt.hash.mockImplementation(async (password) => `hashed:${password}`);
  prismaMock.users.findUnique.mockResolvedValue(null);
  prismaMock.employees.findUnique.mockResolvedValue({ employee_id: "emp-1" });
  prismaMock.users.create.mockImplementation(async ({ data }) => ({
    id: "user-new",
    username: data.username,
    user_type: data.user_type,
    is_active: data.is_active,
    employee_id: data.employee_id,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  }));
  prismaMock.module_access.create.mockImplementation(async ({ data }) => ({
    id: "access-1",
    ...data,
  }));
  prismaMock.logs.create.mockResolvedValue({});
}

const userData = () => prismaMock.users.create.mock.calls[0][0].data;
const accessData = () => prismaMock.module_access.create.mock.calls[0][0].data;

describe("POST /api/v1/signup", () => {
  describeAuthorization((options) => post(undefined, options), {
    roles: ["master-admin"],
    setup: mockSignup,
    untouched: () => [
      prismaMock.users.create,
      prismaMock.$transaction,
      bcrypt.hash,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockSignup();
    });

    describe("creating a user", () => {
      it("creates the user and their module access, and logs it", async () => {
        const res = await post(
          validBody({ is_active: true, module_access: { calendar: true } }),
        );

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.status).toBe(true);
        expect(json.message).toBe("User created successfully");
        expect(json.warning).toBeUndefined();
        expect(json.data.user).toEqual({
          id: "user-new",
          username: "ann.lee",
          user_type: "manager",
          is_active: true,
          employee_id: null,
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
        });
        expect(json.data.module_access).toMatchObject({
          user_id: "user-new",
          calendar: true,
          logs: false,
        });
        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: {
            user_id: "user-1",
            entity_type: "user",
            entity_id: "user-new",
            action: "CREATE",
            description: "User created successfully: ann.lee",
          },
        });
      });

      it("stores a bcrypt hash (cost 10), never the plain password", async () => {
        await post();

        expect(bcrypt.hash).toHaveBeenCalledWith("correct-horse", 10);
        expect(userData().password).toBe("hashed:correct-horse");
      });

      it("never returns the password, and does not select it", async () => {
        const res = await post();

        expect(await res.text()).not.toContain("password");
        expect(prismaMock.users.create.mock.calls[0][0].select).toEqual({
          id: true,
          username: true,
          user_type: true,
          is_active: true,
          employee_id: true,
          createdAt: true,
          updatedAt: true,
        });
      });

      it("creates the user and module access in one transaction", async () => {
        await post();

        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
      });

      it("trims the username", async () => {
        await post(validBody({ username: "  ann.lee  " }));

        expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
          where: { username: "ann.lee" },
        });
        expect(userData().username).toBe("ann.lee");
      });

      it.each(["master-admin", "admin", "manager", "employee"])(
        "accepts user type %s",
        async (user_type) => {
          const res = await post(validBody({ user_type }));

          expect(res.status).toBe(201);
          expect(userData().user_type).toBe(user_type);
        },
      );

      // Current behaviour: accounts are inactive unless is_active is sent.
      it.each([
        ["omitted", undefined, false],
        ["true", true, true],
        ['"true"', "true", true],
        ["false", false, false],
        ['"yes"', "yes", false],
        ["1", 1, false],
      ])("sets is_active from %s", async (_, input, expected) => {
        await post(validBody({ is_active: input }));

        expect(userData().is_active).toBe(expected);
      });
    });

    describe("module access", () => {
      it("defaults every flag to false", async () => {
        await post();

        expect(accessData()).toEqual({
          user_id: "user-new",
          ...allFlags(false),
        });
      });

      it("grants only the flags that are sent", async () => {
        await post(
          validBody({ module_access: { dashboard: true, logs: "true" } }),
        );

        expect(accessData()).toEqual({
          user_id: "user-new",
          ...allFlags(false),
          dashboard: true,
          logs: true,
        });
      });

      it("ignores unknown keys, including user_id", async () => {
        await post(
          validBody({
            module_access: {
              calendar: true,
              user_id: "someone-else",
              bogus: true,
            },
          }),
        );

        expect(accessData().user_id).toBe("user-new");
        expect(accessData()).not.toHaveProperty("bogus");
      });

      it.each([
        ["null", null],
        ["a string", "all"],
      ])("treats module_access as empty when it is %s", async (_, value) => {
        const res = await post(validBody({ module_access: value }));

        expect(res.status).toBe(201);
        expect(accessData()).toEqual({
          user_id: "user-new",
          ...allFlags(false),
        });
      });
    });

    describe("employee link", () => {
      it("links an existing, unlinked employee", async () => {
        const res = await post(validBody({ employee_id: "emp-1" }));

        expect(res.status).toBe(201);
        expect(prismaMock.employees.findUnique).toHaveBeenCalledWith({
          where: { employee_id: "emp-1" },
        });
        expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
          where: { employee_id: "emp-1" },
        });
        expect(userData().employee_id).toBe("emp-1");
      });

      it.each([
        ["omitted", undefined],
        ["null", null],
        ["empty", ""],
        ["blank", "   "],
      ])(
        "creates an unlinked user when employee_id is %s",
        async (_, employee_id) => {
          await post(validBody({ employee_id }));

          expect(prismaMock.employees.findUnique).not.toHaveBeenCalled();
          expect(userData().employee_id).toBeNull();
        },
      );

      it("returns 400 when the employee does not exist", async () => {
        prismaMock.employees.findUnique.mockResolvedValue(null);

        const res = await post(validBody({ employee_id: "ghost" }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Employee ID does not exist. Please provide a valid employee ID or leave it empty.",
        });
        expect(prismaMock.users.create).not.toHaveBeenCalled();
      });

      it("returns 409 when the employee is already linked to a user", async () => {
        prismaMock.users.findUnique.mockImplementation(async ({ where }) =>
          where.employee_id ? { id: "other-user" } : null,
        );

        const res = await post(validBody({ employee_id: "emp-1" }));

        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
          status: false,
          message: "Employee ID is already linked to another user",
        });
        expect(prismaMock.users.create).not.toHaveBeenCalled();
      });

      it.each([
        ["a number", 42],
        ["an object", { id: "x" }],
        ["an array", ["emp-1"]],
      ])("returns 400 when employee_id is %s", async (_, employee_id) => {
        const res = await post(validBody({ employee_id }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Invalid employee ID",
        });
      });
    });

    describe("validation", () => {
      it.each([
        ["missing", undefined],
        ["empty", ""],
        ["blank", "   "],
        ["not a string", 123],
        ["null", null],
      ])("returns 400 when the username is %s", async (_, username) => {
        const res = await post(validBody({ username }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Username is required",
        });
        expect(prismaMock.users.findUnique).not.toHaveBeenCalled();
      });

      it.each([
        ["missing", undefined],
        ["not a string", 12345678],
        ["too short", "a".repeat(MIN_PASSWORD_LENGTH - 1)],
      ])("returns 400 when the password is %s", async (_, password) => {
        const res = await post(validBody({ password }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        });
        expect(bcrypt.hash).not.toHaveBeenCalled();
      });

      it("accepts a password of exactly the minimum length", async () => {
        const res = await post(
          validBody({ password: "a".repeat(MIN_PASSWORD_LENGTH) }),
        );

        expect(res.status).toBe(201);
      });

      it.each(["ann.lee.smith", "ANN.LEE.SMITH", "Ann.Lee.Smith"])(
        "returns 400 when the password matches the username (%s)",
        async (password) => {
          const res = await post(
            validBody({ username: "ann.lee.smith", password }),
          );

          expect(res.status).toBe(400);
          expect(await res.json()).toEqual({
            status: false,
            message: "Password must not be the same as the username",
          });
        },
      );

      it.each([
        ["missing", undefined],
        ["unknown", "superuser"],
        ["differently cased", "Manager"],
        ["upper cased", "MASTER-ADMIN"],
      ])("returns 400 when the user type is %s", async (_, user_type) => {
        const res = await post(validBody({ user_type }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Invalid user type",
        });
        expect(prismaMock.users.create).not.toHaveBeenCalled();
      });

      it("checks the username, then password, then user type", async () => {
        const res = await post({
          username: "",
          password: "x",
          user_type: "bad",
        });

        expect((await res.json()).message).toBe("Username is required");
      });

      it("returns 409 when the username already exists", async () => {
        prismaMock.users.findUnique.mockResolvedValue({ id: "other" });

        const res = await post();

        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
          status: false,
          message: "Username already exists",
        });
        expect(bcrypt.hash).not.toHaveBeenCalled();
        expect(prismaMock.users.create).not.toHaveBeenCalled();
      });
    });

    describe("failures", () => {
      it("returns 201 with a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await post();

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.warning).toBe(
          "Note: Creation succeeded but logging failed",
        );
        expect(json.data.user.id).toBe("user-new");
      });

      it("returns 500 when the user cannot be created", async () => {
        prismaMock.users.create.mockRejectedValue(
          Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
          }),
        );

        const res = await post();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error while creating user or module access",
        });
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 when module access cannot be created", async () => {
        prismaMock.module_access.create.mockRejectedValue(new Error("DB down"));

        const res = await post();

        expect(res.status).toBe(500);
        expect((await res.json()).message).toBe(
          "Internal server error while creating user or module access",
        );
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 when the username lookup fails", async () => {
        prismaMock.users.findUnique.mockRejectedValue(new Error("DB down"));

        const res = await post();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
      });

      it("returns 500 when hashing fails", async () => {
        bcrypt.hash.mockRejectedValue(new Error("bcrypt down"));

        const res = await post();

        expect(res.status).toBe(500);
        expect(prismaMock.users.create).not.toHaveBeenCalled();
      });

      it("returns 500 for a malformed JSON body", async () => {
        const res = await POST(
          buildRequest(URL, {
            method: "POST",
            rawBody: "{not json",
            headers: { "content-type": "application/json" },
          }),
        );

        expect(res.status).toBe(500);
        expect(prismaMock.users.create).not.toHaveBeenCalled();
      });
    });
  });
});
