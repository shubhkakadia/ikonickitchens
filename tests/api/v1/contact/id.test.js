// Tests for src/app/api/v1/contact/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin, mockAuthorizedUser } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET, PATCH, DELETE } = await import("@/app/api/v1/contact/[id]/route");

const ID = "contact-1";
const URL = `/api/v1/contact/${ID}`;
const MODULES = ["client_details", "supplier_details"];
const ctx = () => routeContext({ id: ID });

const storedContact = (overrides = {}) => ({
  id: ID,
  first_name: "Ann",
  last_name: "Lee",
  email: "ann@bettio.test",
  phone: "0400 000 000",
  role: "PM",
  preferred_contact_method: "email",
  notes: null,
  client_id: "client-1",
  supplier_id: null,
  ...overrides,
});

describe("GET /api/v1/contact/[id]", () => {
  const get = (options) => GET(buildRequest(URL, options), ctx());

  describeAuthorization(get, {
    modules: MODULES,
    setup: () =>
      prismaMock.contact.findUnique.mockResolvedValue(storedContact()),
    untouched: () => [prismaMock.contact.findUnique],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("returns the contact", async () => {
      prismaMock.contact.findUnique.mockResolvedValue(storedContact());

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Contact fetched successfully",
        data: storedContact(),
      });
      expect(prismaMock.contact.findUnique).toHaveBeenCalledWith({
        where: { id: ID },
      });
    });

    // Current behaviour (bug): a missing contact is a 200 with data: null
    // instead of a 404.
    it("returns 200 with null data when the contact does not exist", async () => {
      prismaMock.contact.findUnique.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Contact fetched successfully",
        data: null,
      });
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.contact.findUnique.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});

describe("PATCH /api/v1/contact/[id]", () => {
  const fullBody = (overrides = {}) => ({
    first_name: "Annie",
    last_name: "Lee",
    email: "annie@bettio.test",
    role: "Director",
    phone: "0411 111 111",
    preferred_contact_method: "phone",
    notes: "Updated",
    client_id: "client-1",
    ...overrides,
  });
  const patch = (body = fullBody(), options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());

  function mockUpdate() {
    prismaMock.contact.update.mockImplementation(async ({ data }) =>
      storedContact(data),
    );
    prismaMock.logs.create.mockResolvedValue({});
  }

  const updateData = () => prismaMock.contact.update.mock.calls[0][0].data;

  describeAuthorization((options) => patch(fullBody(), options), {
    modules: MODULES,
    setup: mockUpdate,
    untouched: () => [prismaMock.contact.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    it("updates the contact and logs the update", async () => {
      const res = await patch();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Contact updated successfully",
        data: storedContact({ ...fullBody(), supplier_id: null }),
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.contact.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: {
          first_name: "Annie",
          last_name: "Lee",
          email: "annie@bettio.test",
          role: "Director",
          phone: "0411 111 111",
          preferred_contact_method: "phone",
          notes: "Updated",
          client_id: "client-1",
          supplier_id: null,
        },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "contact",
          entity_id: ID,
          action: "UPDATE",
          description: "Contact updated successfully: Annie Lee",
        },
      });
    });

    it("leaves omitted contact fields undefined so Prisma keeps them", async () => {
      await patch({ phone: "0422 222 222", client_id: "client-1" });

      const data = updateData();
      expect(data.phone).toBe("0422 222 222");
      expect(data.first_name).toBeUndefined();
      expect(data.email).toBeUndefined();
      expect(data.notes).toBeUndefined();
    });

    // Current behaviour (bug): client_id and supplier_id are always written.
    // A partial update that omits them detaches the contact from its
    // client/supplier by setting both to null.
    it("clears client_id and supplier_id when they are omitted", async () => {
      await patch({ phone: "0422 222 222" });

      expect(updateData()).toMatchObject({
        client_id: null,
        supplier_id: null,
      });
    });

    it("lowercases client_id but not supplier_id", async () => {
      await patch(
        fullBody({ client_id: "CLIENT-ABC", supplier_id: "SUP-ABC" }),
      );

      expect(updateData()).toMatchObject({
        client_id: "client-abc",
        supplier_id: "SUP-ABC",
      });
    });

    it("can move a contact from a client to a supplier", async () => {
      await patch(fullBody({ client_id: null, supplier_id: "supplier-1" }));

      expect(updateData()).toMatchObject({
        client_id: null,
        supplier_id: "supplier-1",
      });
    });

    // Current behaviour: no existence check, so a missing contact makes
    // prisma.update throw and the route answers 500 instead of 404.
    it("returns 500 when the contact does not exist", async () => {
      prismaMock.contact.update.mockRejectedValue(
        Object.assign(new Error("Record to update not found."), {
          code: "P2025",
        }),
      );

      const res = await patch();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 500 when client_id is not a string", async () => {
      const res = await patch(fullBody({ client_id: 42 }));

      expect(res.status).toBe(500);
      expect(prismaMock.contact.update).not.toHaveBeenCalled();
    });

    // Current behaviour: supplier-only users can edit client contacts.
    it("lets a user with only supplier_details edit a client contact", async () => {
      mockAuthorizedUser({
        userType: "manager",
        modules: ["supplier_details"],
      });

      const res = await patch(fullBody({ client_id: "client-1" }));

      expect(res.status).toBe(200);
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await patch();

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Update succeeded but logging failed",
      );
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
      expect(prismaMock.contact.update).not.toHaveBeenCalled();
    });
  });
});

describe("DELETE /api/v1/contact/[id]", () => {
  const del = (options) =>
    DELETE(buildRequest(URL, { method: "DELETE", ...options }), ctx());

  function mockDelete() {
    prismaMock.contact.delete.mockResolvedValue(storedContact());
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization(del, {
    modules: MODULES,
    setup: mockDelete,
    untouched: () => [prismaMock.contact.delete],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    // Note: contact has no is_deleted column, so this is a hard delete.
    it("deletes the contact and logs the deletion", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Contact deleted successfully",
      });
      expect(prismaMock.contact.delete).toHaveBeenCalledWith({
        where: { id: ID },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "contact",
          entity_id: ID,
          action: "DELETE",
          description: "Contact deleted successfully: Ann Lee",
        },
      });
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Contact deleted successfully",
        warning: "Note: Deletion succeeded but logging failed",
      });
    });

    // Current behaviour: no existence check, so a missing contact is a 500
    // instead of a 404.
    it("returns 500 when the contact does not exist", async () => {
      prismaMock.contact.delete.mockRejectedValue(
        Object.assign(new Error("Record to delete does not exist."), {
          code: "P2025",
        }),
      );

      const res = await del();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    // Current behaviour: supplier-only users can delete client contacts.
    it("lets a user with only supplier_details delete a client contact", async () => {
      mockAuthorizedUser({
        userType: "manager",
        modules: ["supplier_details"],
      });

      const res = await del();

      expect(res.status).toBe(200);
      expect(prismaMock.contact.delete).toHaveBeenCalled();
    });
  });
});
