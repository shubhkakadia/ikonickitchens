// Tests for src/app/api/v1/signout/route.js
// (re-exports the handler from src/server/api/v1/auth/signout.js)
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { VALID_TOKEN } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";

const { POST } = await import("@/app/api/v1/signout/route");

const post = (options = {}) =>
  POST(buildRequest("/api/v1/signout", { method: "POST", ...options }));

describe("POST /api/v1/signout", () => {
  beforeEach(() => {
    prismaMock.sessions.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("deletes the session for the bearer token", async () => {
    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: true,
      message: "Logout successful",
    });
    expect(prismaMock.sessions.deleteMany).toHaveBeenCalledWith({
      where: { token: VALID_TOKEN },
    });
  });

  it("only removes the session that matches the token", async () => {
    await post({ token: "token-abc" });

    expect(prismaMock.sessions.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.sessions.deleteMany).toHaveBeenCalledWith({
      where: { token: "token-abc" },
    });
  });

  it("needs no body", async () => {
    const res = await post({ body: undefined });

    expect(res.status).toBe(200);
  });

  describe("missing or malformed credentials", () => {
    it("returns 401 when the Authorization header is missing", async () => {
      const res = await post({ token: null });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        status: false,
        message: "No valid session token provided",
      });
      expect(prismaMock.sessions.deleteMany).not.toHaveBeenCalled();
    });

    it.each([
      ["a Basic scheme", `Basic ${VALID_TOKEN}`],
      ["no scheme", VALID_TOKEN],
      ["a lowercase bearer scheme", `bearer ${VALID_TOKEN}`],
    ])("returns 401 for %s", async (_, authorization) => {
      const res = await post({ token: null, headers: { authorization } });

      expect(res.status).toBe(401);
      expect(prismaMock.sessions.deleteMany).not.toHaveBeenCalled();
    });

    // Header values are trimmed, so "Bearer " arrives as "Bearer" and fails
    // the "Bearer " prefix check.
    it("returns 401 for a bearer scheme with no token", async () => {
      const res = await post({
        token: null,
        headers: { authorization: "Bearer " },
      });

      expect(res.status).toBe(401);
      expect(prismaMock.sessions.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("unknown sessions", () => {
    it.each([
      ["unknown", "nope"],
      ["already signed out or expired", VALID_TOKEN],
    ])("returns 404 when the token is %s", async (_, token) => {
      prismaMock.sessions.deleteMany.mockResolvedValue({ count: 0 });

      const res = await post({ token });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Session not found or already expired",
      });
    });

    it("is not repeatable: a second sign out with the same token returns 404", async () => {
      prismaMock.sessions.deleteMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      expect((await post()).status).toBe(200);
      expect((await post()).status).toBe(404);
    });
  });

  // Current behaviour: no session validation, so an expired but still stored
  // session can be signed out (it is simply deleted).
  it("deletes a session regardless of its expiry", async () => {
    const res = await post();

    expect(res.status).toBe(200);
    expect(prismaMock.sessions.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.sessions.findFirst).not.toHaveBeenCalled();
  });

  it("returns 500 when the delete fails", async () => {
    prismaMock.sessions.deleteMany.mockRejectedValue(new Error("DB down"));

    const res = await post();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      status: false,
      message: "Internal server error",
    });
  });
});
