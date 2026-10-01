// Tests for src/app/api/v1/signin/route.js
// (re-exports the handler from src/server/api/v1/auth/signin.js)
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { buildRequest } from "../../../helpers/request";

// Real bcrypt is slow and the route's dummy hash is not a valid hash, so use a
// stand-in that, like the real one, throws when given a non-string.
vi.mock("bcrypt", () => ({ default: { compare: vi.fn() } }));

const { POST } = await import("@/app/api/v1/signin/route");
const bcrypt = (await import("bcrypt")).default;

const URL = "/api/v1/signin";
const STORED_HASH =
  "$2b$10$storedhashstoredhashstoredhashstoredhashstoredhashst";
const DUMMY_HASH =
  "$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuv";

// The rate limiter keeps one in-memory counter per IP for the whole file, so
// every test uses its own address unless it is testing the limiter itself.
let ipCounter = 0;
const nextIp = () => `203.0.113.${++ipCounter}`;

const post = (
  body = { username: "ann", password: "secret-pw" },
  headers = {},
) =>
  POST(
    buildRequest(URL, {
      method: "POST",
      token: null,
      body,
      headers: { "x-forwarded-for": nextIp(), ...headers },
    }),
  );

const storedUser = (overrides = {}) => ({
  id: "user-1",
  username: "ann",
  password: STORED_HASH,
  user_type: "manager",
  is_active: true,
  is_verified: true,
  employee_id: "emp-1",
  ...overrides,
});

function mockSignin({ user = storedUser(), passwordOk = true } = {}) {
  prismaMock.users.findUnique.mockResolvedValue(user);
  prismaMock.sessions.create.mockImplementation(async ({ data }) => ({
    id: "session-1",
    ...data,
  }));
  bcrypt.compare.mockImplementation(async (password, hash) => {
    if (typeof password !== "string" || typeof hash !== "string") {
      throw new Error("data and hash arguments required");
    }
    return hash === STORED_HASH && passwordOk;
  });
}

describe("POST /api/v1/signin", () => {
  beforeEach(() => {
    mockSignin();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("successful sign in", () => {
    it("returns the user, a session token and the session id", async () => {
      const res = await post();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Login successful",
        data: {
          user: {
            id: "user-1",
            username: "ann",
            user_type: "manager",
            is_active: true,
            is_verified: true,
            employee_id: "emp-1",
          },
          token: expect.stringMatching(/^[0-9a-f]{64}$/),
          sessionId: "session-1",
        },
      });
    });

    it("never returns the password hash", async () => {
      const res = await post();

      const text = await res.text();
      expect(text).not.toContain(STORED_HASH);
      expect(text).not.toContain("password");
    });

    it("looks the user up by username, asking for the password hash", async () => {
      await post({ username: "ann", password: "secret-pw" });

      expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
        where: { username: "ann" },
        omit: { password: false },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith("secret-pw", STORED_HASH);
    });

    it("stores a session with the same token, valid for 30 days", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));

      const res = await post();

      const { token } = (await res.json()).data;
      expect(prismaMock.sessions.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          token,
          user_type: "manager",
          expires_at: new Date("2026-03-31T00:00:00.000Z"),
        },
      });
    });

    it("issues a different token on each sign in", async () => {
      const first = (await (await post()).json()).data.token;
      const second = (await (await post()).json()).data.token;

      expect(first).not.toBe(second);
    });

    it("includes rate limit headers", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));

      const res = await post();

      expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
      expect(res.headers.get("X-RateLimit-Reset")).toBe(
        "2026-03-01T00:15:00.000Z",
      );
    });
  });

  describe("failed sign in", () => {
    it("returns 401 for a wrong password", async () => {
      mockSignin({ passwordOk: false });

      const res = await post();

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        status: false,
        message: "Invalid username or password",
      });
      expect(prismaMock.sessions.create).not.toHaveBeenCalled();
    });

    it("returns the same 401 for an unknown username", async () => {
      mockSignin({ user: null });

      const res = await post();

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        status: false,
        message: "Invalid username or password",
      });
      expect(prismaMock.sessions.create).not.toHaveBeenCalled();
    });

    it("still runs a bcrypt comparison for an unknown username (timing)", async () => {
      mockSignin({ user: null });

      await post({ username: "ghost", password: "secret-pw" });

      expect(bcrypt.compare).toHaveBeenCalledOnce();
      expect(bcrypt.compare).toHaveBeenCalledWith("secret-pw", DUMMY_HASH);
    });

    it("returns 403 for an inactive account", async () => {
      mockSignin({ user: storedUser({ is_active: false }) });

      const res = await post();

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
        status: false,
        message: "User account is not active",
      });
      expect(prismaMock.sessions.create).not.toHaveBeenCalled();
    });

    // Current behaviour: the inactive check runs before the result of the
    // password check is used, so anyone can learn that an account exists and
    // is inactive without knowing its password.
    it("reports an inactive account even when the password is wrong", async () => {
      mockSignin({ user: storedUser({ is_active: false }), passwordOk: false });

      const res = await post();

      expect(res.status).toBe(403);
    });

    it.each([
      ["a wrong password", { passwordOk: false }],
      ["an inactive account", { user: storedUser({ is_active: false }) }],
    ])("includes rate limit headers on a failure from %s", async (_, setup) => {
      mockSignin(setup);

      const res = await post();

      expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
    });
  });

  describe("bad requests", () => {
    // Current behaviour: no validation. A missing password makes bcrypt throw.
    it("returns 500 when the password is missing", async () => {
      const res = await post({ username: "ann" });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.sessions.create).not.toHaveBeenCalled();
    });

    it("returns 500 for a malformed JSON body", async () => {
      const res = await POST(
        buildRequest(URL, {
          method: "POST",
          token: null,
          rawBody: "{not json",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": nextIp(),
          },
        }),
      );

      expect(res.status).toBe(500);
      expect(prismaMock.users.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("failures", () => {
    it("returns 500 when the user lookup fails", async () => {
      prismaMock.users.findUnique.mockRejectedValue(new Error("DB down"));

      const res = await post();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });

    it("returns 500 when the session cannot be stored", async () => {
      prismaMock.sessions.create.mockRejectedValue(new Error("DB down"));

      const res = await post();

      expect(res.status).toBe(500);
    });

    it("does not send rate limit headers on a 500", async () => {
      prismaMock.users.findUnique.mockRejectedValue(new Error("DB down"));

      const res = await post();

      expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
    });
  });

  describe("rate limiting", () => {
    const attempt = (ip, body) => post(body, { "x-forwarded-for": ip });

    it("allows five attempts per IP and blocks the sixth with 429", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
      const ip = nextIp();

      const remaining = [];
      for (let i = 0; i < 5; i += 1) {
        const res = await attempt(ip);
        expect(res.status).toBe(200);
        remaining.push(res.headers.get("X-RateLimit-Remaining"));
      }
      const blocked = await attempt(ip);

      expect(remaining).toEqual(["4", "3", "2", "1", "0"]);
      expect(blocked.status).toBe(429);
      expect(await blocked.json()).toEqual({
        status: false,
        message: "Too many signin attempts, please try again later.",
        retryAfter: 900,
      });
      expect(blocked.headers.get("Retry-After")).toBe("900");
      expect(blocked.headers.get("X-RateLimit-Limit")).toBe("5");
      expect(blocked.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(blocked.headers.get("X-RateLimit-Reset")).toBe(
        "2026-03-01T00:15:00.000Z",
      );
    });

    it("does not touch the database or bcrypt once blocked", async () => {
      const ip = nextIp();
      for (let i = 0; i < 5; i += 1) await attempt(ip);
      prismaMock.users.findUnique.mockClear();
      bcrypt.compare.mockClear();

      await attempt(ip);

      expect(prismaMock.users.findUnique).not.toHaveBeenCalled();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it("counts failed attempts too", async () => {
      mockSignin({ passwordOk: false });
      const ip = nextIp();

      for (let i = 0; i < 5; i += 1) {
        expect((await attempt(ip)).status).toBe(401);
      }
      mockSignin();

      // even the correct password is now refused
      expect((await attempt(ip)).status).toBe(429);
    });

    it("checks the limit before reading the body", async () => {
      const ip = nextIp();
      for (let i = 0; i < 5; i += 1) await attempt(ip);

      const res = await POST(
        buildRequest(URL, {
          method: "POST",
          token: null,
          rawBody: "{not json",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": ip,
          },
        }),
      );

      expect(res.status).toBe(429);
    });

    it("tracks each IP separately", async () => {
      const blockedIp = nextIp();
      for (let i = 0; i < 6; i += 1) await attempt(blockedIp);

      const res = await attempt(nextIp());

      expect(res.status).toBe(200);
    });

    it("uses the first address in x-forwarded-for", async () => {
      const client = nextIp();
      for (let i = 0; i < 5; i += 1) {
        await attempt(`${client}, 10.9.9.${i}`);
      }

      const res = await attempt(`${client}, 10.9.9.99`);

      expect(res.status).toBe(429);
    });

    it("falls back to x-real-ip when there is no x-forwarded-for", async () => {
      const ip = nextIp();
      const viaRealIp = () =>
        POST(
          buildRequest(URL, {
            method: "POST",
            token: null,
            body: { username: "ann", password: "secret-pw" },
            headers: { "x-real-ip": ip },
          }),
        );
      for (let i = 0; i < 5; i += 1) await viaRealIp();

      expect((await viaRealIp()).status).toBe(429);
    });

    // Current behaviour: requests with no IP headers all share one bucket, so
    // five of them lock out every other header-less caller.
    it("puts callers with no IP headers in one shared bucket", async () => {
      const anonymous = () =>
        POST(
          buildRequest(URL, {
            method: "POST",
            token: null,
            body: { username: "ann", password: "secret-pw" },
          }),
        );
      for (let i = 0; i < 5; i += 1) await anonymous();

      expect((await anonymous()).status).toBe(429);
    });

    it("lets the caller back in once the window has passed", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
      const ip = nextIp();
      for (let i = 0; i < 6; i += 1) await attempt(ip);
      expect((await attempt(ip)).status).toBe(429);

      vi.setSystemTime(new Date("2026-03-01T00:15:01.000Z"));
      const res = await attempt(ip);

      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
    });

    it("reports the remaining wait in retryAfter", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
      const ip = nextIp();
      for (let i = 0; i < 5; i += 1) await attempt(ip);

      vi.setSystemTime(new Date("2026-03-01T00:10:00.000Z"));
      const blocked = await attempt(ip);

      expect((await blocked.json()).retryAfter).toBe(300);
    });
  });
});
