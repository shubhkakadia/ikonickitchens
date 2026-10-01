import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthenticatedUser, VALID_TOKEN } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";

// Keep the real implementation but make it overridable per test.
vi.mock("@/lib/session-cleanup", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    cleanupSessionsAPI: vi.fn(actual.cleanupSessionsAPI),
  };
});

const route = await import("@/app/api/v1/admin/cleanup-sessions/route");
const { cleanupSessionsAPI } = await import("@/lib/session-cleanup");
const { POST } = route;

const URL = "/api/v1/admin/cleanup-sessions";
const post = (options) =>
  POST(buildRequest(URL, { method: "POST", ...options }));

describe("POST /api/v1/admin/cleanup-sessions", () => {
  beforeEach(() => {
    prismaMock.sessions.deleteMany.mockResolvedValue({ count: 0 });
  });

  describe("exports", () => {
    it("only exposes a POST handler", () => {
      expect(typeof route.POST).toBe("function");
      expect(route.GET).toBeUndefined();
      expect(route.PUT).toBeUndefined();
      expect(route.PATCH).toBeUndefined();
      expect(route.DELETE).toBeUndefined();
    });
  });

  describe("authentication", () => {
    it("returns 401 when the Authorization header is missing", async () => {
      const res = await post({ token: null });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        status: false,
        message: "No valid session token provided",
      });
      expect(prismaMock.sessions.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.sessions.deleteMany).not.toHaveBeenCalled();
    });

    it("returns 401 when the Authorization header is not a Bearer token", async () => {
      const res = await post({
        token: null,
        headers: { authorization: `Basic ${VALID_TOKEN}` },
      });

      expect(res.status).toBe(401);
      expect((await res.json()).message).toBe(
        "No valid session token provided",
      );
      expect(prismaMock.sessions.findFirst).not.toHaveBeenCalled();
    });

    // Headers are whitespace-trimmed, so "Bearer " arrives as "Bearer".
    it("returns 401 when the Bearer token is empty", async () => {
      const res = await post({
        token: null,
        headers: { authorization: "Bearer " },
      });

      expect(res.status).toBe(401);
      expect((await res.json()).message).toBe(
        "No valid session token provided",
      );
      expect(prismaMock.sessions.findFirst).not.toHaveBeenCalled();
    });

    it("returns 401 when the session does not exist or has expired", async () => {
      prismaMock.sessions.findFirst.mockResolvedValue(null);

      const res = await post({ token: "unknown-token" });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        status: false,
        message: "Invalid or expired session",
      });
      expect(prismaMock.sessions.findFirst).toHaveBeenCalledWith({
        where: {
          token: "unknown-token",
          expires_at: { gt: expect.any(Date) },
        },
      });
      expect(prismaMock.sessions.deleteMany).not.toHaveBeenCalled();
    });

    it("returns 401 and deletes the session when the user no longer exists", async () => {
      mockAuthenticatedUser("admin");
      prismaMock.users.findUnique.mockResolvedValue(null);

      const res = await post();

      expect(res.status).toBe(401);
      expect((await res.json()).message).toBe("Invalid or expired session");
      expect(prismaMock.sessions.delete).toHaveBeenCalledWith({
        where: { id: "session-1" },
      });
      expect(prismaMock.sessions.deleteMany).not.toHaveBeenCalled();
    });

    it("returns 401 and deletes the session when the user is inactive", async () => {
      mockAuthenticatedUser("admin", { is_active: false });

      const res = await post();

      expect(res.status).toBe(401);
      expect((await res.json()).message).toBe("Invalid or expired session");
      expect(prismaMock.sessions.delete).toHaveBeenCalledWith({
        where: { id: "session-1" },
      });
      expect(prismaMock.sessions.deleteMany).not.toHaveBeenCalled();
    });

    it("returns 401 when the session lookup throws", async () => {
      prismaMock.sessions.findFirst.mockRejectedValue(new Error("DB down"));

      const res = await post();

      expect(res.status).toBe(401);
      expect((await res.json()).message).toBe("Invalid or expired session");
      expect(prismaMock.sessions.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("authorization", () => {
    it.each(["manager", "user", "MANAGER", "", "master"])(
      "returns 403 for user type %j",
      async (userType) => {
        mockAuthenticatedUser(userType);

        const res = await post();

        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({
          status: false,
          message: "Insufficient permissions",
        });
        expect(prismaMock.sessions.deleteMany).not.toHaveBeenCalled();
      },
    );

    it.each(["admin", "master-admin", "ADMIN", "Master-Admin"])(
      "allows user type %j (case-insensitive)",
      async (userType) => {
        mockAuthenticatedUser(userType);

        const res = await post();

        expect(res.status).toBe(200);
        expect(prismaMock.sessions.deleteMany).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe("cleanup", () => {
    beforeEach(() => {
      mockAuthenticatedUser("admin");
    });

    it("deletes only sessions that expired before now and reports the count", async () => {
      prismaMock.sessions.deleteMany.mockResolvedValue({ count: 7 });
      const before = Date.now();

      const res = await post();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Successfully cleaned up 7 expired sessions",
        data: { cleanedCount: 7 },
      });

      expect(prismaMock.sessions.deleteMany).toHaveBeenCalledTimes(1);
      const { where } = prismaMock.sessions.deleteMany.mock.calls[0][0];
      expect(Object.keys(where)).toEqual(["expires_at"]);
      expect(where.expires_at.lt).toBeInstanceOf(Date);
      expect(where.expires_at.lt.getTime()).toBeGreaterThanOrEqual(before);
      expect(where.expires_at.lt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("reports zero when there are no expired sessions", async () => {
      prismaMock.sessions.deleteMany.mockResolvedValue({ count: 0 });

      const res = await post();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Successfully cleaned up 0 expired sessions",
        data: { cleanedCount: 0 },
      });
    });

    it("does not touch the caller's own session record", async () => {
      await post();

      expect(prismaMock.sessions.delete).not.toHaveBeenCalled();
    });

    // Current behaviour: cleanupExpiredSessions() swallows DB errors and
    // returns 0, so a failed cleanup is reported as a successful one.
    it("reports success with 0 cleaned when deleteMany throws (error swallowed)", async () => {
      prismaMock.sessions.deleteMany.mockRejectedValue(new Error("DB down"));

      const res = await post();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Successfully cleaned up 0 expired sessions",
        data: { cleanedCount: 0 },
      });
    });

    // Current behaviour: the route always responds 200, even when the
    // cleanup helper reports status: false.
    it("responds 200 with the helper's failure payload when cleanup reports failure", async () => {
      cleanupSessionsAPI.mockResolvedValueOnce({
        status: false,
        message: "Session cleanup failed",
        error: "boom",
      });

      const res = await post();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: false,
        message: "Session cleanup failed",
        error: "boom",
      });
    });

    it("returns 500 when the cleanup helper throws", async () => {
      cleanupSessionsAPI.mockRejectedValueOnce(new Error("unexpected"));

      const res = await post();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });

    it("passes the incoming request to the cleanup helper", async () => {
      const req = buildRequest(URL, { method: "POST" });

      await POST(req);

      expect(cleanupSessionsAPI).toHaveBeenCalledWith(req);
    });
  });
});
