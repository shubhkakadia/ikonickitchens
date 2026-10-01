// Tests for src/app/api/v1/employee/[id]/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin, mockAuthorizedUser } from "../../../helpers/auth";
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
  deleteFileByRelativePath: vi.fn(),
}));

const { GET, PATCH, DELETE } = await import("@/app/api/v1/employee/[id]/route");
const { uploadFile, deleteFileByRelativePath } =
  await import("@/lib/fileHandler");

// The route param is the human employee_id, not the uuid primary key
const ID = "EMP-7";
const URL = `/api/v1/employee/${ID}`;
const ctx = () => routeContext({ id: ID });

const storedEmployee = (overrides = {}) => ({
  id: "emp-uuid",
  employee_id: ID,
  first_name: "Ann",
  last_name: "Lee",
  role: "Installer",
  email: "ann@ikoniq.test",
  phone: "0412 345 678",
  dob: "1990-05-20T00:00:00.000Z",
  image_id: null,
  image: null,
  is_active: true,
  is_deleted: false,
  ...overrides,
});

const withPhoto = () =>
  storedEmployee({
    image_id: "old-media",
    image: { id: "old-media", url: "mediauploads/employees/EMP-7-old.webp" },
  });

describe("GET /api/v1/employee/[id]", () => {
  const get = (options) => GET(buildRequest(URL, options), ctx());

  beforeEach(() => {
    prismaMock.employees.findFirst.mockResolvedValue(storedEmployee());
  });

  describeAuthorization(get, {
    authOnly: true,
    untouched: () => [prismaMock.employees.findFirst],
  });

  describe("permissions (own record vs others)", () => {
    const expectForbidden = async (res) => {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
        status: false,
        message: "Insufficient permissions",
      });
      expect(prismaMock.employees.findFirst).not.toHaveBeenCalled();
    };

    it("lets an employee read their own record without any module", async () => {
      mockAuthorizedUser({ userType: "employee", employeeId: ID });

      expect((await get()).status).toBe(200);
    });

    it("forbids an employee from reading someone else, even with employee_details", async () => {
      mockAuthorizedUser({
        userType: "employee",
        employeeId: "EMP-OTHER",
        modules: ["employee_details"],
      });

      await expectForbidden(await get());
    });

    it("forbids an employee with no linked employee record", async () => {
      mockAuthorizedUser({ userType: "employee", employeeId: null });

      await expectForbidden(await get());
    });

    it.each(["manager", "admin"])(
      "lets a %s read their own record without employee_details",
      async (userType) => {
        mockAuthorizedUser({ userType, employeeId: ID });

        expect((await get()).status).toBe(200);
      },
    );

    it.each(["manager", "admin"])(
      "forbids a %s from reading others without employee_details",
      async (userType) => {
        mockAuthorizedUser({
          userType,
          employeeId: "EMP-OTHER",
          modules: ["all_employees"],
        });

        await expectForbidden(await get());
      },
    );

    it.each(["manager", "admin"])(
      "lets a %s with employee_details read any record",
      async (userType) => {
        mockAuthorizedUser({
          userType,
          employeeId: "EMP-OTHER",
          modules: ["employee_details"],
        });

        expect((await get()).status).toBe(200);
      },
    );

    it("lets a master-admin read any record without modules", async () => {
      mockAuthorizedUser({ userType: "master-admin", employeeId: "EMP-OTHER" });

      expect((await get()).status).toBe(200);
    });
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("returns the employee with photo and user account (no password)", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Employee fetched successfully",
        data: storedEmployee(),
      });
      expect(prismaMock.employees.findFirst).toHaveBeenCalledWith({
        where: { employee_id: ID, is_deleted: false },
        include: {
          image: true,
          user: {
            select: {
              id: true,
              username: true,
              user_type: true,
              is_active: true,
              employee_id: true,
              createdAt: true,
              updatedAt: true,
              module_access: true,
            },
          },
        },
      });
    });

    it("never selects the linked user's password", async () => {
      await get();

      const { select } =
        prismaMock.employees.findFirst.mock.calls[0][0].include.user;
      expect(select).not.toHaveProperty("password");
    });

    it("returns 404 when the employee does not exist or is deleted", async () => {
      prismaMock.employees.findFirst.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Employee not found",
      });
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.employees.findFirst.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal Server Error",
      });
    });
  });
});

describe("PATCH /api/v1/employee/[id]", () => {
  const patchJson = (body, options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());
  const patchForm = (fields) =>
    PATCH(
      buildRequest(URL, { method: "PATCH", body: formBody(fields) }),
      ctx(),
    );

  const UPLOAD_RESULT = {
    relativePath: "mediauploads/employees/EMP-7.webp",
    originalFilename: "new.jpg",
    mimeType: "image/webp",
    extension: "webp",
    size: 999,
  };

  function mockUpdate(current = storedEmployee()) {
    prismaMock.employees.findUnique.mockImplementation(async ({ where }) =>
      where.employee_id ? current : { ...current, refreshed: true },
    );
    prismaMock.employees.update.mockImplementation(async ({ data }) => ({
      ...current,
      ...data,
    }));
    prismaMock.media.delete.mockResolvedValue({});
    prismaMock.media.update.mockResolvedValue({});
    prismaMock.media.create.mockResolvedValue({ id: "new-media" });
    prismaMock.logs.create.mockResolvedValue({});
    uploadFile.mockResolvedValue(UPLOAD_RESULT);
    deleteFileByRelativePath.mockResolvedValue(true);
  }

  // The first employees.update call is the field update
  const updateData = () => prismaMock.employees.update.mock.calls[0][0].data;

  describeAuthorization((options) => patchJson({ notes: "x" }, options), {
    modules: "employee_details",
    setup: () => mockUpdate(),
    untouched: () => [prismaMock.employees.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    it("updates the employee, returns the refreshed record and logs it", async () => {
      const res = await patchJson({ notes: "Promoted" });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Employee updated successfully",
        data: { ...storedEmployee(), refreshed: true },
      });
      expect(prismaMock.employees.update).toHaveBeenCalledWith({
        where: { employee_id: ID },
        data: { notes: "Promoted" },
      });
      expect(prismaMock.employees.findUnique).toHaveBeenLastCalledWith({
        where: { id: "emp-uuid" },
        include: { image: true },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "employee",
          entity_id: ID,
          action: "UPDATE",
          description: "Employee updated successfully: Ann Lee",
        },
      });
    });

    describe("partial updates", () => {
      it("only writes the fields that were sent", async () => {
        await patchJson({ first_name: "Annie", address: "2 New St" });

        expect(updateData()).toEqual({
          first_name: "Annie",
          address: "2 New St",
        });
      });

      // Regression: omitted dates used to become null and wipe the column.
      it("does not touch dob or join_date when they are omitted", async () => {
        await patchJson({ notes: "x" });

        expect(updateData()).not.toHaveProperty("dob");
        expect(updateData()).not.toHaveProperty("join_date");
      });

      it("clears a date when it is sent as an empty string", async () => {
        await patchJson({ dob: "" });

        expect(updateData()).toEqual({ dob: null });
      });

      it("converts dates and formats phone numbers", async () => {
        await patchJson({
          join_date: "2024-02-01",
          phone: "+61412345678",
          phone_secondary: "0412000111",
          emergency_contact_phone: "0412999888",
        });

        expect(updateData()).toEqual({
          join_date: new Date("2024-02-01"),
          phone: "0412 345 678",
          phone_secondary: "0412 000 111",
          emergency_contact_phone: "0412 999 888",
        });
      });

      it("ignores employee_id, is_deleted, image_id and unknown fields", async () => {
        await patchJson({
          notes: "x",
          employee_id: "EMP-NEW",
          is_deleted: true,
          image_id: "hijack",
          foo: "bar",
        });

        expect(updateData()).toEqual({ notes: "x" });
      });

      it("accepts the same partial update as multipart form data", async () => {
        await patchForm({ first_name: "Annie" });

        expect(updateData()).toEqual({ first_name: "Annie" });
      });
    });

    describe("required fields", () => {
      it.each(["first_name", "role", "email", "phone"])(
        "returns 400 when %s is sent empty",
        async (field) => {
          const res = await patchJson({ [field]: "  " });

          expect(res.status).toBe(400);
          expect(await res.json()).toEqual({
            status: false,
            message: `These fields cannot be empty: ${field}`,
          });
          expect(prismaMock.employees.update).not.toHaveBeenCalled();
        },
      );

      it("lists every empty field", async () => {
        const res = await patchJson({ first_name: "", email: "" });

        expect((await res.json()).message).toBe(
          "These fields cannot be empty: first_name, email",
        );
      });

      it("allows last_name to be cleared", async () => {
        const res = await patchJson({ last_name: "" });

        expect(res.status).toBe(200);
        expect(updateData()).toEqual({ last_name: "" });
      });
    });

    describe("availability", () => {
      it("stores a JSON string as-is", async () => {
        await patchJson({ availability: '{"monday":true}' });

        expect(updateData()).toEqual({ availability: '{"monday":true}' });
      });

      it("stringifies an object sent in a JSON body", async () => {
        await patchJson({ availability: { monday: true } });

        expect(updateData()).toEqual({ availability: '{"monday":true}' });
      });

      it.each([
        ["null", null],
        ["an empty string", ""],
        ["a number", 5],
      ])("stores null for %s", async (_, availability) => {
        await patchJson({ availability });

        expect(updateData()).toEqual({ availability: null });
      });

      it("leaves availability alone when omitted", async () => {
        await patchJson({ notes: "x" });

        expect(updateData()).not.toHaveProperty("availability");
      });

      it("returns 400 for invalid JSON", async () => {
        const res = await patchJson({ availability: "{monday" });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Invalid availability data format",
        });
        expect(prismaMock.employees.findUnique).not.toHaveBeenCalled();
      });
    });

    describe("is_active", () => {
      it.each([
        [true, true],
        ["true", true],
        [false, false],
        ["false", false],
        ["yes", false],
      ])("maps %j to %s", async (value, expected) => {
        await patchJson({ is_active: value });

        expect(updateData()).toEqual({ is_active: expected });
      });

      it("leaves is_active alone when null", async () => {
        await patchJson({ is_active: null, notes: "x" });

        expect(updateData()).toEqual({ notes: "x" });
      });
    });

    it("returns 404 when the employee does not exist", async () => {
      prismaMock.employees.findUnique.mockResolvedValue(null);

      const res = await patchJson({ notes: "x" });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Employee not found",
      });
      expect(prismaMock.employees.update).not.toHaveBeenCalled();
    });

    it("returns 404 when the record vanishes before the update (P2025)", async () => {
      prismaMock.employees.update.mockRejectedValue(
        Object.assign(new Error("Record not found"), { code: "P2025" }),
      );

      const res = await patchJson({ notes: "x" });

      expect(res.status).toBe(404);
      expect((await res.json()).message).toBe("Employee not found");
    });

    // Current behaviour: the lookup ignores is_deleted, so a soft-deleted
    // employee can still be edited.
    it("updates a soft-deleted employee", async () => {
      mockUpdate(storedEmployee({ is_deleted: true }));

      const res = await patchJson({ notes: "x" });

      expect(res.status).toBe(200);
      expect(prismaMock.employees.findUnique.mock.calls[0][0].where).toEqual({
        employee_id: ID,
      });
    });

    describe("photo", () => {
      it("uploads a new photo under a unique name and links it when there was none", async () => {
        const res = await patchForm({ image: testFile("new.jpg") });

        expect(res.status).toBe(200);
        expect((await res.json()).imageWarning).toBeUndefined();
        expect(prismaMock.media.delete).not.toHaveBeenCalled();
        expect(prismaMock.media.update).not.toHaveBeenCalled();
        expect(uploadFile).toHaveBeenCalledWith(expect.any(File), {
          uploadDir: "mediauploads",
          subDir: "employees",
          filenameStrategy: "unique",
          allowedGroups: ["image"],
          maxSize: 10 * 1024 * 1024,
          idPrefix: ID,
        });
        expect(prismaMock.media.create).toHaveBeenCalledWith({
          data: {
            url: "mediauploads/employees/EMP-7.webp",
            filename: "new.jpg",
            file_type: "employee_photo",
            mime_type: "image/webp",
            extension: "webp",
            size: 999,
            employee_id: "emp-uuid",
          },
        });
        expect(prismaMock.employees.update).toHaveBeenLastCalledWith({
          where: { id: "emp-uuid" },
          data: { image_id: "new-media" },
        });
      });

      it("uploads the new photo first, then swaps and soft deletes the old one in one transaction", async () => {
        mockUpdate(withPhoto());
        const order = [];
        uploadFile.mockImplementation(async () => {
          order.push("upload new");
          return UPLOAD_RESULT;
        });
        prismaMock.media.create.mockImplementation(async () => {
          order.push("create new row");
          return { id: "new-media" };
        });
        prismaMock.media.update.mockImplementation(async () => {
          order.push("soft delete old row");
          return {};
        });

        await patchForm({ image: testFile("new.jpg") });

        expect(order).toEqual([
          "upload new",
          "create new row",
          "soft delete old row",
        ]);
        expect(prismaMock.media.update).toHaveBeenCalledWith({
          where: { id: "old-media" },
          data: { is_deleted: true },
        });
        // soft delete only: the old row and file are kept
        expect(prismaMock.media.delete).not.toHaveBeenCalled();
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
        // the swap is atomic: the photo update and soft delete share a transaction
        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
      });

      it("keeps the old photo when the new upload fails", async () => {
        mockUpdate(withPhoto());
        uploadFile.mockRejectedValue(new Error("virus detected"));

        const res = await patchForm({ image: testFile() });

        expect(res.status).toBe(200);
        expect((await res.json()).imageWarning).toBe(
          "Employee updated, but image upload failed",
        );
        // nothing about the existing photo was touched
        expect(prismaMock.media.update).not.toHaveBeenCalled();
        expect(prismaMock.media.delete).not.toHaveBeenCalled();
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
        expect(prismaMock.employees.update).toHaveBeenCalledTimes(1);
      });

      it("keeps the old photo and removes the new file when linking it fails", async () => {
        mockUpdate(withPhoto());
        prismaMock.media.create.mockRejectedValue(new Error("DB down"));

        const res = await patchForm({ image: testFile() });

        expect(res.status).toBe(200);
        expect((await res.json()).imageWarning).toBe(
          "Employee updated, but image upload failed",
        );
        expect(prismaMock.media.update).not.toHaveBeenCalled();
        expect(deleteFileByRelativePath).toHaveBeenCalledWith(
          UPLOAD_RESULT.relativePath,
        );
      });

      it("soft deletes the photo when remove_image is 'true'", async () => {
        mockUpdate(withPhoto());

        const res = await patchForm({ remove_image: "true" });

        expect(res.status).toBe(200);
        expect((await res.json()).imageWarning).toBeUndefined();
        expect(prismaMock.employees.update).toHaveBeenCalledWith({
          where: { id: "emp-uuid" },
          data: { image_id: null },
        });
        expect(prismaMock.media.update).toHaveBeenCalledWith({
          where: { id: "old-media" },
          data: { is_deleted: true },
        });
        expect(prismaMock.media.delete).not.toHaveBeenCalled();
        // the file stays on disk for the deleted-media screen
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
        expect(uploadFile).not.toHaveBeenCalled();
      });

      it("does nothing for remove_image when there is no photo", async () => {
        await patchForm({ remove_image: "true" });

        expect(prismaMock.media.update).not.toHaveBeenCalled();
        expect(prismaMock.media.delete).not.toHaveBeenCalled();
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
      });

      it("treats a new image as a replacement even when remove_image is set", async () => {
        mockUpdate(withPhoto());

        await patchForm({ remove_image: "true", image: testFile() });

        expect(uploadFile).toHaveBeenCalled();
        expect(prismaMock.media.create).toHaveBeenCalled();
      });

      it("warns when the photo cannot be removed", async () => {
        mockUpdate(withPhoto());
        prismaMock.media.update.mockRejectedValue(new Error("DB down"));

        const res = await patchForm({ remove_image: "true" });

        expect(res.status).toBe(200);
        expect((await res.json()).imageWarning).toBe(
          "Employee updated, but existing image could not be removed",
        );
      });

      // Current behaviour: remove_image is only read from multipart bodies.
      it("ignores remove_image in a JSON body", async () => {
        mockUpdate(withPhoto());

        await patchJson({ remove_image: true });

        expect(prismaMock.media.delete).not.toHaveBeenCalled();
      });
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await patchJson({ notes: "x" });

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Update succeeded but logging failed",
      );
    });

    it("returns 500 when the update fails", async () => {
      prismaMock.employees.update.mockRejectedValue(new Error("DB down"));

      const res = await patchJson({ notes: "x" });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal Server Error",
      });
    });

    it("returns 500 for a malformed JSON body", async () => {
      const res = await PATCH(
        buildRequest(URL, {
          method: "PATCH",
          rawBody: "{not json",
          headers: { "content-type": "application/json" },
        }),
        ctx(),
      );

      expect(res.status).toBe(500);
      expect(prismaMock.employees.update).not.toHaveBeenCalled();
    });
  });
});

describe("DELETE /api/v1/employee/[id]", () => {
  const del = (options) =>
    DELETE(buildRequest(URL, { method: "DELETE", ...options }), ctx());

  function mockDelete(current = storedEmployee()) {
    prismaMock.employees.findUnique.mockResolvedValue(current);
    prismaMock.employees.update.mockResolvedValue({
      ...current,
      is_deleted: true,
    });
    prismaMock.media.update.mockResolvedValue({});
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization(del, {
    modules: "employee_details",
    setup: () => mockDelete(),
    untouched: () => [prismaMock.employees.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    it("soft deletes the employee and logs it", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Employee deleted successfully",
        data: { ...storedEmployee(), is_deleted: true },
      });
      expect(prismaMock.employees.findUnique).toHaveBeenCalledWith({
        where: { employee_id: ID },
        include: { image: true },
      });
      expect(prismaMock.employees.update).toHaveBeenCalledWith({
        where: { employee_id: ID },
        data: { is_deleted: true },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "employee",
          entity_id: ID,
          action: "DELETE",
          description: "Employee deleted successfully: Ann Lee",
        },
      });
    });

    it("also soft deletes the employee's photo", async () => {
      mockDelete(withPhoto());

      await del();

      expect(prismaMock.media.update).toHaveBeenCalledWith({
        where: { id: "old-media" },
        data: { is_deleted: true },
      });
    });

    it("skips the photo when there is none", async () => {
      await del();

      expect(prismaMock.media.update).not.toHaveBeenCalled();
    });

    it("never hard deletes the employee or the photo", async () => {
      mockDelete(withPhoto());

      await del();

      expect(prismaMock.employees.delete).not.toHaveBeenCalled();
      expect(prismaMock.media.delete).not.toHaveBeenCalled();
    });

    it("still deletes the employee when the photo update fails", async () => {
      mockDelete(withPhoto());
      prismaMock.media.update.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect(prismaMock.employees.update).toHaveBeenCalled();
    });

    // Current behaviour: the employee's login is left untouched, so a
    // deleted employee's user account stays active with its sessions.
    it("does not deactivate the linked user account or its sessions", async () => {
      await del();

      expect(prismaMock.users.update).not.toHaveBeenCalled();
      expect(prismaMock.sessions.deleteMany).not.toHaveBeenCalled();
    });

    it("returns 404 when the employee does not exist", async () => {
      prismaMock.employees.findUnique.mockResolvedValue(null);

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Employee not found",
      });
      expect(prismaMock.employees.update).not.toHaveBeenCalled();
    });

    it("returns 400 when the employee is already deleted", async () => {
      mockDelete(storedEmployee({ is_deleted: true }));

      const res = await del();

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Employee already deleted",
      });
      expect(prismaMock.employees.update).not.toHaveBeenCalled();
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
      prismaMock.employees.update.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal Server Error",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });
  });
});
