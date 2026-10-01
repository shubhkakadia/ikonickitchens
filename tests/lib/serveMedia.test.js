// Tests for the response headers set by src/lib/serveMedia.js
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { prismaMock } from "../helpers/prismaMock";
import { mockMasterAdmin } from "../helpers/auth";
import { buildRequest } from "../helpers/request";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "serve-test-"));
let serveMediaFile;

beforeAll(async () => {
  // MEDIA_ROOT is computed at import time, so point cwd at the temp dir first
  vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  fs.mkdirSync(path.join(tmpRoot, "mediauploads"));
  const files = {
    "plan.svg":
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    "page.html": "<script>alert(1)</script>",
    "photo.png": "png",
    "doc.pdf": "%PDF-1.4",
    "clip.mp4": "0123456789",
  };
  for (const [name, data] of Object.entries(files)) {
    fs.writeFileSync(path.join(tmpRoot, "mediauploads", name), data);
  }
  ({ serveMediaFile } = await import("@/lib/serveMedia"));
  vi.restoreAllMocks();
});

afterAll(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

beforeEach(() => {
  mockMasterAdmin();
  prismaMock.lot_file.findFirst.mockResolvedValue(null);
  prismaMock.supplier_file.findFirst.mockResolvedValue(null);
  prismaMock.media.findFirst.mockResolvedValue({ id: "m-1" });
});

const get = async (name, query = "", headers = {}) => {
  const res = await serveMediaFile(
    buildRequest(`/api/v1/mediauploads/${name}${query}`, {
      method: "GET",
      headers,
    }),
    [name],
  );
  const text = await res.text();
  return Object.assign(res, { bodyText: text });
};

describe("serveMediaFile headers", () => {
  it.each(["plan.svg", "page.html"])(
    "forces %s to download and never serves it as markup",
    async (name) => {
      const res = await get(name);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/octet-stream");
      expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("content-security-policy")).toBe(
        "default-src 'none'; sandbox",
      );
    },
  );

  it.each(["photo.png", "clip.mp4"])(
    "serves %s inline under a sandbox CSP",
    async (name) => {
      const res = await get(name);
      expect(res.headers.get("content-disposition")).toBe("inline");
      expect(res.headers.get("content-security-policy")).toBe(
        "default-src 'none'; sandbox",
      );
    },
  );

  it("serves PDFs inline without the sandbox CSP", async () => {
    const res = await get("doc.pdf");
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe("inline");
    expect(res.headers.get("content-security-policy")).toBeNull();
  });

  it("honours ?download=true for safe types", async () => {
    const res = await get("photo.png", "?download=true");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
  });
});

describe("serveMediaFile streaming and Range", () => {
  it("advertises byte ranges and the full length on a normal request", async () => {
    const res = await get("clip.mp4");
    expect(res.status).toBe(200);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-length")).toBe("10");
    expect(res.bodyText).toBe("0123456789");
  });

  it.each([
    ["bytes=2-5", "2345", "bytes 2-5/10"],
    ["bytes=7-", "789", "bytes 7-9/10"],
    ["bytes=-3", "789", "bytes 7-9/10"],
    ["bytes=5-999", "56789", "bytes 5-9/10"],
  ])(
    "serves %s as 206 with only those bytes",
    async (range, body, contentRange) => {
      const res = await get("clip.mp4", "", { range });
      expect(res.status).toBe(206);
      expect(res.bodyText).toBe(body);
      expect(res.headers.get("content-range")).toBe(contentRange);
      expect(res.headers.get("content-length")).toBe(String(body.length));
    },
  );

  it.each(["bytes=20-30", "bytes=5-2", "bytes=-0", "items=0-1", "bytes=a-b"])(
    "returns 416 for the unsatisfiable range %s",
    async (range) => {
      const res = await get("clip.mp4", "", { range });
      expect(res.status).toBe(416);
      expect(res.headers.get("content-range")).toBe("bytes */10");
    },
  );
});
