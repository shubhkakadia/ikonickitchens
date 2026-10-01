// Tests for src/app/api/v1/uploads/material-selection/[id]/route.js
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
  await import("@/app/api/v1/uploads/material-selection/[id]/route");
const { uploadMultipleFiles } = await import("@/lib/fileHandler");

const ID = "ms-1";
const URL = `/api/v1/uploads/material-selection/${ID}`;
const ctx = () => routeContext({ id: ID });

const storedSelection = (overrides = {}) => ({
  id: ID,
  project_id: "proj-1",
  project: { project_id: "proj-1", name: "Smith House" },
  ...overrides,
});

const uploaded = (name, overrides = {}) => ({
  relativePath: `mediauploads/material_selection/proj-1/${name}`,
  originalFilename: name,
  fileType: "image",
  mimeType: "image/jpeg",
  extension: "jpg",
  size: 100,
  ...overrides,
});

describe("POST /api/v1/uploads/material-selection/[id]", () => {
  const post = (fields, options = {}) =>
    POST(
      buildRequest(URL, {
        method: "POST",
        body: formBody(
          fields ?? { files: testFile("swatch.jpg", "image/jpeg") },
        ),
        ...options,
      }),
      ctx(),
    );

  function mockUpload({ selection = storedSelection(), results } = {}) {
    prismaMock.material_selection.findUnique.mockResolvedValue(selection);
    uploadMultipleFiles.mockResolvedValue(
      results ?? { successful: [uploaded("swatch.jpg")], failed: [] },
    );
    let n = 0;
    prismaMock.media.create.mockImplementation(async ({ data }) => ({
      id: `media-${++n}`,
      ...data,
    }));
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization((options) => post(undefined, options), {
    modules: "project_details",
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
            url: "mediauploads/material_selection/proj-1/swatch.jpg",
            filename: "swatch.jpg",
            file_type: "image",
            mime_type: "image/jpeg",
            extension: "jpg",
            size: 100,
            material_selection_id: ID,
          },
        ],
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "media",
          entity_id: "media-1",
          action: "CREATE",
          description: `Media uploaded successfully: swatch.jpg for Material Selection: ${ID}`,
        },
      });
    });

    it("stores the files under the selection's project", async () => {
      await post();

      expect(uploadMultipleFiles).toHaveBeenCalledWith([expect.any(File)], {
        uploadDir: "mediauploads",
        subDir: "material_selection/proj-1",
        filenameStrategy: "original",
      });
    });

    it('uses a "general" folder when the selection has no project', async () => {
      mockUpload({
        selection: storedSelection({ project_id: null, project: null }),
      });

      await post();

      expect(uploadMultipleFiles.mock.calls[0][1].subDir).toBe(
        "material_selection/general",
      );
    });

    it("passes every file in the files field, ignoring other fields", async () => {
      const form = new FormData();
      form.append("files", testFile("a.jpg", "image/jpeg"));
      form.append("files", testFile("b.jpg", "image/jpeg"));
      form.append("other", testFile("c.jpg", "image/jpeg"));
      form.append("note", "text");

      await POST(buildRequest(URL, { method: "POST", body: form }), ctx());

      const passed = uploadMultipleFiles.mock.calls[0][0];
      expect(passed.map((f) => f.name)).toEqual(["a.jpg", "b.jpg"]);
    });

    it("creates one media record and log per uploaded file", async () => {
      mockUpload({
        results: {
          successful: [uploaded("a.jpg"), uploaded("b.jpg")],
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

    // Current behaviour: files that failed to upload are dropped silently;
    // the response counts only the successful ones.
    it("reports only the files that uploaded when some fail", async () => {
      mockUpload({
        results: {
          successful: [uploaded("a.jpg")],
          failed: [{ filename: "b.jpg", error: "too large" }],
        },
      });

      const res = await post();

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.message).toBe("1 file(s) uploaded successfully");
      expect(json).not.toHaveProperty("warning");
    });

    it("returns 404 when the material selection does not exist", async () => {
      mockUpload({ selection: null });

      const res = await post();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Material selection not found",
      });
      expect(prismaMock.material_selection.findUnique).toHaveBeenCalledWith({
        where: { id: ID },
        include: { project: { select: { project_id: true, name: true } } },
      });
    });

    it("returns 400 when no files are sent", async () => {
      const res = await post({ files: undefined, note: "text" });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "No files provided",
      });
      expect(uploadMultipleFiles).not.toHaveBeenCalled();
    });

    it("returns 500 when every file fails to upload", async () => {
      mockUpload({
        results: {
          successful: [],
          failed: [{ filename: "a.jpg", error: "x" }],
        },
      });

      const res = await post();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Failed to upload files",
      });
      expect(prismaMock.media.create).not.toHaveBeenCalled();
    });

    it("returns 201 with a warning when a log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await post();

      expect(res.status).toBe(201);
      expect((await res.json()).warning).toBe(
        "Note: Upload succeeded but some logging failed",
      );
    });

    // Current behaviour: the multipart check is not wrapped, so a request that
    // is not form data reaches the outer handler and is a 500, not a 400.
    it("returns 500 when the request is not multipart", async () => {
      const res = await POST(
        buildRequest(URL, { method: "POST", body: { files: "x" } }),
        ctx(),
      );

      expect(res.status).toBe(500);
      expect(uploadMultipleFiles).not.toHaveBeenCalled();
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

    it("returns 500 when the selection lookup fails", async () => {
      prismaMock.material_selection.findUnique.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await post();

      expect(res.status).toBe(500);
    });
  });
});

describe("DELETE /api/v1/uploads/material-selection/[id]", () => {
  const del = (query = "?mediaId=media-1", options = {}) =>
    DELETE(
      buildRequest(`${URL}${query}`, { method: "DELETE", ...options }),
      ctx(),
    );

  function mockDelete({
    selection = storedSelection(),
    media = { id: "media-1" },
  } = {}) {
    prismaMock.material_selection.findUnique.mockResolvedValue(selection);
    prismaMock.media.findFirst.mockResolvedValue(media);
    prismaMock.media.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      filename: "swatch.jpg",
      ...data,
    }));
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization((options) => del(undefined, options), {
    modules: "project_details",
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
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Media marked as deleted successfully",
        data: { fileId: "media-1", filename: "swatch.jpg" },
      });
      expect(prismaMock.media.findFirst).toHaveBeenCalledWith({
        where: { id: "media-1", material_selection_id: ID, is_deleted: false },
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
          description: `Media deleted successfully: swatch.jpg for Material Selection: ${ID} (Project: Smith House)`,
        },
      });
    });

    it('logs the project as "N/A" when the selection has no project', async () => {
      mockDelete({ selection: storedSelection({ project: null }) });

      const res = await del();

      expect(res.status).toBe(200);
      expect(
        prismaMock.logs.create.mock.calls[0][0].data.description,
      ).toContain("(Project: N/A)");
    });

    it("returns 400 when mediaId is missing", async () => {
      const res = await del("");

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "mediaId is required",
      });
      expect(prismaMock.material_selection.findUnique).not.toHaveBeenCalled();
    });

    it("returns 404 when the material selection does not exist", async () => {
      mockDelete({ selection: null });

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Material selection not found",
      });
    });

    it("returns 404 when the media is missing, already deleted or belongs to another selection", async () => {
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

    it("returns 500 when the update fails", async () => {
      prismaMock.media.update.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
