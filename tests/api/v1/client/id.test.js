// Tests for src/app/api/v1/client/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET, PATCH, DELETE } = await import("@/app/api/v1/client/[id]/route");

const ID = "client-1";
const URL = `/api/v1/client/${ID}`;
const ctx = () => routeContext({ id: ID });

const storedClient = (overrides = {}) => ({
  client_id: ID,
  client_name: "Bettio Construction",
  client_slug: "BTTO",
  client_type: "builder",
  client_address: "1 Main St",
  client_phone: "0412 345 678",
  client_email: "info@bettio.test",
  client_website: null,
  client_notes: null,
  is_deleted: false,
  ...overrides,
});

// The select GET and PATCH use to return a client with its relations
const CLIENT_DETAIL_SELECT = {
  client_id: true,
  client_name: true,
  client_slug: true,
  client_type: true,
  client_address: true,
  client_phone: true,
  client_email: true,
  client_website: true,
  client_notes: true,
  contacts: true,
  projects: {
    where: { is_deleted: false },
    select: {
      id: true,
      project_id: true,
      name: true,
      createdAt: true,
      lots: {
        where: { is_deleted: false },
        select: {
          id: true,
          lot_id: true,
          name: true,
          status: true,
          startDate: true,
          installationDueDate: true,
          stages: { select: { name: true, status: true, createdAt: true } },
        },
      },
    },
  },
};

describe("GET /api/v1/client/[id]", () => {
  const get = (options) => GET(buildRequest(URL, options), ctx());

  describeAuthorization(get, {
    modules: "client_details",
    setup: () => prismaMock.client.findFirst.mockResolvedValue(storedClient()),
    untouched: () => [prismaMock.client.findFirst],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("returns the client with contacts and non-deleted projects/lots", async () => {
      const client = { ...storedClient(), contacts: [], projects: [] };
      delete client.is_deleted;
      prismaMock.client.findFirst.mockResolvedValue(client);

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Client fetched successfully",
        data: client,
      });
      expect(prismaMock.client.findFirst).toHaveBeenCalledWith({
        where: { client_id: ID, is_deleted: false },
        select: CLIENT_DETAIL_SELECT,
      });
    });

    it("returns 404 when the client does not exist or is deleted", async () => {
      prismaMock.client.findFirst.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Client not found",
      });
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.client.findFirst.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});

describe("PATCH /api/v1/client/[id]", () => {
  const validBody = (overrides = {}) => ({
    client_type: "builder",
    client_name: "Bettio Homes",
    client_slug: "btho",
    client_address: "2 New St",
    client_phone: "+61412345678",
    client_email: "hello@bettio.test",
    client_website: "https://bettio.test",
    client_notes: "Updated",
    ...overrides,
  });
  const patch = (body = validBody(), options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());

  function mockUpdate() {
    prismaMock.client.findFirst.mockResolvedValue(null);
    prismaMock.client.update.mockResolvedValue(storedClient());
    prismaMock.client.findUnique.mockResolvedValue(
      storedClient({ client_name: "Bettio Homes", contacts: [], projects: [] }),
    );
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization((options) => patch(validBody(), options), {
    modules: "client_details",
    setup: mockUpdate,
    untouched: () => [prismaMock.client.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    it("updates the client, returns it with relations and logs the update", async () => {
      const res = await patch();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Client updated successfully",
        data: expect.objectContaining({
          client_id: ID,
          client_name: "Bettio Homes",
        }),
      });
      expect(json.warning).toBeUndefined();

      expect(prismaMock.client.update).toHaveBeenCalledWith({
        where: { client_id: ID },
        data: {
          client_type: "builder",
          client_name: "Bettio Homes",
          client_slug: "BTHO",
          client_address: "2 New St",
          client_phone: "0412 345 678",
          client_email: "hello@bettio.test",
          client_website: "https://bettio.test",
          client_notes: "Updated",
        },
      });
      expect(prismaMock.client.findUnique).toHaveBeenCalledWith({
        where: { client_id: ID },
        select: CLIENT_DETAIL_SELECT,
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "client",
          entity_id: ID,
          action: "UPDATE",
          description: "Client updated successfully: Bettio Homes",
        },
      });
    });

    it("checks slug uniqueness against other clients only", async () => {
      await patch();

      expect(prismaMock.client.findFirst).toHaveBeenCalledWith({
        where: { client_slug: "BTHO", NOT: { client_id: ID } },
        select: { client_id: true },
      });
    });

    it("returns 409 when another client already uses the slug", async () => {
      prismaMock.client.findFirst.mockResolvedValue({ client_id: "other" });

      const res = await patch();

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        status: false,
        message: "Client slug is already taken",
      });
      expect(prismaMock.client.update).not.toHaveBeenCalled();
    });

    it.each([
      ["missing", undefined],
      ["too short", "ab"],
      ["empty", ""],
    ])("returns 400 when the slug is %s", async (_, slug) => {
      const res = await patch(validBody({ client_slug: slug }));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Client slug must be exactly 4 letters",
      });
      expect(prismaMock.client.update).not.toHaveBeenCalled();
    });

    // Current behaviour: every PATCH must resend the slug; a partial
    // update of other fields alone is rejected.
    it("rejects a partial update that omits the slug", async () => {
      const res = await patch({ client_notes: "Just a note" });

      expect(res.status).toBe(400);
      expect(prismaMock.client.update).not.toHaveBeenCalled();
    });

    it("passes omitted fields as undefined so Prisma leaves them unchanged", async () => {
      await patch({ client_slug: "BTTO", client_notes: "Only notes" });

      const { data } = prismaMock.client.update.mock.calls[0][0];
      expect(data.client_notes).toBe("Only notes");
      expect(data.client_name).toBeUndefined();
      expect(data.client_phone).toBeUndefined();
    });

    it("returns 200 with a warning when the update log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await patch();

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Update succeeded but logging failed",
      );
    });

    // Current behaviour: there is no existence check, so a missing client
    // makes prisma.update throw and the route answers 500 instead of 404.
    it("returns 500 when the client does not exist", async () => {
      prismaMock.client.update.mockRejectedValue(
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

    // Current behaviour: soft-deleted clients can still be edited.
    it("does not filter out soft-deleted clients", async () => {
      await patch();

      expect(prismaMock.client.update.mock.calls[0][0].where).toEqual({
        client_id: ID,
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
      expect(prismaMock.client.update).not.toHaveBeenCalled();
    });
  });
});

describe("DELETE /api/v1/client/[id]", () => {
  const del = (options) =>
    DELETE(buildRequest(URL, { method: "DELETE", ...options }), ctx());

  function mockDelete() {
    prismaMock.client.findUnique.mockResolvedValue(storedClient());
    prismaMock.client.update.mockResolvedValue(
      storedClient({ is_deleted: true }),
    );
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization(del, {
    modules: "client_details",
    setup: mockDelete,
    untouched: () => [prismaMock.client.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    it("soft deletes the client and logs the deletion", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Client deleted successfully",
        data: { ...storedClient(), is_deleted: true },
      });
      expect(json.warning).toBeUndefined();

      expect(prismaMock.client.findUnique).toHaveBeenCalledWith({
        where: { client_id: ID },
      });
      expect(prismaMock.client.update).toHaveBeenCalledWith({
        where: { client_id: ID },
        data: { is_deleted: true },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "client",
          entity_id: ID,
          action: "DELETE",
          description: "Client deleted successfully: Bettio Construction",
        },
      });
    });

    it("never hard deletes the record", async () => {
      await del();

      expect(prismaMock.client.delete).not.toHaveBeenCalled();
      expect(prismaMock.client.deleteMany).not.toHaveBeenCalled();
    });

    it("returns 404 when the client does not exist", async () => {
      prismaMock.client.findUnique.mockResolvedValue(null);

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Client not found",
      });
      expect(prismaMock.client.update).not.toHaveBeenCalled();
    });

    it("returns 400 when the client is already deleted", async () => {
      prismaMock.client.findUnique.mockResolvedValue(
        storedClient({ is_deleted: true }),
      );

      const res = await del();

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Client already deleted",
      });
      expect(prismaMock.client.update).not.toHaveBeenCalled();
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 200 with a warning when the deletion log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Client deleted successfully",
        data: { ...storedClient(), is_deleted: true },
        warning: "Note: Deletion succeeded but logging failed",
      });
    });

    it("returns 500 when the update fails", async () => {
      prismaMock.client.update.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });
  });
});
