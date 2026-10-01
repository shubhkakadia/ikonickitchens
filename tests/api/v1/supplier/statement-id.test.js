// Tests for src/app/api/v1/supplier/[id]/statements/[statementId]/route.js
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
  uploadFile: vi.fn(),
  deleteFileByRelativePath: vi.fn(),
}));

const { PATCH, DELETE } =
  await import("@/app/api/v1/supplier/[id]/statements/[statementId]/route");
const { uploadFile, deleteFileByRelativePath } =
  await import("@/lib/fileHandler");

const ID = "SUP-1";
const STATEMENT_ID = "st-1";
const URL = `/api/v1/supplier/${ID}/statements/${STATEMENT_ID}`;
const ctx = () => routeContext({ id: ID, statementId: STATEMENT_ID });
const MODULES = ["statements", "supplier_details"];

const storedStatement = (overrides = {}) => ({
  id: STATEMENT_ID,
  supplier_id: ID,
  month_year: "March 2026",
  supplier_file_id: "file-1",
  supplier_file: {
    id: "file-1",
    url: "mediauploads/old.pdf",
    is_deleted: false,
  },
  supplier: { name: "Timber Co" },
  ...overrides,
});

describe("PATCH /api/v1/supplier/[id]/statements/[statementId]", () => {
  const patchJson = (body = { notes: "Updated" }, options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());
  const patchForm = (fields = {}, options = {}) =>
    PATCH(
      buildRequest(URL, {
        method: "PATCH",
        body: formBody(fields),
        ...options,
      }),
      ctx(),
    );

  const UPLOAD_RESULT = {
    relativePath: "mediauploads/suppliers/SUP-1/statements/new.pdf",
    originalFilename: "new.pdf",
    mimeType: "application/pdf",
    extension: "pdf",
    size: 999,
  };

  function mockUpdate(existing = storedStatement()) {
    prismaMock.supplier_statement.findUnique.mockResolvedValue(existing);
    prismaMock.supplier_statement.update.mockImplementation(async ({ data }) =>
      storedStatement(data),
    );
    prismaMock.supplier_file.update.mockResolvedValue({});
    prismaMock.supplier_file.create.mockResolvedValue({ id: "file-new" });
    prismaMock.logs.create.mockResolvedValue({});
    uploadFile.mockResolvedValue(UPLOAD_RESULT);
    deleteFileByRelativePath.mockResolvedValue(undefined);
  }

  const updateData = () =>
    prismaMock.supplier_statement.update.mock.calls[0][0].data;

  describeAuthorization((options) => patchJson(undefined, options), {
    modules: MODULES,
    setup: () => mockUpdate(),
    untouched: () => [
      prismaMock.supplier_statement.update,
      prismaMock.$transaction,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    describe("JSON updates", () => {
      it("updates the fields and logs the update", async () => {
        const res = await patchJson({
          month_year: "April 2026",
          due_date: "2026-05-15",
          amount: "99.5",
          payment_status: "PAID",
          notes: "Paid in full",
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.message).toBe("Statement updated successfully");
        expect(json.warning).toBeUndefined();
        expect(prismaMock.supplier_statement.update).toHaveBeenCalledWith({
          where: { id: STATEMENT_ID },
          include: {
            supplier_file: true,
            supplier: { select: { name: true } },
          },
          data: {
            month_year: "April 2026",
            due_date: new Date("2026-05-15"),
            amount: 99.5,
            payment_status: "PAID",
            notes: "Paid in full",
          },
        });
        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: {
            user_id: "user-1",
            entity_type: "supplier_statement",
            entity_id: STATEMENT_ID,
            action: "UPDATE",
            description:
              "Statement updated successfully: April 2026 for supplier: Timber Co",
          },
        });
      });

      it("only updates fields that were sent", async () => {
        await patchJson({ payment_status: "PAID" });

        expect(updateData()).toEqual({ payment_status: "PAID" });
      });

      it("runs in a transaction", async () => {
        await patchJson();

        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
      });

      it("never touches the file when no file is sent", async () => {
        await patchJson();

        expect(uploadFile).not.toHaveBeenCalled();
        expect(prismaMock.supplier_file.update).not.toHaveBeenCalled();
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
      });

      it.each([
        ["an empty string", "", null],
        ["null", null, null],
        ["a numeric string", "12.5", 12.5],
      ])("stores amount %s as %s", async (_, amount, stored) => {
        await patchJson({ amount });

        expect(updateData().amount).toBe(stored);
      });

      // Current behaviour: a JSON amount of 0 is falsy, so it is stored as null.
      it("stores a numeric amount of 0 as null", async () => {
        await patchJson({ amount: 0 });

        expect(updateData().amount).toBeNull();
      });

      it("stores empty notes as null", async () => {
        await patchJson({ notes: "" });

        expect(updateData().notes).toBeNull();
      });

      it("returns 400 for an invalid payment status", async () => {
        const res = await patchJson({ payment_status: "OVERDUE" });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Payment status must be PENDING or PAID",
        });
        expect(prismaMock.supplier_statement.update).not.toHaveBeenCalled();
      });
    });

    describe("ownership", () => {
      it("returns 404 when the statement does not exist", async () => {
        mockUpdate(null);

        const res = await patchJson();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Statement not found",
        });
        expect(prismaMock.supplier_statement.findUnique).toHaveBeenCalledWith({
          where: { id: STATEMENT_ID },
          include: { supplier_file: true },
        });
      });

      it("returns 403 when the statement belongs to another supplier", async () => {
        mockUpdate(storedStatement({ supplier_id: "SUP-OTHER" }));

        const res = await patchJson();

        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({
          status: false,
          message: "Statement does not belong to this supplier",
        });
        expect(prismaMock.supplier_statement.update).not.toHaveBeenCalled();
        expect(uploadFile).not.toHaveBeenCalled();
      });
    });

    describe("replacing the file", () => {
      it("uploads the new file, updates the file record and deletes the old file", async () => {
        const res = await patchForm({
          month_year: "April 2026",
          due_date: "2026-05-15",
          amount: "10",
          payment_status: "PENDING",
          notes: "n",
          file: testFile("new.pdf", "application/pdf"),
        });

        expect(res.status).toBe(200);
        expect(uploadFile).toHaveBeenCalledWith(expect.any(File), {
          uploadDir: "mediauploads",
          subDir: "suppliers/SUP-1/statements",
          filenameStrategy: "id-based",
          allowedGroups: ["pdf", "image"],
          maxSize: 25 * 1024 * 1024,
          idPrefix: "SUP-1_statement_April_2026",
        });
        expect(prismaMock.supplier_file.update).toHaveBeenCalledWith({
          where: { id: "file-1" },
          data: {
            url: UPLOAD_RESULT.relativePath,
            filename: "new.pdf",
            mime_type: "application/pdf",
            extension: "pdf",
            size: 999,
          },
        });
        expect(prismaMock.supplier_file.create).not.toHaveBeenCalled();
        expect(deleteFileByRelativePath).toHaveBeenCalledWith(
          "mediauploads/old.pdf",
        );
      });

      it("uses the existing month in the file name when none is sent", async () => {
        await patchForm({ file: testFile() });

        expect(uploadFile.mock.calls[0][1].idPrefix).toBe(
          "SUP-1_statement_March_2026",
        );
      });

      it("creates a file record and links it when the statement had none", async () => {
        mockUpdate(
          storedStatement({ supplier_file: null, supplier_file_id: null }),
        );

        await patchForm({ file: testFile() });

        expect(prismaMock.supplier_file.create).toHaveBeenCalledWith({
          data: {
            url: UPLOAD_RESULT.relativePath,
            filename: "new.pdf",
            file_type: "statement",
            mime_type: "application/pdf",
            extension: "pdf",
            size: 999,
          },
        });
        expect(updateData().supplier_file_id).toBe("file-new");
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
      });

      it("does not delete the old file when the database update fails", async () => {
        prismaMock.supplier_statement.update.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await patchForm({ file: testFile() });

        expect(res.status).toBe(500);
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
      });

      it("still returns 200 when deleting the old file fails", async () => {
        deleteFileByRelativePath.mockRejectedValue(new Error("disk error"));

        const res = await patchForm({ file: testFile() });

        expect(res.status).toBe(200);
      });

      it("returns 500 without touching the database when the upload fails", async () => {
        uploadFile.mockRejectedValue(new Error("virus detected"));

        const res = await patchForm({ file: testFile() });

        expect(res.status).toBe(500);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it("does not leak the internal upload fields into the statement update", async () => {
        await patchForm({ file: testFile() });

        for (const key of Object.keys(updateData())) {
          expect(key.startsWith("_")).toBe(false);
        }
      });
    });

    describe("multipart updates", () => {
      it("reads the fields from form data", async () => {
        const res = await patchForm({
          month_year: "April 2026",
          due_date: "2026-05-15",
          amount: "10",
          payment_status: "PAID",
          notes: "n",
        });

        expect(res.status).toBe(200);
        expect(updateData()).toEqual({
          month_year: "April 2026",
          due_date: new Date("2026-05-15"),
          amount: 10,
          payment_status: "PAID",
          notes: "n",
        });
      });

      // Current behaviour (bug): FormData.get() returns null, not undefined,
      // for a missing field. A multipart update that sends only a file
      // therefore overwrites every other field: the month and notes become
      // null, the status becomes null, and the due date becomes 1970.
      it("overwrites omitted fields with null when only a file is sent", async () => {
        await patchForm({ file: testFile() });

        expect(updateData()).toEqual({
          month_year: null,
          due_date: new Date(0),
          amount: null,
          payment_status: null,
          notes: null,
        });
      });
    });

    describe("failures", () => {
      it("returns 200 with a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await patchJson();

        expect(res.status).toBe(200);
        expect((await res.json()).warning).toBe(
          "Note: Update succeeded but logging failed",
        );
      });

      it("returns 500 when the update fails", async () => {
        prismaMock.supplier_statement.update.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await patchJson();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
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
        expect(prismaMock.supplier_statement.update).not.toHaveBeenCalled();
      });
    });
  });
});

describe("DELETE /api/v1/supplier/[id]/statements/[statementId]", () => {
  const del = (options) =>
    DELETE(buildRequest(URL, { method: "DELETE", ...options }), ctx());

  function mockDelete(existing = storedStatement()) {
    prismaMock.supplier_statement.findUnique.mockResolvedValue(existing);
    prismaMock.supplier_file.update.mockResolvedValue({});
    prismaMock.supplier_statement.delete.mockResolvedValue({});
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization(del, {
    modules: MODULES,
    setup: () => mockDelete(),
    untouched: () => [prismaMock.supplier_statement.delete],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    it("soft deletes the file, deletes the statement and logs", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Statement deleted successfully",
      });
      expect(prismaMock.supplier_statement.findUnique).toHaveBeenCalledWith({
        where: { id: STATEMENT_ID },
        include: { supplier_file: true, supplier: { select: { name: true } } },
      });
      expect(prismaMock.supplier_file.update).toHaveBeenCalledWith({
        where: { id: "file-1" },
        data: { is_deleted: true },
      });
      expect(prismaMock.supplier_file.delete).not.toHaveBeenCalled();
      expect(prismaMock.supplier_statement.delete).toHaveBeenCalledWith({
        where: { id: STATEMENT_ID },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "supplier_statement",
          entity_id: STATEMENT_ID,
          action: "DELETE",
          description:
            "Statement deleted successfully: March 2026 for supplier: Timber Co",
        },
      });
    });

    it.each([
      ["has no file", { supplier_file: null }],
      [
        "has a file that is already deleted",
        { supplier_file: { id: "file-1", is_deleted: true } },
      ],
    ])("does not touch the file when the statement %s", async (_, override) => {
      mockDelete(storedStatement(override));

      const res = await del();

      expect(res.status).toBe(200);
      expect(prismaMock.supplier_file.update).not.toHaveBeenCalled();
      expect(prismaMock.supplier_statement.delete).toHaveBeenCalledOnce();
    });

    it("returns 404 when the statement does not exist", async () => {
      mockDelete(null);

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Statement not found",
      });
      expect(prismaMock.supplier_statement.delete).not.toHaveBeenCalled();
    });

    it("returns 403 when the statement belongs to another supplier", async () => {
      mockDelete(storedStatement({ supplier_id: "SUP-OTHER" }));

      const res = await del();

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
        status: false,
        message: "Statement does not belong to this supplier",
      });
      expect(prismaMock.supplier_file.update).not.toHaveBeenCalled();
      expect(prismaMock.supplier_statement.delete).not.toHaveBeenCalled();
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Statement deleted successfully",
        warning: "Note: Deletion succeeded but logging failed",
      });
    });

    // Current behaviour: the file is soft deleted before the statement is
    // deleted and there is no transaction, so a failed delete leaves the file
    // marked deleted.
    it("returns 500 after the file was already soft deleted when the delete fails", async () => {
      prismaMock.supplier_statement.delete.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await del();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.supplier_file.update).toHaveBeenCalledOnce();
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 500 when the lookup fails", async () => {
      prismaMock.supplier_statement.findUnique.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await del();

      expect(res.status).toBe(500);
    });
  });
});
