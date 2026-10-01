// Tests for src/app/api/v1/todo/assignees/route.js
import { describe, it, expect } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthorizedUser } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/todo/assignees/route");
const get = (options) =>
  GET(buildRequest("/api/v1/todo/assignees", { method: "GET", ...options }));

describe("GET /api/v1/todo/assignees", () => {
  describeAuthorization(get, {
    modules: "dashboard",
    setup: () => prismaMock.users.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.users.findMany],
  });

  it("lists active users with a display name, without the calendar module", async () => {
    mockAuthorizedUser({ userType: "manager", modules: ["dashboard"] });
    prismaMock.users.findMany.mockResolvedValue([
      { id: "u1", username: "ann", employee: { first_name: "Ann", last_name: "Lee" } },
      { id: "u2", username: "bob", employee: null },
    ]);
    const res = await get();
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toEqual([
      { id: "u1", username: "ann", name: "Ann Lee" },
      { id: "u2", username: "bob", name: "bob" },
    ]);
    expect(prismaMock.users.findMany.mock.calls[0][0].where).toEqual({
      is_active: true,
    });
  });
});
