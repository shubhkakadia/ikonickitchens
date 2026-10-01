import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, formBody, testFile } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

// Keep the real form-parsing helpers; stub the disk operations.
vi.mock("@/lib/fileHandler", async (importOriginal) => ({
  ...(await importOriginal()),
  uploadFile: vi.fn(),
  deleteFileByRelativePath: vi.fn(),
}));

const { POST } = await import("@/app/api/v1/employee/create/route");
const { uploadFile } = await import("@/lib/fileHandler");

const URL = "/api/v1/employee/create";
const validFields = (overrides = {}) => ({
  employee_id: "EMP-7",
  first_name: "Ann",
  last_name: "Lee",
  role: "Installer",
  email: "ann@ikoniq.test",
  phone: "0412345678",
  ...overrides,
});
const post = (fields = validFields(), options = {}) =>
  POST(
    buildRequest(URL, { method: "POST", body: formBody(fields), ...options }),
  );

const UPLOAD_RESULT = {
  relativePath: "mediauploads/employees/EMP-7.webp",
  originalFilename: "photo.jpg",
  mimeType: "image/webp",
  extension: "webp",
  size: 1234,
};

function mockCreate() {
  prismaMock.employees.create.mockImplementation(async ({ data }) => ({
    id: "emp-uuid",
    ...data,
  }));
  prismaMock.employees.findUnique.mockImplementation(async () => ({
    id: "emp-uuid",
    ...createdData(),
    image: null,
  }));
  prismaMock.employees.update.mockResolvedValue({});
  prismaMock.media.create.mockResolvedValue({ id: "media-1" });
  prismaMock.logs.create.mockResolvedValue({});
  uploadFile.mockResolvedValue(UPLOAD_RESULT);
}

const createdData = () => prismaMock.employees.create.mock.calls[0]?.[0].data;

describe("POST /api/v1/employee/create", () => {
  describeAuthorization((options) => post(validFields(), options), {
    modules: "add_employees",
    setup: mockCreate,
    untouched: () => [prismaMock.employees.create],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockCreate();
    });

    it("creates the employee, returns it with its image and logs it", async () => {
      const res = await post();

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.status).toBe(true);
      expect(json.message).toBe("Employee created successfully");
      expect(json.warning).toBeUndefined();
      expect(json.imageWarning).toBeUndefined();
      expect(json.data).toMatchObject({ id: "emp-uuid", employee_id: "EMP-7" });

      expect(prismaMock.employees.findUnique).toHaveBeenCalledWith({
        where: { id: "emp-uuid" },
        include: { image: true },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "employee",
          entity_id: "emp-uuid",
          action: "CREATE",
          description: "Employee created successfully: Ann Lee",
        },
      });
    });

    it("stores every supported field, formatting phones and dates", async () => {
      await post(
        validFields({
          phone_secondary: "+61412000111",
          emergency_contact_phone: "0412 999 888",
          dob: "1990-05-20",
          join_date: "2024-02-01",
          address: "1 Main St",
          emergency_contact_name: "Bob",
          bank_account_name: "Ann Lee",
          bank_account_number: "12345678",
          bank_account_bsb: "065-000",
          supper_account_name: "Aus Super",
          supper_account_number: "999",
          tfn_number: "123456789",
          abn_number: "11222333444",
          education: "Cert III",
          notes: "Good",
        }),
      );

      expect(createdData()).toEqual({
        employee_id: "EMP-7",
        first_name: "Ann",
        last_name: "Lee",
        role: "Installer",
        email: "ann@ikoniq.test",
        phone: "0412 345 678",
        phone_secondary: "0412 000 111",
        dob: new Date("1990-05-20"),
        join_date: new Date("2024-02-01"),
        address: "1 Main St",
        emergency_contact_name: "Bob",
        emergency_contact_phone: "0412 999 888",
        bank_account_name: "Ann Lee",
        bank_account_number: "12345678",
        bank_account_bsb: "065-000",
        supper_account_name: "Aus Super",
        supper_account_number: "999",
        tfn_number: "123456789",
        abn_number: "11222333444",
        education: "Cert III",
        availability: null,
        notes: "Good",
        is_active: true,
      });
    });

    it("ignores fields that are not employee columns", async () => {
      await post(validFields({ is_deleted: "true", image_id: "hijack" }));

      expect(createdData()).not.toHaveProperty("is_deleted");
      expect(createdData()).not.toHaveProperty("image_id");
    });

    it.each([
      ["an empty string", "", null],
      ["an invalid date", "not-a-date", null],
    ])("stores dob as null when it is %s", async (_, dob, expected) => {
      await post(validFields({ dob }));

      expect(createdData().dob).toBe(expected);
    });

    describe("is_active", () => {
      it("defaults to true when omitted", async () => {
        await post();

        expect(createdData().is_active).toBe(true);
      });

      it.each([
        ["true", true],
        ["false", false],
        ["yes", false],
        ["1", false],
      ])("maps %j to %s", async (value, expected) => {
        await post(validFields({ is_active: value }));

        expect(createdData().is_active).toBe(expected);
      });
    });

    describe("availability", () => {
      it("stores valid JSON as-is", async () => {
        const availability = JSON.stringify({ monday: true, tuesday: false });

        await post(validFields({ availability }));

        expect(createdData().availability).toBe(availability);
      });

      it("stores null when availability is blank", async () => {
        await post(validFields({ availability: "   " }));

        expect(createdData().availability).toBeNull();
      });

      it("returns 400 for invalid JSON", async () => {
        const res = await post(validFields({ availability: "{monday: yes" }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Invalid availability data format",
        });
        expect(prismaMock.employees.create).not.toHaveBeenCalled();
      });
    });

    describe("required fields", () => {
      it.each(["employee_id", "first_name", "role", "email", "phone"])(
        "returns 400 when %s is missing",
        async (field) => {
          const res = await post(validFields({ [field]: undefined }));

          expect(res.status).toBe(400);
          expect(await res.json()).toEqual({
            status: false,
            message: `Missing required fields: ${field}`,
          });
          expect(prismaMock.employees.create).not.toHaveBeenCalled();
        },
      );

      it("rejects whitespace-only values", async () => {
        const res = await post(validFields({ first_name: "   " }));

        expect(res.status).toBe(400);
        expect((await res.json()).message).toBe(
          "Missing required fields: first_name",
        );
      });

      it("lists every missing field", async () => {
        const res = await post({ last_name: "Lee" });

        expect((await res.json()).message).toBe(
          "Missing required fields: employee_id, first_name, role, email, phone",
        );
      });

      it("does not require last_name", async () => {
        const res = await post(validFields({ last_name: undefined }));

        expect(res.status).toBe(201);
      });

      // Current behaviour: the log/description interpolates the missing
      // last name as the text "undefined".
      it("logs 'undefined' when last_name is omitted", async () => {
        await post(validFields({ last_name: undefined }));

        expect(prismaMock.logs.create.mock.calls[0][0].data.description).toBe(
          "Employee created successfully: Ann undefined",
        );
      });
    });

    it("returns 409 when the employee_id already exists", async () => {
      prismaMock.employees.create.mockRejectedValue(
        Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
      );

      const res = await post();

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        status: false,
        message: "Employee already exists with this employee id: EMP-7",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 500 for other create errors", async () => {
      prismaMock.employees.create.mockRejectedValue(new Error("DB down"));

      const res = await post();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal Server Error",
      });
    });

    describe("photo upload", () => {
      it("uploads the photo, creates a media row and links it", async () => {
        const res = await post(validFields({ image: testFile() }));

        expect(res.status).toBe(201);
        expect((await res.json()).imageWarning).toBeUndefined();

        expect(uploadFile).toHaveBeenCalledWith(expect.any(File), {
          uploadDir: "mediauploads",
          subDir: "employees",
          filenameStrategy: "id-based",
          idPrefix: "EMP-7",
        });
        expect(uploadFile.mock.calls[0][0].name).toBe("photo.jpg");
        expect(prismaMock.media.create).toHaveBeenCalledWith({
          data: {
            url: "mediauploads/employees/EMP-7.webp",
            filename: "photo.jpg",
            file_type: "employee_photo",
            mime_type: "image/webp",
            extension: "webp",
            size: 1234,
            employee_id: "emp-uuid",
          },
        });
        expect(prismaMock.employees.update).toHaveBeenCalledWith({
          where: { id: "emp-uuid" },
          data: { image_id: "media-1" },
        });
      });

      it("skips the upload when no photo is sent", async () => {
        await post();

        expect(uploadFile).not.toHaveBeenCalled();
        expect(prismaMock.media.create).not.toHaveBeenCalled();
      });

      it("skips the upload when the image field is an empty string", async () => {
        await post(validFields({ image: "" }));

        expect(uploadFile).not.toHaveBeenCalled();
      });

      it("still creates the employee (201) when the upload fails", async () => {
        uploadFile.mockRejectedValue(new Error("virus detected"));

        const res = await post(validFields({ image: testFile() }));

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.status).toBe(true);
        expect(json.imageWarning).toBe(
          "Employee created, but image upload failed",
        );
        expect(prismaMock.media.create).not.toHaveBeenCalled();
      });

      it("warns when the media row cannot be saved", async () => {
        prismaMock.media.create.mockRejectedValue(new Error("DB down"));

        const res = await post(validFields({ image: testFile() }));

        expect(res.status).toBe(201);
        expect((await res.json()).imageWarning).toBe(
          "Employee created, but image upload failed",
        );
      });
    });

    it("returns 201 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await post();

      expect(res.status).toBe(201);
      expect((await res.json()).warning).toBe(
        "Note: Creation succeeded but logging failed",
      );
    });

    // Current behaviour: only multipart/form-data is accepted, and a JSON
    // body is reported as a 500 rather than a 400/415.
    it("returns 500 for a JSON body", async () => {
      const res = await POST(
        buildRequest(URL, { method: "POST", body: validFields() }),
      );

      expect(res.status).toBe(500);
      expect(prismaMock.employees.create).not.toHaveBeenCalled();
    });
  });
});
