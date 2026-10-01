// Tests for src/app/api/v1/supplier/[id]/statements/route.js
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
// sendNotification sends real WhatsApp messages; never call it in tests.
vi.mock("@/lib/notification", () => ({ sendNotification: vi.fn() }));

const { GET, POST } =
  await import("@/app/api/v1/supplier/[id]/statements/route");
const { uploadFile, deleteFileByRelativePath } =
  await import("@/lib/fileHandler");
const { sendNotification } = await import("@/lib/notification");

const ID = "SUP-1";
const URL = `/api/v1/supplier/${ID}/statements`;
const ctx = () => routeContext({ id: ID });
const MODULES = ["statements", "supplier_details"];

const storedSupplier = () => ({
  supplier_id: ID,
  name: "Timber Co",
  is_deleted: false,
});

describe("GET /api/v1/supplier/[id]/statements", () => {
  const get = (options) => GET(buildRequest(URL, options), ctx());

  beforeEach(() => {
    prismaMock.supplier.findFirst.mockResolvedValue(storedSupplier());
    prismaMock.supplier_statement.findMany.mockResolvedValue([]);
  });

  describeAuthorization(get, {
    modules: MODULES,
    untouched: () => [
      prismaMock.supplier.findFirst,
      prismaMock.supplier_statement.findMany,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("returns the supplier's statements, newest first", async () => {
      const statements = [{ id: "st-2" }, { id: "st-1" }];
      prismaMock.supplier_statement.findMany.mockResolvedValue(statements);

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Statements fetched successfully",
        data: statements,
      });
      expect(prismaMock.supplier_statement.findMany).toHaveBeenCalledWith({
        where: { supplier_id: ID },
        include: { supplier_file: true },
        orderBy: { createdAt: "desc" },
      });
    });

    it("looks the supplier up ignoring deleted ones", async () => {
      await get();

      expect(prismaMock.supplier.findFirst).toHaveBeenCalledWith({
        where: { supplier_id: ID, is_deleted: false },
      });
    });

    it("returns 404 when the supplier does not exist or is deleted", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Supplier not found",
      });
      expect(prismaMock.supplier_statement.findMany).not.toHaveBeenCalled();
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.supplier_statement.findMany.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});

describe("POST /api/v1/supplier/[id]/statements", () => {
  const fields = (overrides = {}) => ({
    file: testFile("march.pdf", "application/pdf"),
    month_year: "March 2026",
    due_date: "2026-04-15",
    amount: "250.5",
    payment_status: "PENDING",
    notes: "First",
    ...overrides,
  });
  const post = (body = fields(), options = {}) =>
    POST(
      buildRequest(URL, { method: "POST", body: formBody(body), ...options }),
      ctx(),
    );

  const UPLOAD_RESULT = {
    relativePath: "mediauploads/suppliers/SUP-1/statements/x.pdf",
    originalFilename: "march.pdf",
    mimeType: "application/pdf",
    extension: "pdf",
    size: 1234,
  };

  // due_date is built from local-time parts so the formatted date does not
  // depend on the machine's time zone
  const LOCAL_DUE = new Date(2026, 3, 15);

  function mockCreate() {
    prismaMock.supplier.findUnique.mockResolvedValue(storedSupplier());
    prismaMock.supplier_file.create.mockResolvedValue({ id: "file-1" });
    prismaMock.supplier_statement.create.mockImplementation(
      async ({ data }) => ({
        id: "st-1",
        ...data,
        due_date: LOCAL_DUE,
        supplier_file: { id: "file-1" },
      }),
    );
    prismaMock.logs.create.mockResolvedValue({});
    uploadFile.mockResolvedValue(UPLOAD_RESULT);
    deleteFileByRelativePath.mockResolvedValue(undefined);
  }

  describeAuthorization((options) => post(undefined, options), {
    modules: MODULES,
    setup: mockCreate,
    untouched: () => [prismaMock.supplier.findUnique, uploadFile],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockCreate();
    });

    it("uploads the file, creates the records and logs", async () => {
      const res = await post();

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.status).toBe(true);
      expect(json.message).toBe("Statement uploaded successfully");
      expect(json.warning).toBeUndefined();
      expect(json.data).toMatchObject({
        id: "st-1",
        month_year: "March 2026",
        payment_status: "PENDING",
        supplier_id: ID,
        supplier_file_id: "file-1",
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "supplier_statement",
          entity_id: "st-1",
          action: "CREATE",
          description:
            "Statement uploaded successfully: March 2026 for supplier: Timber Co",
        },
      });
    });

    it("names the upload after the supplier and a sanitised month", async () => {
      await post(fields({ month_year: "March / 2026!" }));

      expect(uploadFile).toHaveBeenCalledWith(expect.any(File), {
        uploadDir: "mediauploads",
        subDir: "suppliers/SUP-1/statements",
        filenameStrategy: "id-based",
        idPrefix: "SUP-1_statement_March___2026_",
      });
    });

    it("stores the file record and statement from the form values", async () => {
      await post();

      expect(prismaMock.supplier_file.create).toHaveBeenCalledWith({
        data: {
          url: UPLOAD_RESULT.relativePath,
          filename: "march.pdf",
          file_type: "statement",
          mime_type: "application/pdf",
          extension: "pdf",
          size: 1234,
        },
      });
      expect(prismaMock.supplier_statement.create).toHaveBeenCalledWith({
        data: {
          month_year: "March 2026",
          due_date: new Date("2026-04-15"),
          amount: 250.5,
          payment_status: "PENDING",
          notes: "First",
          supplier_file_id: "file-1",
          supplier_id: ID,
        },
        include: { supplier_file: true },
      });
    });

    it("writes both records in one transaction", async () => {
      await post();

      expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    });

    it("stores a missing amount or empty notes as null", async () => {
      await post(fields({ amount: undefined, notes: "" }));

      const { data } = prismaMock.supplier_statement.create.mock.calls[0][0];
      expect(data.amount).toBeNull();
      expect(data.notes).toBeNull();
    });

    it.each(["PENDING", "PAID"])(
      "accepts payment status %s",
      async (payment_status) => {
        const res = await post(fields({ payment_status }));

        expect(res.status).toBe(201);
      },
    );

    describe("validation", () => {
      it("returns 404 when the supplier does not exist", async () => {
        prismaMock.supplier.findUnique.mockResolvedValue(null);

        const res = await post();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Supplier not found",
        });
        expect(uploadFile).not.toHaveBeenCalled();
      });

      // Current behaviour: unlike GET, the lookup does not exclude deleted suppliers.
      it("accepts a statement for a soft-deleted supplier", async () => {
        prismaMock.supplier.findUnique.mockResolvedValue({
          ...storedSupplier(),
          is_deleted: true,
        });

        const res = await post();

        expect(res.status).toBe(201);
      });

      it.each([
        ["File is required", { file: undefined }],
        ["Month/Year is required", { month_year: undefined }],
        ["Due date is required", { due_date: undefined }],
        [
          "Payment status must be PENDING or PAID",
          { payment_status: undefined },
        ],
        [
          "Payment status must be PENDING or PAID",
          { payment_status: "OVERDUE" },
        ],
        ["Payment status must be PENDING or PAID", { payment_status: "paid" }],
      ])("returns 400 with %j", async (message, override) => {
        const res = await post(fields(override));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ status: false, message });
        expect(uploadFile).not.toHaveBeenCalled();
      });

      it("checks the file, then month, then due date, then status", async () => {
        const res = await post({ payment_status: "bad" });

        expect((await res.json()).message).toBe("File is required");
      });

      it("returns 500 when the request is not multipart", async () => {
        const res = await POST(
          buildRequest(URL, { method: "POST", body: { month_year: "x" } }),
          ctx(),
        );

        expect(res.status).toBe(500);
        expect(uploadFile).not.toHaveBeenCalled();
      });
    });

    describe("notification", () => {
      it("is sent with the supplier, month, amount and formatted due date", async () => {
        await post();

        expect(sendNotification).toHaveBeenCalledWith(
          {
            type: "supplier_statement",
            supplier_id: ID,
            supplier_statement_id: "st-1",
            supplier_name: "Timber Co",
            year_month: "March 2026",
            amount: 250.5,
            due_date: "15/04/2026",
          },
          "supplier_statement_added",
        );
      });

      it("shows N/A when there is no amount", async () => {
        await post(fields({ amount: undefined }));

        expect(sendNotification.mock.calls[0][0].amount).toBe("N/A");
      });

      it("shows Unknown Date when the due date is not a valid date", async () => {
        prismaMock.supplier_statement.create.mockImplementation(
          async ({ data }) => ({
            id: "st-1",
            ...data,
            due_date: new Date("not a date"),
          }),
        );

        await post();

        expect(sendNotification.mock.calls[0][0].due_date).toBe("Unknown Date");
      });

      it("still returns 201 when the notification fails", async () => {
        sendNotification.mockRejectedValue(new Error("WhatsApp down"));

        const res = await post();

        expect(res.status).toBe(201);
      });
    });

    describe("failures", () => {
      it("returns 201 with a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await post();

        expect(res.status).toBe(201);
        expect((await res.json()).warning).toBe(
          "Note: Creation succeeded but logging failed",
        );
      });

      it("deletes the uploaded file and returns 500 when the database write fails", async () => {
        prismaMock.supplier_statement.create.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await post();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
        expect(deleteFileByRelativePath).toHaveBeenCalledWith(
          UPLOAD_RESULT.relativePath,
        );
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
        expect(sendNotification).not.toHaveBeenCalled();
      });

      it("still returns 500 when cleaning up the uploaded file also fails", async () => {
        prismaMock.supplier_file.create.mockRejectedValue(new Error("DB down"));
        deleteFileByRelativePath.mockRejectedValue(new Error("disk error"));

        const res = await post();

        expect(res.status).toBe(500);
      });

      it("returns 500 without touching the database when the upload fails", async () => {
        uploadFile.mockRejectedValue(new Error("virus detected"));

        const res = await post();

        expect(res.status).toBe(500);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
      });

      it("returns 500 when the supplier lookup fails", async () => {
        prismaMock.supplier.findUnique.mockRejectedValue(new Error("DB down"));

        const res = await post();

        expect(res.status).toBe(500);
      });
    });
  });
});
