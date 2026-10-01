import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { prismaMock } from "../../../helpers/prismaMock";
import { VALID_TOKEN } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";

vi.mock("@/lib/db", async () => {
  const { prismaMock } = await import("../../../helpers/prismaMock");
  return { prisma: prismaMock, default: prismaMock };
});

const mediaRoute = await import("@/app/mediauploads/[...path]/route");
const lotsRoute = await import("@/app/api/v1/uploads/lots/[...path]/route");

// A real file on disk so the stat/stream path is exercised
const TEST_DIR = path.join(process.cwd(), "mediauploads", "__vitest__");
const SEGMENTS = ["__vitest__", "doc.pdf"];
const REL_URL = "mediauploads/__vitest__/doc.pdf";
const CONTENT = "0123456789";
fs.mkdirSync(TEST_DIR, { recursive: true });
fs.writeFileSync(path.join(TEST_DIR, "doc.pdf"), CONTENT);
afterAll(() => fs.rmSync(TEST_DIR, { recursive: true, force: true }));

function mockSession(userType = "admin", employeeId = "employee-1") {
  prismaMock.sessions.findUnique.mockResolvedValue({
    token: VALID_TOKEN,
    expires_at: new Date(Date.now() + 60 * 60 * 1000),
    user: {
      id: "user-1",
      user_type: userType,
      is_active: true,
      employee_id: employeeId,
      module_access: {},
    },
  });
}

function cookieRequest(url, token = VALID_TOKEN) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    headers: { cookie: `auth_token=${token}` },
  });
}

const routes = [
  [
    "/mediauploads/[...path]",
    mediaRoute.GET,
    `/mediauploads/${SEGMENTS.join("/")}`,
  ],
  [
    "/api/v1/uploads/lots/[...path]",
    lotsRoute.GET,
    `/api/v1/uploads/lots/${SEGMENTS.join("/")}`,
  ],
];

describe.each(routes)("GET %s", (_name, GET, url) => {
  const call = (req, segments = SEGMENTS) =>
    GET(req, { params: Promise.resolve({ path: segments }) });

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.lot_file.findFirst.mockResolvedValue(null);
    prismaMock.media.findFirst.mockResolvedValue(null);
    prismaMock.supplier_file.findFirst.mockResolvedValue(null);
  });

  it("returns 401 without a token or cookie", async () => {
    const res = await call(buildRequest(url, { token: null }));
    expect(res.status).toBe(401);
    expect(prismaMock.media.findFirst).not.toHaveBeenCalled();
  });

  it("returns 401 for an unknown session", async () => {
    prismaMock.sessions.findUnique.mockResolvedValue(null);
    const res = await call(cookieRequest(url, "bogus"));
    expect(res.status).toBe(401);
  });

  it("serves a file owned by a live media record, authenticated by cookie", async () => {
    mockSession();
    prismaMock.media.findFirst.mockResolvedValue({ id: "m1" });
    const res = await call(cookieRequest(url));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(CONTENT);
    expect(res.headers.get("cache-control")).toBe("private, max-age=300");
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(prismaMock.media.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { url: REL_URL, is_deleted: false } }),
    );
  });

  it("serves a supplier file with a Bearer header", async () => {
    mockSession();
    prismaMock.supplier_file.findFirst.mockResolvedValue({ id: "s1" });
    const res = await call(buildRequest(url));
    expect(res.status).toBe(200);
  });

  it("returns 404 when no live record owns the file (unknown or soft-deleted)", async () => {
    mockSession();
    const res = await call(buildRequest(url));
    expect(res.status).toBe(404);
  });

  it("rejects path traversal", async () => {
    mockSession();
    prismaMock.media.findFirst.mockResolvedValue({ id: "m1" });
    const res = await call(buildRequest(url), ["..", "package.json"]);
    expect(res.status).toBe(404);
  });

  it("supports byte ranges", async () => {
    mockSession();
    prismaMock.media.findFirst.mockResolvedValue({ id: "m1" });
    const res = await call(
      buildRequest(url, { headers: { range: "bytes=2-5" } }),
    );
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(
      `bytes 2-5/${CONTENT.length}`,
    );
    expect(await res.text()).toBe("2345");
  });

  it("returns 416 for an unsatisfiable range", async () => {
    mockSession();
    prismaMock.media.findFirst.mockResolvedValue({ id: "m1" });
    const res = await call(
      buildRequest(url, { headers: { range: "bytes=50-60" } }),
    );
    expect(res.status).toBe(416);
  });

  describe("employee users", () => {
    it("can read lot files on lots they install", async () => {
      mockSession("employee", "emp-7");
      prismaMock.lot_file.findFirst.mockResolvedValue({
        tab: { lot: { installer_id: "emp-7" } },
      });
      const res = await call(buildRequest(url));
      expect(res.status).toBe(200);
    });

    it("cannot read lot files on other lots", async () => {
      mockSession("employee", "emp-7");
      prismaMock.lot_file.findFirst.mockResolvedValue({
        tab: { lot: { installer_id: "emp-8" } },
      });
      const res = await call(buildRequest(url));
      expect(res.status).toBe(404);
    });

    it("cannot read non-lot files such as supplier statements", async () => {
      mockSession("employee", "emp-7");
      prismaMock.supplier_file.findFirst.mockResolvedValue({ id: "s1" });
      const res = await call(buildRequest(url));
      expect(res.status).toBe(404);
    });
  });
});
