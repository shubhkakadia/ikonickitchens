// Tests for src/app/api/v1/signout/route.js
// (re-exports the handler from src/server/api/v1/auth/signout.js)
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { VALID_TOKEN } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";

const { POST } = await import("@/app/api/v1/signout/route");

const post = (options = {}) =>
  POST(buildRequest("/api/v1/signout", { method: "POST", ...options }));

const SESSION = { id: "session-1", token: VALID_TOKEN };

describe("POST /api/v1/signout", () => {
  beforeEach(() => {
    prismaMock.sessions.findUnique.mockResolvedValue(SESSION);
    prismaMock.push_tokens.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.sessions.delete.mockResolvedValue(SESSION);
  });

  it("deletes the session for the bearer token", async () => {
    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: true,
      message: "Logout successful",
    });
    expect(prismaMock.sessions.delete).toHaveBeenCalledWith({
      where: { id: "session-1" },
    });
  });

  it("only removes the session that matches the token", async () => {
    await post({ token: "token-abc" });

    expect(prismaMock.sessions.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.sessions.findUnique).toHaveBeenCalledWith({
      where: { token: "token-abc" },
    });
    expect(prismaMock.sessions.delete).toHaveBeenCalledTimes(1);
  });

  it("disables the push tokens bound to the session", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));

    await post();

    expect(prismaMock.push_tokens.updateMany).toHaveBeenCalledWith({
      where: { session_id: "session-1" },
      data: {
        enabled: false,
        session_id: null,
        disabled_at: new Date("2026-03-01T00:00:00.000Z"),
        disabled_reason: "signed_out",
      },
    });
    vi.useRealTimers();
  });

  it("runs the push token update and session delete in one transaction", async () => {
    await post();

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.$transaction.mock.calls[0][0]).toHaveLength(2);
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
      expect(prismaMock.sessions.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.sessions.delete).not.toHaveBeenCalled();
    });

    it.each([
      ["a Basic scheme", `Basic ${VALID_TOKEN}`],
      ["no scheme", VALID_TOKEN],
      ["a lowercase bearer scheme", `bearer ${VALID_TOKEN}`],
    ])("returns 401 for %s", async (_, authorization) => {
      const res = await post({ token: null, headers: { authorization } });

      expect(res.status).toBe(401);
      expect(prismaMock.sessions.delete).not.toHaveBeenCalled();
    });

    // Header values are trimmed, so "Bearer " arrives as "Bearer" and fails
    // the "Bearer " prefix check.
    it("returns 401 for a bearer scheme with no token", async () => {
      const res = await post({
        token: null,
        headers: { authorization: "Bearer " },
      });

      expect(res.status).toBe(401);
      expect(prismaMock.sessions.delete).not.toHaveBeenCalled();
    });
  });

  describe("unknown sessions", () => {
    it.each([
      ["unknown", "nope"],
      ["already signed out or expired", VALID_TOKEN],
    ])("returns 404 when the token is %s", async (_, token) => {
      prismaMock.sessions.findUnique.mockResolvedValue(null);

      const res = await post({ token });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Session not found or already expired",
      });
      expect(prismaMock.sessions.delete).not.toHaveBeenCalled();
      expect(prismaMock.push_tokens.updateMany).not.toHaveBeenCalled();
    });

    it("is not repeatable: a second sign out with the same token returns 404", async () => {
      prismaMock.sessions.findUnique
        .mockResolvedValueOnce(SESSION)
        .mockResolvedValueOnce(null);

      expect((await post()).status).toBe(200);
      expect((await post()).status).toBe(404);
    });
  });

  // Current behaviour: the session's expiry is not checked, so an expired but
  // still stored session can be signed out (it is simply deleted).
  it("deletes a session regardless of its expiry", async () => {
    prismaMock.sessions.findUnique.mockResolvedValue({
      ...SESSION,
      expires_at: new Date("2000-01-01T00:00:00.000Z"),
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(prismaMock.sessions.delete).toHaveBeenCalled();
    expect(prismaMock.sessions.findFirst).not.toHaveBeenCalled();
  });

  it("returns 500 when the session lookup fails", async () => {
    prismaMock.sessions.findUnique.mockRejectedValue(new Error("DB down"));

    const res = await post();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      status: false,
      message: "Internal server error",
    });
  });

  it("returns 500 when the transaction fails", async () => {
    prismaMock.sessions.delete.mockRejectedValue(new Error("DB down"));

    const res = await post();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      status: false,
      message: "Internal server error",
    });
  });
});
