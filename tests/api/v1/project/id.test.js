// Tests for src/app/api/v1/project/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET, PATCH, DELETE } = await import("@/app/api/v1/project/[id]/route");

const ID = "ikc-btto-0001";
const URL = `/api/v1/project/${ID}`;
const ctx = () => routeContext({ id: ID });

const storedProject = (overrides = {}) => ({
  project_id: ID,
  name: "Smith House",
  client_id: "client-1",
  is_deleted: false,
  ...overrides,
});

describe("GET /api/v1/project/[id]", () => {
  const get = (options) => GET(buildRequest(URL, options), ctx());

  describeAuthorization(get, {
    modules: "project_details",
    setup: () =>
      prismaMock.project.findFirst.mockResolvedValue(storedProject()),
    untouched: () => [prismaMock.project.findFirst],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.project.findFirst.mockResolvedValue(storedProject());
    });

    it("returns the project", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Project fetched successfully",
        data: storedProject(),
      });
    });

    it("looks up a non-deleted project by project_id", async () => {
      await get();

      const args = prismaMock.project.findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ project_id: ID, is_deleted: false });
    });

    it("includes the client and only non-deleted lots and MTOs", async () => {
      await get();

      const { include } = prismaMock.project.findFirst.mock.calls[0][0];
      expect(include.client).toBe(true);
      expect(include.lots).toEqual({ where: { is_deleted: false } });
      expect(include.materials_to_order.where).toEqual({ is_deleted: false });
      expect(include.materials_to_order.include.lots.where).toEqual({
        is_deleted: false,
      });
    });

    it("returns 404 when the project does not exist", async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Project not found",
      });
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.project.findFirst.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});

describe("PATCH /api/v1/project/[id]", () => {
  const patch = (body = { name: "Renamed" }, options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());

  function mockUpdate({ existing = storedProject(), clientFound = true } = {}) {
    prismaMock.project.findUnique.mockResolvedValue(existing);
    prismaMock.client.findFirst.mockImplementation(async ({ where }) =>
      clientFound ? { client_id: where.client_id } : null,
    );
    prismaMock.project.update.mockImplementation(async ({ data }) =>
      storedProject(data),
    );
    prismaMock.logs.create.mockResolvedValue({});
  }

  const updateData = () => prismaMock.project.update.mock.calls[0][0].data;

  describeAuthorization((options) => patch(undefined, options), {
    modules: "project_details",
    setup: () => mockUpdate(),
    untouched: () => [prismaMock.project.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    it("renames the project and logs the update", async () => {
      const res = await patch({ name: "Renamed" });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Project updated successfully",
        data: storedProject({ name: "Renamed", client_id: "client-1" }),
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { project_id: ID },
        data: { name: "Renamed", client_id: "client-1" },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "project",
          entity_id: ID,
          action: "UPDATE",
          description: "Project updated successfully: Renamed",
        },
      });
    });

    it("keeps the existing client when client_id is not sent", async () => {
      await patch({ name: "Renamed" });

      expect(prismaMock.client.findFirst).toHaveBeenCalledWith({
        where: { client_id: "client-1", is_deleted: false },
        select: { client_id: true },
      });
      expect(updateData().client_id).toBe("client-1");
    });

    it("does not change the name when only the client is sent", async () => {
      await patch({ client_id: "client-2" });

      expect(updateData()).toEqual({ client_id: "client-2" });
    });

    it.each([
      [true, true],
      [false, false],
    ])("sets sync_all_lots to %j on its own", async (input, stored) => {
      const res = await patch({ sync_all_lots: input });

      expect(res.status).toBe(200);
      expect(updateData()).toEqual({
        client_id: "client-1",
        sync_all_lots: stored,
      });
    });

    it("leaves sync_all_lots alone when it is not sent", async () => {
      await patch({ name: "Renamed" });

      expect(updateData()).not.toHaveProperty("sync_all_lots");
    });

    it("moves the project to another client, lowercasing the id for the lookup", async () => {
      await patch({ client_id: "CLIENT-2" });

      expect(prismaMock.client.findFirst).toHaveBeenCalledWith({
        where: { client_id: "client-2", is_deleted: false },
        select: { client_id: true },
      });
      expect(updateData().client_id).toBe("client-2");
    });

    it.each([
      ["null", null],
      ["an empty string", ""],
    ])("unlinks the client when client_id is %s", async (_, client_id) => {
      await patch({ client_id });

      expect(prismaMock.client.findFirst).not.toHaveBeenCalled();
      expect(updateData().client_id).toBeNull();
    });

    it("sets no client when the project had none and none is sent", async () => {
      mockUpdate({ existing: storedProject({ client_id: null }) });

      await patch({ name: "X" });

      expect(updateData().client_id).toBeNull();
    });

    it("never changes project_id", async () => {
      await patch({ name: "X", project_id: "hacked" });

      expect(updateData()).not.toHaveProperty("project_id");
      expect(prismaMock.project.update.mock.calls[0][0].where).toEqual({
        project_id: ID,
      });
    });

    it("returns 404 when the project does not exist", async () => {
      prismaMock.project.findUnique.mockResolvedValue(null);

      const res = await patch();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Project not found",
      });
      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });

    it("returns 404 when the new client does not exist", async () => {
      mockUpdate({ clientFound: false });

      const res = await patch({ client_id: "ghost" });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Client not found",
      });
      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });

    // Current behaviour: no is_deleted check, unlike GET and DELETE.
    it("still updates a soft-deleted project", async () => {
      mockUpdate({ existing: storedProject({ is_deleted: true }) });

      const res = await patch();

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

    it("returns 500 when the update fails", async () => {
      prismaMock.project.update.mockRejectedValue(new Error("DB down"));

      const res = await patch();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
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
      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });
  });
});

describe("DELETE /api/v1/project/[id]", () => {
  const del = (options) =>
    DELETE(buildRequest(URL, { method: "DELETE", ...options }), ctx());

  function mockDelete(existing = storedProject()) {
    prismaMock.project.findUnique.mockResolvedValue(existing);
    prismaMock.project.update.mockImplementation(async ({ data }) =>
      storedProject(data),
    );
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization(del, {
    modules: "project_details",
    setup: () => mockDelete(),
    untouched: () => [prismaMock.project.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    it("soft deletes the project and logs the deletion", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Project deleted successfully",
        data: storedProject({ is_deleted: true }),
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { project_id: ID },
        data: { is_deleted: true },
      });
      expect(prismaMock.project.delete).not.toHaveBeenCalled();
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "project",
          entity_id: ID,
          action: "DELETE",
          description: "Project deleted successfully: Smith House",
        },
      });
    });

    it("returns 404 when the project does not exist", async () => {
      mockDelete(null);

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Project not found",
      });
      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });

    it("returns 400 when the project is already deleted", async () => {
      mockDelete(storedProject({ is_deleted: true }));

      const res = await del();

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Project already deleted",
      });
      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Project deleted successfully",
        data: storedProject({ is_deleted: true }),
        warning: "Note: Deletion succeeded but logging failed",
      });
    });

    it("returns 500 when the update fails", async () => {
      prismaMock.project.update.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
