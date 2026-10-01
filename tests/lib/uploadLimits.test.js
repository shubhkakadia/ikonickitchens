// Tests for the upload size limits in src/lib/fileHandler.js
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { NextRequest } from "next/server";

vi.mock("@/lib/scanFile", () => ({
  scanFile: async () => ({ clean: true }),
}));

const {
  readFormData,
  uploadFile,
  uploadLimitResponse,
  UploadLimitError,
  validateMultipartRequest,
} = await import("@/lib/fileHandler");

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "limits-test-"));
beforeEach(() => {
  vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
});
afterEach(() => {
  fs.rmSync(path.join(tmpRoot, "mediauploads"), {
    recursive: true,
    force: true,
  });
});
afterAll(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

// Builds a multipart request. `declaredLength: null` omits Content-Length,
// like a chunked upload; a number overrides it.
async function multipart(bytes, { declaredLength } = {}) {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], "a.bin"));
  const probe = new Response(form);
  const body = new Uint8Array(await probe.arrayBuffer());
  const headers = { "content-type": probe.headers.get("content-type") };
  if (declaredLength !== null) {
    headers["content-length"] = String(declaredLength ?? body.length);
  }
  return new NextRequest("http://localhost:3000/x", {
    method: "POST",
    headers,
    body,
  });
}

describe("readFormData", () => {
  it("parses a body under the limit", async () => {
    const form = await readFormData(await multipart(1000), 10_000);
    expect(form.get("file")).toBeInstanceOf(File);
  });

  it("rejects when Content-Length declares more than the limit", async () => {
    const req = await multipart(1000, { declaredLength: 50_000 });
    await expect(readFormData(req, 10_000)).rejects.toBeInstanceOf(
      UploadLimitError,
    );
  });

  it("rejects an oversized body that has no or understated Content-Length", async () => {
    for (const declaredLength of [null, 100]) {
      const req = await multipart(50_000, { declaredLength });
      await expect(readFormData(req, 10_000)).rejects.toBeInstanceOf(
        UploadLimitError,
      );
    }
  });

  it("validateMultipartRequest lets the limit error through unwrapped", async () => {
    const req = await multipart(50_000);
    await expect(validateMultipartRequest(req, 10_000)).rejects.toBeInstanceOf(
      UploadLimitError,
    );
  });
});

describe("uploadLimitResponse", () => {
  it("maps UploadLimitError to a 413 and ignores other errors", async () => {
    const res = uploadLimitResponse(new UploadLimitError("too big"));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ status: false, message: "too big" });
    expect(uploadLimitResponse(new Error("x"))).toBeNull();
  });
});

describe("uploadFile limits", () => {
  const pdf = (extra = 0) =>
    new File(["%PDF-1.4 " + "x".repeat(extra)], "doc.pdf", {
      type: "application/pdf",
    });

  it("rejects a file over maxSize", async () => {
    await expect(uploadFile(pdf(2000), { maxSize: 1000 })).rejects.toThrow(
      "exceeds maximum allowed size",
    );
  });

  it("accepts a file under maxSize", async () => {
    const res = await uploadFile(pdf(), { maxSize: 1000 });
    expect(res.success).toBe(true);
  });

  it("rejects an image over the pixel limit instead of storing it raw", async () => {
    // ~61 megapixels of one colour: tiny on disk, huge when decoded
    const bomb = await sharp({
      create: { width: 8000, height: 7700, channels: 3, background: "#fff" },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(bomb.length).toBeLessThan(2 * 1024 * 1024);

    await expect(
      uploadFile(new File([bomb], "bomb.png", { type: "image/png" }), {
        allowedGroups: ["image"],
      }),
    ).rejects.toThrow("Image dimensions are too large");
    const dir = path.join(tmpRoot, "mediauploads");
    expect(fs.existsSync(dir) ? fs.readdirSync(dir) : []).toEqual([]);
  }, 30_000);
});
