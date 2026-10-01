import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin, mockAuthorizedUser } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { POST } = await import("@/app/api/v1/contact/create/route");

const URL = "/api/v1/contact/create";
const validBody = (overrides = {}) => ({
  first_name: "Ann",
  last_name: "Lee",
  email: "ann@bettio.test",
  role: "PM",
  phone: "0400 000 000",
  preferred_contact_method: "email",
  notes: "Main contact",
  client_id: "client-1",
  ...overrides,
});
const post = (body = validBody(), options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

function mockCreate() {
  prismaMock.contact.create.mockImplementation(async ({ data }) => ({
    id: "contact-1",
    ...data,
  }));
  prismaMock.logs.create.mockResolvedValue({});
}

const createdData = () => prismaMock.contact.create.mock.calls[0][0].data;

describe("POST /api/v1/contact/create", () => {
  describeAuthorization((options) => post(validBody(), options), {
    modules: ["client_details", "supplier_details"],
    setup: mockCreate,
    untouched: () => [prismaMock.contact.create],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockCreate();
    });

    it("creates a client contact and logs it", async () => {
      const res = await post();

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Contact created successfully",
        data: {
          id: "contact-1",
          first_name: "Ann",
          last_name: "Lee",
          email: "ann@bettio.test",
          role: "PM",
          phone: "0400 000 000",
          preferred_contact_method: "email",
          notes: "Main contact",
          client_id: "client-1",
          supplier_id: null,
        },
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "contact",
          entity_id: "contact-1",
          action: "CREATE",
          description: "Contact created successfully: Ann Lee",
        },
      });
    });

    it("creates a supplier contact with client_id set to null", async () => {
      await post(
        validBody({ client_id: undefined, supplier_id: "supplier-1" }),
      );

      expect(createdData()).toMatchObject({
        client_id: null,
        supplier_id: "supplier-1",
      });
    });

    it("lowercases client_id but not supplier_id", async () => {
      await post(
        validBody({ client_id: "CLIENT-ABC", supplier_id: "SUP-ABC" }),
      );

      expect(createdData()).toMatchObject({
        client_id: "client-abc",
        supplier_id: "SUP-ABC",
      });
    });

    it.each([
      ["missing", undefined],
      ["empty", ""],
      ["null", null],
    ])("stores a %s client_id / supplier_id as null", async (_, id) => {
      await post(validBody({ client_id: id, supplier_id: id }));

      expect(createdData()).toMatchObject({
        client_id: null,
        supplier_id: null,
      });
    });

    it("ignores fields other than the contact columns", async () => {
      await post(validBody({ id: "forced-id", createdAt: "2000-01-01" }));

      expect(createdData()).not.toHaveProperty("id");
      expect(createdData()).not.toHaveProperty("createdAt");
    });

    // Current behaviour: no validation. A contact can be created with
    // neither a client nor a supplier, or with both.
    it("creates an orphan contact linked to neither client nor supplier", async () => {
      const res = await post({ first_name: "Ann" });

      expect(res.status).toBe(201);
      expect(createdData()).toMatchObject({
        client_id: null,
        supplier_id: null,
      });
    });

    it("creates a contact linked to both a client and a supplier", async () => {
      const res = await post(validBody({ supplier_id: "supplier-1" }));

      expect(res.status).toBe(201);
      expect(createdData()).toMatchObject({
        client_id: "client-1",
        supplier_id: "supplier-1",
      });
    });

    // Current behaviour: the parent client/supplier is not looked up.
    it("does not check that the client or supplier exists", async () => {
      await post();

      expect(prismaMock.client.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.client.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.supplier.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.supplier.findFirst).not.toHaveBeenCalled();
    });

    // Current behaviour: the module that grants access is not matched to
    // the contact type, so supplier-only users can add client contacts.
    it("lets a user with only supplier_details create a client contact", async () => {
      mockAuthorizedUser({
        userType: "manager",
        modules: ["supplier_details"],
      });

      const res = await post(validBody({ client_id: "client-1" }));

      expect(res.status).toBe(201);
    });

    // first_name is a required column; with no validation the missing value
    // reaches Prisma, which rejects it, and the route answers 500.
    it("returns 500 when Prisma rejects a missing first_name", async () => {
      prismaMock.contact.create.mockRejectedValue(
        new Error("Argument `first_name` is missing."),
      );

      const res = await post(validBody({ first_name: undefined }));

      expect(res.status).toBe(500);
      expect(createdData().first_name).toBeUndefined();
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    // Current behaviour (bug): toLowerCase() is called without a type check.
    it("returns 500 when client_id is not a string", async () => {
      const res = await post(validBody({ client_id: 123 }));

      expect(res.status).toBe(500);
      expect(prismaMock.contact.create).not.toHaveBeenCalled();
    });

    it("returns 201 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await post();

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.status).toBe(true);
      expect(json.data.id).toBe("contact-1");
      expect(json.warning).toBe("Note: Creation succeeded but logging failed");
    });

    it("returns 500 when the create fails (e.g. unknown client_id)", async () => {
      prismaMock.contact.create.mockRejectedValue(
        Object.assign(new Error("Foreign key constraint failed"), {
          code: "P2003",
        }),
      );

      const res = await post();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    // Current behaviour: a malformed body is a 500 rather than a 400.
    it("returns 500 for a malformed JSON body", async () => {
      const res = await POST(
        buildRequest(URL, {
          method: "POST",
          rawBody: "{not json",
          headers: { "content-type": "application/json" },
        }),
      );

      expect(res.status).toBe(500);
      expect(prismaMock.contact.create).not.toHaveBeenCalled();
    });
  });
});
