import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { POST } = await import("@/app/api/v1/client/create/route");

const URL = "/api/v1/client/create";
const validBody = (overrides = {}) => ({
  client_type: "builder",
  client_name: "Bettio Construction",
  client_slug: "btto",
  client_address: "1 Main St",
  client_phone: "0412345678",
  client_email: "info@bettio.test",
  client_website: "https://bettio.test",
  client_notes: "Notes",
  ...overrides,
});
const post = (body = validBody(), options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

// Echo create() input back as the stored row, like Prisma would.
function mockCreates() {
  prismaMock.client.findUnique.mockResolvedValue(null);
  prismaMock.client.create.mockImplementation(async ({ data }) => ({
    client_id: "client-1",
    is_deleted: false,
    ...data,
  }));
  let n = 0;
  prismaMock.contact.create.mockImplementation(async ({ data }) => ({
    id: `contact-${++n}`,
    ...data,
  }));
  prismaMock.logs.create.mockResolvedValue({});
}

describe("POST /api/v1/client/create", () => {
  describeAuthorization((options) => post(validBody(), options), {
    modules: "add_clients",
    setup: mockCreates,
    untouched: () => [prismaMock.client.create, prismaMock.$transaction],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockCreates();
    });

    it("creates a client with a normalised slug and formatted phone, and logs it", async () => {
      const res = await post();

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Client created successfully",
        data: {
          client_id: "client-1",
          is_deleted: false,
          client_type: "builder",
          client_name: "Bettio Construction",
          client_slug: "BTTO",
          client_address: "1 Main St",
          client_phone: "0412 345 678",
          client_email: "info@bettio.test",
          client_website: "https://bettio.test",
          client_notes: "Notes",
          contacts: [],
        },
      });
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.contact.create).not.toHaveBeenCalled();
      expect(prismaMock.logs.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "client",
          entity_id: "client-1",
          action: "CREATE",
          description: "Client created successfully: Bettio Construction",
        },
      });
    });

    it("checks the normalised slug and the client name for uniqueness", async () => {
      await post(validBody({ client_slug: "b-t t o" }));

      expect(prismaMock.client.findUnique).toHaveBeenNthCalledWith(1, {
        where: { client_slug: "BTTO" },
      });
      expect(prismaMock.client.findUnique).toHaveBeenNthCalledWith(2, {
        where: { client_name: "Bettio Construction" },
      });
    });

    it("converts an international phone number to national format", async () => {
      const res = await post(validBody({ client_phone: "+61412345678" }));

      expect((await res.json()).data.client_phone).toBe("0412 345 678");
    });

    it("keeps an unparseable phone number as trimmed text", async () => {
      const res = await post(validBody({ client_phone: "  12345  " }));

      expect((await res.json()).data.client_phone).toBe("12345");
    });

    it.each([null, ""])("stores phone %j unchanged", async (phone) => {
      await post(validBody({ client_phone: phone }));

      expect(prismaMock.client.create.mock.calls[0][0].data.client_phone).toBe(
        phone,
      );
    });

    it("creates contacts in the same transaction, filling optional fields with null", async () => {
      const res = await post(
        validBody({
          contacts: [
            {
              first_name: "Ann",
              last_name: "Lee",
              email: "ann@bettio.test",
              phone: "0400000000",
              role: "PM",
              preferred_contact_method: "email",
              notes: "Main contact",
            },
            { first_name: "Bob", last_name: "Ray", email: "" },
          ],
        }),
      );

      expect(res.status).toBe(201);
      expect(prismaMock.contact.create).toHaveBeenNthCalledWith(1, {
        data: {
          first_name: "Ann",
          last_name: "Lee",
          email: "ann@bettio.test",
          phone: "0400000000",
          role: "PM",
          preferred_contact_method: "email",
          notes: "Main contact",
          client_id: "client-1",
        },
      });
      expect(prismaMock.contact.create).toHaveBeenNthCalledWith(2, {
        data: {
          first_name: "Bob",
          last_name: "Ray",
          email: null,
          phone: null,
          role: null,
          preferred_contact_method: null,
          notes: null,
          client_id: "client-1",
        },
      });

      const json = await res.json();
      expect(json.data.contacts.map((c) => c.id)).toEqual([
        "contact-1",
        "contact-2",
      ]);
    });

    it("writes one log for the client and one per contact", async () => {
      await post(
        validBody({
          contacts: [
            { first_name: "Ann", last_name: "Lee" },
            { first_name: "Bob", last_name: "Ray" },
          ],
        }),
      );

      expect(prismaMock.logs.create).toHaveBeenCalledTimes(3);
      expect(prismaMock.logs.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          entity_type: "contact",
          entity_id: "contact-1",
          action: "CREATE",
          description:
            "Contact created successfully: Ann Lee for client: Bettio Construction",
        }),
      });
    });

    it.each([
      ["an empty array", []],
      ["not an array", { first_name: "Ann", last_name: "Lee" }],
      ["null", null],
    ])("skips contacts when contacts is %s", async (_, contacts) => {
      const res = await post(validBody({ contacts }));

      expect(res.status).toBe(201);
      expect(prismaMock.contact.create).not.toHaveBeenCalled();
    });

    it.each([
      ["missing first_name", { last_name: "Lee" }],
      ["missing last_name", { first_name: "Ann" }],
      ["empty first_name", { first_name: "", last_name: "Lee" }],
    ])("returns 400 when a contact is %s", async (_, badContact) => {
      const res = await post(
        validBody({
          contacts: [{ first_name: "Ok", last_name: "Contact" }, badContact],
        }),
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "First Name and Last Name are required for all contacts",
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(prismaMock.client.create).not.toHaveBeenCalled();
    });

    it.each([
      ["missing", undefined],
      ["too short", "abc"],
      ["empty", ""],
      ["symbols only", "!!!!"],
    ])("returns 400 when the slug is %s", async (_, slug) => {
      const res = await post(validBody({ client_slug: slug }));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Client slug must be exactly 4 letters",
      });
      expect(prismaMock.client.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.client.create).not.toHaveBeenCalled();
    });

    // Current behaviour: slugs longer than 4 characters are truncated.
    it("truncates a slug longer than 4 characters", async () => {
      await post(validBody({ client_slug: "bettio" }));

      expect(prismaMock.client.create.mock.calls[0][0].data.client_slug).toBe(
        "BETT",
      );
    });

    // Current behaviour (bug): String(null) is "null", so a null slug is
    // accepted and stored as "NULL".
    it("stores the slug NULL when client_slug is null", async () => {
      const res = await post(validBody({ client_slug: null }));

      expect(res.status).toBe(201);
      expect(prismaMock.client.create.mock.calls[0][0].data.client_slug).toBe(
        "NULL",
      );
    });

    it("returns 409 when the slug is already taken", async () => {
      prismaMock.client.findUnique.mockResolvedValueOnce({
        client_id: "other",
      });

      const res = await post();

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        status: false,
        message: "Client slug is already taken",
      });
      expect(prismaMock.client.create).not.toHaveBeenCalled();
    });

    it("returns 409 when a client with the same name exists", async () => {
      prismaMock.client.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ client_id: "other" });

      const res = await post();

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        status: false,
        message: "Client already exists by this client id: Bettio Construction",
      });
      expect(prismaMock.client.create).not.toHaveBeenCalled();
    });

    it("returns 201 with a warning when the client log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await post();

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.status).toBe(true);
      expect(json.warning).toBe("Note: Creation succeeded but logging failed");
    });

    // Current behaviour: only the client log result is checked; failed
    // contact logs do not produce a warning.
    it("does not warn when only a contact log fails", async () => {
      prismaMock.logs.create
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error("log table down"));

      const res = await post(
        validBody({ contacts: [{ first_name: "Ann", last_name: "Lee" }] }),
      );

      expect(res.status).toBe(201);
      expect((await res.json()).warning).toBeUndefined();
    });

    it("returns 500 and writes no logs when creating a contact fails", async () => {
      prismaMock.contact.create.mockRejectedValue(new Error("constraint"));

      const res = await post(
        validBody({ contacts: [{ first_name: "Ann", last_name: "Lee" }] }),
      );

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 500 when the uniqueness lookup fails", async () => {
      prismaMock.client.findUnique.mockRejectedValue(new Error("DB down"));

      const res = await post();

      expect(res.status).toBe(500);
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
      expect(prismaMock.client.create).not.toHaveBeenCalled();
    });
  });
});
