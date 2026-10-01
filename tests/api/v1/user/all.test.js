// Tests for src/app/api/v1/user/all/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/user/all/route");

const get = (options) => GET(buildRequest("/api/v1/user/all", options));

const dbUser = (overrides = {}) => ({
  id: "u1",
  username: "ann",
  user_type: "manager",
  employee: { first_name: "Ann", last_name: "Lee" },
  ...overrides,
});

describe("GET /api/v1/user/all", () => {
  describeAuthorization(get, {
    modules: "calendar",
    setup: () => prismaMock.users.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.users.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.users.findMany.mockResolvedValue([dbUser()]);
    });

    it("returns the users with a display name", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Users fetched successfully",
        data: [
          { id: "u1", username: "ann", user_type: "manager", name: "Ann Lee" },
        ],
      });
    });

    it("only returns active users, sorted by username, and never selects the password", async () => {
      await get();

      expect(prismaMock.users.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        select: {
          id: true,
          username: true,
          user_type: true,
          employee: { select: { first_name: true, last_name: true } },
        },
        orderBy: { username: "asc" },
      });
    });

    it("falls back to the username for users without an employee record", async () => {
      prismaMock.users.findMany.mockResolvedValue([dbUser({ employee: null })]);

      const res = await get();

      expect((await res.json()).data[0].name).toBe("ann");
    });

    it.each([
      ["a missing last name", { first_name: "Ann", last_name: null }, "Ann"],
      ["a missing first name", { first_name: null, last_name: "Lee" }, "Lee"],
      ["no names at all", { first_name: null, last_name: null }, ""],
    ])("builds the name for %s", async (_, employee, expected) => {
      prismaMock.users.findMany.mockResolvedValue([dbUser({ employee })]);

      const res = await get();

      // Current behaviour: an employee with no names gives an empty name
      // rather than falling back to the username.
      expect((await res.json()).data[0].name).toBe(expected);
    });

    it("returns only the public fields", async () => {
      prismaMock.users.findMany.mockResolvedValue([
        dbUser({ password: "hash", extra: 1 }),
      ]);

      const res = await get();

      expect(Object.keys((await res.json()).data[0]).sort()).toEqual([
        "id",
        "name",
        "user_type",
        "username",
      ]);
    });

    it("returns an empty list when there are no active users", async () => {
      prismaMock.users.findMany.mockResolvedValue([]);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.users.findMany.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
