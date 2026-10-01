// Tests for src/app/api/v1/uploads/materials-to-order/[id]/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import {
  buildRequest,
  formBody,
  routeContext,
  testFile,
} from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

// Keep the real form-parsing helpers; stub the disk operations.
vi.mock("@/lib/fileHandler", async (importOriginal) => ({
  ...(await importOriginal()),
  uploadMultipleFiles: vi.fn(),
}));

const { POST, DELETE } =
  await import("@/app/api/v1/uploads/materials-to-order/[id]/route");
const { uploadMultipleFiles } = await import("@/lib/fileHandler");

const ID = "mto-1";
const URL = `/api/v1/uploads/materials-to-order/${ID}`;
const ctx = () => routeContext({ id: ID });
const MODULES = ["project_details", "materialstoorder", "supplier_details"];

const storedMto = (overrides = {}) => ({
  id: ID,
  project_id: "proj-1",
  is_deleted: false,
  project: { project_id: "proj-1", name: "Smith House" },
  ...overrides,
});

const uploaded = (name) => ({
  relativePath: `mediauploads/materials_to_order/proj-1/${name}`,
  originalFilename: name,
  fileType: "document",
  mimeType: "application/pdf",
  extension: "pdf",
  size: 200,
});

describe("POST /api/v1/uploads/materials-to-order/[id]", () => {
  const post = (fields, options = {}) =>
    POST(
      buildRequest(URL, {
        method: "POST",
        body: formBody(
          fields ?? { files: testFile("quote.pdf", "application/pdf") },
        ),
        ...options,
      }),
      ctx(),
    );

  function mockUpload({ mto = storedMto(), results } = {}) {
    prismaMock.materials_to_order.findUnique.mockResolvedValue(mto);
    uploadMultipleFiles.mockResolvedValue(
      results ?? { successful: [uploaded("quote.pdf")], failed: [] },
    );
    let n = 0;
    prismaMock.media.create.mockImplementation(async ({ data }) => ({
      id: `media-${++n}`,
      ...data,
    }));
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization((options) => post(undefined, options), {
    modules: MODULES,
    setup: () => mockUpload(),
    untouched: () => [uploadMultipleFiles, prismaMock.media.create],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpload();
    });

    it("uploads the files, creates media records and logs", async () => {
      const res = await post();

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({
        status: true,
        message: "1 file(s) uploaded successfully",
        data: [
          {
            id: "media-1",
            url: "mediauploads/materials_to_order/proj-1/quote.pdf",
            filename: "quote.pdf",
            file_type: "document",
            mime_type: "application/pdf",
            extension: "pdf",
            size: 200,
            materials_to_orderId: ID,
          },
        ],
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "media",
          entity_id: "media-1",
          action: "CREATE",
          description: `Media uploaded successfully: quote.pdf for MTO: ${ID}`,
        },
      });
    });

    it("stores the files under the MTO's project", async () => {
      await post();

      expect(uploadMultipleFiles).toHaveBeenCalledWith([expect.any(File)], {
        uploadDir: "mediauploads",
        subDir: "materials_to_order/proj-1",
        filenameStrategy: "original",
      });
    });

    // Current behaviour: an MTO with no project is allowed elsewhere, but here
    // it ends up in a folder literally named "null".
    it('stores files for an MTO with no project in a folder named "null"', async () => {
      mockUpload({ mto: storedMto({ project_id: null }) });

      await post();

      expect(uploadMultipleFiles.mock.calls[0][1].subDir).toBe(
        "materials_to_order/null",
      );
    });

    it("creates one media record and log per uploaded file", async () => {
      mockUpload({
        results: {
          successful: [uploaded("a.pdf"), uploaded("b.pdf")],
          failed: [],
        },
      });

      const res = await post();

      expect((await res.json()).message).toBe(
        "2 file(s) uploaded successfully",
      );
      expect(prismaMock.media.create).toHaveBeenCalledTimes(2);
      expect(prismaMock.logs.create).toHaveBeenCalledTimes(2);
    });

    it("reports only the files that uploaded when some fail", async () => {
      mockUpload({
        results: {
          successful: [uploaded("a.pdf")],
          failed: [{ filename: "b.pdf", error: "too large" }],
        },
      });

      const res = await post();

      expect(res.status).toBe(201);
      expect((await res.json()).message).toBe(
        "1 file(s) uploaded successfully",
      );
    });

    it.each([
      ["does not exist", null],
      ["is deleted", storedMto({ is_deleted: true })],
    ])("returns 404 when the MTO %s", async (_, mto) => {
      mockUpload({ mto });

      const res = await post();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Materials to order not found",
      });
      expect(uploadMultipleFiles).not.toHaveBeenCalled();
    });

    it("returns 400 when no files are sent", async () => {
      const res = await post({ note: "text" });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "No files provided",
      });
    });

    it("returns 500 when every file fails to upload", async () => {
      mockUpload({
        results: {
          successful: [],
          failed: [{ filename: "a.pdf", error: "x" }],
        },
      });

      const res = await post();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Failed to upload files",
      });
    });

    it("returns 201 with a warning when a log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await post();

      expect(res.status).toBe(201);
      expect((await res.json()).warning).toBe(
        "Note: Upload succeeded but some logging failed",
      );
    });

    it("returns 500 when the request is not multipart", async () => {
      const res = await POST(
        buildRequest(URL, { method: "POST", body: { files: "x" } }),
        ctx(),
      );

      expect(res.status).toBe(500);
    });

    it("returns 500 when a media record cannot be saved", async () => {
      prismaMock.media.create.mockRejectedValue(new Error("DB down"));

      const res = await post();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});

describe("DELETE /api/v1/uploads/materials-to-order/[id]", () => {
  const del = (query = "?mediaId=media-1", options = {}) =>
    DELETE(
      buildRequest(`${URL}${query}`, { method: "DELETE", ...options }),
      ctx(),
    );

  function mockDelete({ mto = storedMto(), media = { id: "media-1" } } = {}) {
    prismaMock.materials_to_order.findUnique.mockResolvedValue(mto);
    prismaMock.media.findFirst.mockResolvedValue(media);
    prismaMock.media.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      filename: "quote.pdf",
      ...data,
    }));
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization((options) => del(undefined, options), {
    modules: MODULES,
    setup: () => mockDelete(),
    untouched: () => [prismaMock.media.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    it("soft deletes the media and logs the deletion", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Media marked as deleted successfully",
        data: { fileId: "media-1", filename: "quote.pdf" },
      });
      expect(prismaMock.media.findFirst).toHaveBeenCalledWith({
        where: { id: "media-1", materials_to_orderId: ID, is_deleted: false },
      });
      expect(prismaMock.media.update).toHaveBeenCalledWith({
        where: { id: "media-1" },
        data: { is_deleted: true },
      });
      expect(prismaMock.media.delete).not.toHaveBeenCalled();
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "media",
          entity_id: "media-1",
          action: "DELETE",
          description: `Media deleted successfully: quote.pdf for MTO: ${ID} (Project: Smith House)`,
        },
      });
    });

    it("returns 400 when mediaId is missing", async () => {
      const res = await del("");

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "mediaId is required",
      });
      expect(prismaMock.materials_to_order.findUnique).not.toHaveBeenCalled();
    });

    it.each([
      ["does not exist", null],
      ["is deleted", storedMto({ is_deleted: true })],
    ])("returns 404 when the MTO %s", async (_, mto) => {
      mockDelete({ mto });

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Materials to order not found",
      });
    });

    it("returns 404 when the media is missing, already deleted or belongs to another MTO", async () => {
      mockDelete({ media: null });

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Media not found",
      });
      expect(prismaMock.media.update).not.toHaveBeenCalled();
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Deletion succeeded but logging failed",
      );
    });

    // Current behaviour (bug): the log text reads mto.project.name without a
    // null check, but an MTO can have no project. The media is already marked
    // deleted by then, so the caller gets a 500 for a deletion that worked.
    it("returns 500 after soft deleting when the MTO has no project", async () => {
      mockDelete({ mto: storedMto({ project_id: null, project: null }) });

      const res = await del();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.media.update).toHaveBeenCalledOnce();
    });

    it("returns 500 when the update fails", async () => {
      prismaMock.media.update.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
    });
  });
});
