// Tests for src/app/api/v1/supplier/create/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { POST } = await import("@/app/api/v1/supplier/create/route");

const URL = "/api/v1/supplier/create";
const validBody = (overrides = {}) => ({
  name: "Timber Co",
  email: "sales@timber.test",
  phone: "0412345678",
  address: "1 Mill Rd",
  notes: "Preferred",
  website: "https://timber.test",
  abn_number: "12 345 678 901",
  ...overrides,
});
const post = (body = validBody(), options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

function mockCreate() {
  prismaMock.supplier.findUnique.mockResolvedValue(null);
  prismaMock.supplier.create.mockImplementation(async ({ data }) => ({
    supplier_id: "SUP-1",
    ...data,
  }));
  let n = 0;
  prismaMock.contact.create.mockImplementation(async ({ data }) => ({
    id: `contact-${++n}`,
    ...data,
  }));
  prismaMock.logs.create.mockResolvedValue({});
}

const supplierData = () => prismaMock.supplier.create.mock.calls[0][0].data;

describe("POST /api/v1/supplier/create", () => {
  describeAuthorization((options) => post(undefined, options), {
    modules: "add_suppliers",
    setup: mockCreate,
    untouched: () => [prismaMock.supplier.create, prismaMock.$transaction],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockCreate();
    });

    it("creates the supplier and logs it", async () => {
      const res = await post();

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Supplier created successfully",
        data: {
          supplier_id: "SUP-1",
          ...validBody({ phone: "0412 345 678" }),
          contacts: [],
        },
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "supplier",
          entity_id: "SUP-1",
          action: "CREATE",
          description: "Supplier created successfully: Timber Co",
        },
      });
    });

    it("runs in a transaction", async () => {
      await post();

      expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    });

    describe("phone formatting", () => {
      it("formats a national number", async () => {
        await post(validBody({ phone: "0412345678" }));

        expect(supplierData().phone).toBe("0412 345 678");
      });

      it("converts an international number to national format", async () => {
        await post(validBody({ phone: "+61412345678" }));

        expect(supplierData().phone).toBe("0412 345 678");
      });

      it("keeps an unparseable number as trimmed text", async () => {
        await post(validBody({ phone: "  12345  " }));

        expect(supplierData().phone).toBe("12345");
      });

      it.each([null, "", undefined])(
        "leaves phone %j unchanged",
        async (phone) => {
          await post(validBody({ phone }));

          expect(supplierData().phone).toBe(phone);
        },
      );
    });

    describe("duplicate names", () => {
      it("returns 409 when a supplier with the name exists", async () => {
        prismaMock.supplier.findUnique.mockResolvedValue({
          supplier_id: "SUP-0",
        });

        const res = await post();

        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
          status: false,
          message: "Supplier already exists by this name: Timber Co",
        });
        expect(prismaMock.supplier.findUnique).toHaveBeenCalledWith({
          where: { name: "Timber Co" },
        });
        expect(prismaMock.supplier.create).not.toHaveBeenCalled();
      });

      // Current behaviour: the lookup has no is_deleted filter, so the name of
      // a soft-deleted supplier cannot be reused.
      it("also treats a soft-deleted supplier's name as taken", async () => {
        prismaMock.supplier.findUnique.mockResolvedValue({
          supplier_id: "SUP-0",
          is_deleted: true,
        });

        const res = await post();

        expect(res.status).toBe(409);
      });
    });

    describe("contacts", () => {
      it("creates each contact for the new supplier with null defaults", async () => {
        const res = await post(
          validBody({
            contacts: [
              {
                first_name: "Ann",
                last_name: "Lee",
                email: "ann@timber.test",
                phone: "0400 000 000",
                role: "Sales",
                preferred_contact_method: "EMAIL",
                notes: "Mornings",
              },
              { first_name: "Bob", last_name: "Ray" },
            ],
          }),
        );

        expect(res.status).toBe(201);
        expect(
          prismaMock.contact.create.mock.calls.map(([a]) => a.data),
        ).toEqual([
          {
            first_name: "Ann",
            last_name: "Lee",
            email: "ann@timber.test",
            phone: "0400 000 000",
            role: "Sales",
            preferred_contact_method: "EMAIL",
            notes: "Mornings",
            supplier_id: "SUP-1",
          },
          {
            first_name: "Bob",
            last_name: "Ray",
            email: null,
            phone: null,
            role: null,
            preferred_contact_method: null,
            notes: null,
            supplier_id: "SUP-1",
          },
        ]);
        expect((await res.json()).data.contacts).toHaveLength(2);
      });

      // Current behaviour: contact phone numbers are stored as given.
      it("does not reformat contact phone numbers", async () => {
        await post(
          validBody({
            contacts: [
              { first_name: "A", last_name: "B", phone: "0412345678" },
            ],
          }),
        );

        expect(prismaMock.contact.create.mock.calls[0][0].data.phone).toBe(
          "0412345678",
        );
      });

      it("logs the supplier and then each contact", async () => {
        await post(
          validBody({
            contacts: [
              { first_name: "Ann", last_name: "Lee" },
              { first_name: "Bob", last_name: "Ray" },
            ],
          }),
        );

        const logs = prismaMock.logs.create.mock.calls.map(([a]) => a.data);
        expect(logs.map((l) => [l.entity_type, l.entity_id, l.action])).toEqual(
          [
            ["supplier", "SUP-1", "CREATE"],
            ["contact", "contact-1", "CREATE"],
            ["contact", "contact-2", "CREATE"],
          ],
        );
        expect(logs[1].description).toBe(
          "Contact created successfully: Ann Lee for supplier: Timber Co",
        );
      });

      it.each([
        ["first_name", { last_name: "Lee" }],
        ["last_name", { first_name: "Ann" }],
      ])("returns 400 when a contact has no %s", async (_, contact) => {
        const res = await post(
          validBody({
            contacts: [{ first_name: "OK", last_name: "OK" }, contact],
          }),
        );

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "First Name and Last Name are required for all contacts",
        });
        expect(prismaMock.supplier.create).not.toHaveBeenCalled();
      });

      it.each([
        ["omitted", undefined],
        ["empty", []],
        ["not an array", "nope"],
      ])("creates no contacts when contacts is %s", async (_, contacts) => {
        const res = await post(validBody({ contacts }));

        expect(res.status).toBe(201);
        expect(prismaMock.contact.create).not.toHaveBeenCalled();
      });

      it("checks the duplicate name before validating contacts", async () => {
        prismaMock.supplier.findUnique.mockResolvedValue({
          supplier_id: "SUP-0",
        });

        const res = await post(validBody({ contacts: [{ first_name: "x" }] }));

        expect(res.status).toBe(409);
      });
    });

    describe("failures", () => {
      it("returns 201 with a warning when the supplier log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await post();

        expect(res.status).toBe(201);
        expect((await res.json()).warning).toBe(
          "Note: Creation succeeded but logging failed",
        );
      });

      it("returns 500 when the supplier cannot be created", async () => {
        prismaMock.supplier.create.mockRejectedValue(new Error("DB down"));

        const res = await post();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 when a contact cannot be created", async () => {
        prismaMock.contact.create.mockRejectedValue(new Error("DB down"));

        const res = await post(
          validBody({ contacts: [{ first_name: "Ann", last_name: "Lee" }] }),
        );

        expect(res.status).toBe(500);
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 for a malformed JSON body", async () => {
        const res = await POST(
          buildRequest(URL, {
            method: "POST",
            rawBody: "{not json",
            headers: { "content-type": "application/json" },
          }),
        );

        expect(res.status).toBe(500);
        expect(prismaMock.supplier.create).not.toHaveBeenCalled();
      });
    });
  });
});
