// Tests for POST and DELETE in src/app/api/v1/uploads/lots/[...path]/route.js
// (GET, which serves files, is covered by media-serving.test.js)
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthorizedUser, mockMasterAdmin } from "../../../helpers/auth";
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
  uploadFile: vi.fn(),
}));

const { POST, DELETE } =
  await import("@/app/api/v1/uploads/lots/[...path]/route");
const { uploadFile } = await import("@/lib/fileHandler");

const ALL_ROLES = ["master-admin", "admin", "manager", "employee"];
const MODULES = ["project_details", "site_photos"];
const URL = "/api/v1/uploads/lots";

const ALL_TAB_KINDS = {
  architecture_drawings: "ARCHITECTURE_DRAWINGS",
  appliances_specifications: "APPLIANCES_SPECIFICATIONS",
  material_selection: "MATERIAL_SELECTION",
  cabinetry_drawings: "CABINETRY_DRAWINGS",
  changes_to_do: "CHANGES_TO_DO",
  site_measurements: "SITE_MEASUREMENTS",
  delivery_photos: "DELIVERY_PHOTOS",
  installation_photos: "INSTALLATION_PHOTOS",
  maintenance_photos: "MAINTENANCE_PHOTOS",
  finished_site_photos: "FINISHED_SITE_PHOTOS",
};

describe("POST /api/v1/uploads/lots/[...path]", () => {
  const SEGMENTS = ["proj-1", "lot-1", "architecture_drawings"];
  const post = (fields, options = {}, segments = SEGMENTS) =>
    POST(
      buildRequest(`${URL}/${segments.join("/")}`, {
        method: "POST",
        body: formBody(
          fields ?? { file: testFile("plan.pdf", "application/pdf") },
        ),
        ...options,
      }),
      routeContext({ path: segments }),
    );

  const storedLot = (overrides = {}) => ({
    lot_id: "lot-1",
    installer_id: null,
    project: { project_id: "proj-1", name: "Smith House" },
    ...overrides,
  });

  function mockUpload({ lot = storedLot(), existingTab = null } = {}) {
    prismaMock.lot.findUnique.mockResolvedValue(lot);
    prismaMock.lot_tab.findUnique.mockResolvedValue(existingTab);
    prismaMock.lot_tab.create.mockImplementation(async ({ data }) => ({
      id: "tab-new",
      ...data,
    }));
    let n = 0;
    prismaMock.lot_file.create.mockImplementation(async ({ data }) => ({
      id: `file-${++n}`,
      ...data,
    }));
    uploadFile.mockImplementation(async (file) => ({
      relativePath: `mediauploads/proj-1/lot-1/architecture_drawings/${file.name}`,
      filename: file.name,
      mimeType: file.type,
      extension: file.name.split(".").pop(),
      size: 16,
    }));
    prismaMock.logs.create.mockResolvedValue({});
  }

  const fileData = (i = 0) => prismaMock.lot_file.create.mock.calls[i][0].data;

  describeAuthorization((options) => post(undefined, options), {
    roles: ALL_ROLES,
    modules: MODULES,
    setup: () => mockUpload(),
    untouched: () => [uploadFile, prismaMock.lot_file.create],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpload();
    });

    describe("path and form validation", () => {
      it.each([[[]], [["proj-1"]], [["proj-1", "lot-1"]]])(
        "returns 400 for a path of %j",
        async (segments) => {
          const res = await post(undefined, {}, segments);

          expect(res.status).toBe(400);
          expect(await res.json()).toEqual({
            status: false,
            message:
              "Path must be /api/v1/uploads/[project_id]/[lot_id]/[tabkind]/[filename?]",
          });
          expect(uploadFile).not.toHaveBeenCalled();
        },
      );

      it("returns 400 listing the allowed values for an unknown tab kind", async () => {
        const res = await post(undefined, {}, [
          "proj-1",
          "lot-1",
          "random_tab",
        ]);

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.status).toBe(false);
        expect(json.message).toContain(
          "Invalid TabKind: random_tab. Allowed values are:",
        );
        for (const kind of Object.keys(ALL_TAB_KINDS)) {
          expect(json.message).toContain(kind);
        }
      });

      it("returns 400 for a request that is not multipart", async () => {
        const res = await POST(
          buildRequest(`${URL}/${SEGMENTS.join("/")}`, {
            method: "POST",
            body: { file: "x" },
          }),
          routeContext({ path: SEGMENTS }),
        );

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Content-Type must be multipart/form-data",
          error: "Content-Type must be multipart/form-data",
        });
      });

      it("returns 400 when the form contains no file", async () => {
        const res = await post({ note: "just text" });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "No file found in form-data",
        });
        expect(prismaMock.lot.findUnique).not.toHaveBeenCalled();
      });

      it("returns 404 when the lot does not exist", async () => {
        mockUpload({ lot: null });

        const res = await post();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Lot with ID lot-1 not found",
        });
        expect(uploadFile).not.toHaveBeenCalled();
      });
    });

    describe("size limits", () => {
      it("returns 413 before parsing when Content-Length is over the limit", async () => {
        mockUpload();

        const res = await post(undefined, {
          headers: { "content-length": String(500 * 1024 * 1024) },
        });

        expect(res.status).toBe(413);
        expect(await res.json()).toEqual({
          status: false,
          message: "Request body exceeds the maximum of 210 MB",
        });
        expect(prismaMock.lot.findUnique).not.toHaveBeenCalled();
        expect(uploadFile).not.toHaveBeenCalled();
      });

      it("returns 400 when more than 10 files are sent", async () => {
        mockUpload();
        const files = Object.fromEntries(
          Array.from({ length: 11 }, (_, i) => [
            `f${i}`,
            testFile(`p${i}.pdf`, "application/pdf"),
          ]),
        );

        const res = await post(files);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Too many files: at most 10 per request",
        });
        expect(uploadFile).not.toHaveBeenCalled();
      });
    });

    describe("project path segment", () => {
      it.each(["proj-2", "../../public", "proj-1/../x"])(
        "returns 404 and stores nothing when the lot is not in project %s",
        async (projectId) => {
          mockUpload();

          const res = await post(undefined, {}, [
            projectId,
            "lot-1",
            "architecture_drawings",
          ]);

          expect(res.status).toBe(404);
          expect(uploadFile).not.toHaveBeenCalled();
          expect(prismaMock.lot_tab.create).not.toHaveBeenCalled();
          expect(prismaMock.lot_file.create).not.toHaveBeenCalled();
        },
      );

      it("builds the folder from the stored project and lot ids", async () => {
        mockUpload({
          lot: storedLot({
            lot_id: "Lot-1",
            project: { project_id: "Proj-1", name: "Smith House" },
          }),
        });

        const res = await post();

        expect(res.status).toBe(201);
        expect(uploadFile.mock.calls[0][1].subDir).toBe(
          "Proj-1/Lot-1/architecture_drawings",
        );
        expect(await res.json()).toMatchObject({
          projectId: "Proj-1",
          lotId: "Lot-1",
        });
      });
    });

    describe("storing files", () => {
      it("uploads the file, records it under the lot's tab and logs", async () => {
        const res = await post();

        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({
          status: true,
          message: "File uploaded",
          projectId: "proj-1",
          lotId: "lot-1",
          tabKind: "architecture_drawings",
          files: [
            {
              field: "file",
              filename: "plan.pdf",
              size: 16,
              mimetype: "application/pdf",
              path: "mediauploads/proj-1/lot-1/architecture_drawings/plan.pdf",
              fileId: "file-1",
            },
          ],
        });
        expect(uploadFile).toHaveBeenCalledWith(expect.any(File), {
          uploadDir: "mediauploads",
          subDir: "proj-1/lot-1/architecture_drawings",
          filenameStrategy: "original",
          allowedGroups: ["image", "pdf", "video", "office", "cad"],
          maxSize: 200 * 1024 * 1024,
        });
        expect(prismaMock.lot_file.create).toHaveBeenCalledWith({
          data: {
            tab_id: "tab-new",
            file_kind: "PDF",
            url: "mediauploads/proj-1/lot-1/architecture_drawings/plan.pdf",
            filename: "plan.pdf",
            mime_type: "application/pdf",
            extension: "pdf",
            size: 16,
            site_group: null,
            is_deleted: false,
          },
        });
        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: {
            user_id: "user-1",
            entity_type: "media",
            entity_id: "file-1",
            action: "CREATE",
            description:
              "File uploaded successfully: plan.pdf for lot: lot-1 and project: Smith House",
          },
        });
      });

      it("looks the lot up with its project", async () => {
        await post();

        expect(prismaMock.lot.findUnique).toHaveBeenCalledWith({
          where: { lot_id: "lot-1" },
          include: { project: { select: { project_id: true, name: true } } },
        });
      });

      it("handles several files, one record and one log each", async () => {
        const res = await post({
          first: testFile("a.pdf", "application/pdf"),
          second: testFile("b.jpg", "image/jpeg"),
        });

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.files.map((f) => [f.field, f.filename, f.fileId])).toEqual([
          ["first", "a.pdf", "file-1"],
          ["second", "b.jpg", "file-2"],
        ]);
        expect(prismaMock.lot_file.create).toHaveBeenCalledTimes(2);
        expect(prismaMock.logs.create).toHaveBeenCalledTimes(2);
      });

      it.each(Object.entries(ALL_TAB_KINDS))(
        "maps the tab kind %s to %s",
        async (kind, enumValue) => {
          await post(undefined, {}, ["proj-1", "lot-1", kind]);

          expect(prismaMock.lot_tab.findUnique).toHaveBeenCalledWith({
            where: { lot_id_tab: { lot_id: "lot-1", tab: enumValue } },
          });
        },
      );

      it("creates the lot tab when it does not exist, lowercasing the lot id", async () => {
        await post(undefined, {}, ["proj-1", "LOT-1", "delivery_photos"]);

        expect(prismaMock.lot_tab.create).toHaveBeenCalledWith({
          data: { lot_id: "lot-1", tab: "DELIVERY_PHOTOS" },
        });
      });

      it("reuses an existing lot tab", async () => {
        mockUpload({ existingTab: { id: "tab-7" } });

        await post();

        expect(prismaMock.lot_tab.create).not.toHaveBeenCalled();
        expect(fileData().tab_id).toBe("tab-7");
      });
    });

    describe("file kind", () => {
      it.each([
        ["image/jpeg", "PHOTO"],
        ["image/png", "PHOTO"],
        ["video/mp4", "VIDEO"],
        ["application/pdf", "PDF"],
        ["application/zip", "OTHER"],
        ["text/plain", "OTHER"],
      ])("classifies %s as %s", async (type, kind) => {
        await post({ file: testFile("f.bin", type) });

        expect(fileData().file_kind).toBe(kind);
      });

      // A file sent without a type is parsed from the form as octet-stream.
      it("classifies a file sent without a type as OTHER", async () => {
        await post({ file: new File(["x"], "f.bin") });

        expect(fileData().file_kind).toBe("OTHER");
        expect(fileData().mime_type).toBe("application/octet-stream");
      });
    });

    describe("site measurement groups", () => {
      const siteTab = ["proj-1", "lot-1", "site_measurements"];
      const withGroup = (group) => ({
        file: testFile("p.jpg", "image/jpeg"),
        ...(group === undefined ? {} : { site_group: group }),
      });

      it.each([
        ["SITE_PHOTOS", "SITE_PHOTOS"],
        ["site_photos", "SITE_PHOTOS"],
        ["Measurement_Photos", "MEASUREMENT_PHOTOS"],
      ])(
        "stores site_group %s as %s on a site_measurements upload",
        async (input, stored) => {
          await post(withGroup(input), {}, siteTab);

          expect(fileData().site_group).toBe(stored);
        },
      );

      it.each([
        ["an unknown value", "OTHER_GROUP"],
        ["omitted", undefined],
      ])("stores no group when it is %s", async (_, value) => {
        await post(withGroup(value), {}, siteTab);

        expect(fileData().site_group).toBeNull();
      });

      it("ignores site_group on other tabs", async () => {
        await post(withGroup("SITE_PHOTOS"));

        expect(fileData().site_group).toBeNull();
      });
    });

    describe("employee access", () => {
      const asEmployee = () =>
        mockAuthorizedUser({
          userType: "employee",
          modules: ["site_photos"],
          employeeId: "EMP-7",
        });

      it("lets an employee upload to a lot they install", async () => {
        asEmployee();
        mockUpload({ lot: storedLot({ installer_id: "EMP-7" }) });

        const res = await post();

        expect(res.status).toBe(201);
      });

      it.each([
        ["another employee installs the lot", "EMP-9"],
        ["the lot has no installer", null],
      ])("returns 404 for an employee when %s", async (_, installer_id) => {
        asEmployee();
        mockUpload({ lot: storedLot({ installer_id }) });

        const res = await post();

        expect(res.status).toBe(404);
        expect(uploadFile).not.toHaveBeenCalled();
      });

      it.each(["admin", "manager"])(
        "lets a %s upload to any lot",
        async (userType) => {
          mockAuthorizedUser({ userType, modules: ["project_details"] });
          mockUpload({ lot: storedLot({ installer_id: "EMP-9" }) });

          const res = await post();

          expect(res.status).toBe(201);
        },
      );
    });

    describe("failures", () => {
      it("returns 201 with a warning when a log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await post();

        expect(res.status).toBe(201);
        expect(await res.json()).toMatchObject({
          status: true,
          warning: "Note: Upload succeeded but some logging failed",
        });
        expect(prismaMock.lot_file.create).toHaveBeenCalledOnce();
      });

      it("returns 500 when the upload fails", async () => {
        uploadFile.mockRejectedValue(new Error("virus detected"));

        const res = await post();

        expect(res.status).toBe(500);
        expect(prismaMock.lot_file.create).not.toHaveBeenCalled();
      });

      it("returns 500 when the file record cannot be saved", async () => {
        prismaMock.lot_file.create.mockRejectedValue(new Error("DB down"));

        const res = await post();

        expect(res.status).toBe(500);
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 when the lot lookup fails", async () => {
        prismaMock.lot.findUnique.mockRejectedValue(new Error("DB down"));

        const res = await post();

        expect(res.status).toBe(500);
      });
    });
  });
});

describe("DELETE /api/v1/uploads/lots/[...path]", () => {
  const SEGMENTS = ["proj-1", "lot-1", "architecture_drawings", "plan.pdf"];
  const URL_PATH = "mediauploads/proj-1/lot-1/architecture_drawings/plan.pdf";
  const del = (options = {}, segments = SEGMENTS) =>
    DELETE(
      buildRequest(`${URL}/${segments.join("/")}`, {
        method: "DELETE",
        ...options,
      }),
      routeContext({ path: segments }),
    );

  const record = (overrides = {}) => ({
    id: "file-1",
    filename: "plan.pdf",
    url: URL_PATH,
    ...overrides,
  });

  function mockDelete({ byUrl = record(), tab = null, byName = null } = {}) {
    // reset first: queued "once" values would otherwise stack up across calls
    prismaMock.lot_file.findFirst
      .mockReset()
      .mockResolvedValueOnce(byUrl)
      .mockResolvedValueOnce(byName);
    prismaMock.lot_tab.findFirst.mockResolvedValue(tab);
    prismaMock.lot_file.update.mockImplementation(async ({ where, data }) => ({
      ...record({ id: where.id }),
      ...data,
    }));
  }

  describeAuthorization((options) => del(options), {
    roles: ALL_ROLES,
    modules: MODULES,
    setup: () => mockDelete(),
    untouched: () => [
      prismaMock.lot_file.findFirst,
      prismaMock.lot_file.update,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    it("soft deletes the file found by its url", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "File marked as deleted successfully",
        data: { fileId: "file-1", filename: "plan.pdf" },
      });
      expect(prismaMock.lot_file.findFirst).toHaveBeenCalledWith({
        where: { url: URL_PATH, is_deleted: false },
      });
      expect(prismaMock.lot_file.update).toHaveBeenCalledWith({
        where: { id: "file-1" },
        data: { is_deleted: true },
      });
      expect(prismaMock.lot_file.delete).not.toHaveBeenCalled();
    });

    // Current behaviour: unlike uploads, deletions are not logged.
    it("does not write an activity log", async () => {
      await del();

      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 404 for an empty path", async () => {
      const res = await del({}, []);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Missing path",
      });
    });

    it("rejects a path that climbs out of the uploads folder", async () => {
      const res = await del({}, ["..", "package.json"]);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ status: false, message: "Not found" });
      expect(prismaMock.lot_file.findFirst).not.toHaveBeenCalled();
    });

    describe("fallback lookup by tab and filename", () => {
      it("finds the file through the lot tab when the url does not match", async () => {
        mockDelete({
          byUrl: null,
          tab: { id: "tab-1" },
          byName: record({ id: "file-9" }),
        });

        const res = await del();

        expect(res.status).toBe(200);
        expect(prismaMock.lot_tab.findFirst).toHaveBeenCalledWith({
          where: { lot_id: "lot-1", tab: "ARCHITECTURE_DRAWINGS" },
        });
        expect(prismaMock.lot_file.findFirst).toHaveBeenLastCalledWith({
          where: { tab_id: "tab-1", filename: "plan.pdf", is_deleted: false },
        });
        expect(prismaMock.lot_file.update).toHaveBeenCalledWith({
          where: { id: "file-9" },
          data: { is_deleted: true },
        });
      });

      it("upper-cases a tab kind it does not recognise", async () => {
        mockDelete({ byUrl: null });

        await del({}, ["proj-1", "lot-1", "custom_tab", "x.pdf"]);

        expect(prismaMock.lot_tab.findFirst).toHaveBeenCalledWith({
          where: { lot_id: "lot-1", tab: "CUSTOM_TAB" },
        });
      });

      it("does not try the fallback for paths with fewer than four parts", async () => {
        mockDelete({ byUrl: null });

        const res = await del({}, ["proj-1", "lot-1", "plan.pdf"]);

        expect(res.status).toBe(404);
        expect(prismaMock.lot_tab.findFirst).not.toHaveBeenCalled();
      });

      it("returns 404 when the tab does not exist either", async () => {
        mockDelete({ byUrl: null, tab: null });

        const res = await del();

        expect(res.status).toBe(404);
        expect(prismaMock.lot_file.update).not.toHaveBeenCalled();
      });
    });

    it("returns 404 with debug details when no record is found", async () => {
      mockDelete({ byUrl: null, tab: null });

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "File record not found in database",
        debug: { relativePath: URL_PATH, segments: SEGMENTS },
      });
    });

    describe("employee access", () => {
      const asEmployee = () =>
        mockAuthorizedUser({
          userType: "employee",
          modules: ["site_photos"],
          employeeId: "EMP-7",
        });

      it("lets an employee delete a file on a lot they install", async () => {
        asEmployee();
        prismaMock.lot_file.findUnique.mockResolvedValue({
          tab: { lot: { installer_id: "EMP-7" } },
        });

        const res = await del();

        expect(res.status).toBe(200);
      });

      it("returns 404 for an employee on a lot they do not install", async () => {
        asEmployee();
        prismaMock.lot_file.findUnique.mockResolvedValue({
          tab: { lot: { installer_id: "EMP-9" } },
        });

        const res = await del();

        expect(res.status).toBe(404);
        expect(prismaMock.lot_file.update).not.toHaveBeenCalled();
      });
    });

    it("returns 500 when the update fails", async () => {
      prismaMock.lot_file.update.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });

    it("returns 500 when the lookup fails", async () => {
      prismaMock.lot_file.findFirst.mockReset();
      prismaMock.lot_file.findFirst.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
    });
  });
});
