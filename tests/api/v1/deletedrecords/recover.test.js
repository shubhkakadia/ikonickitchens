import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { PATCH } = await import("@/app/api/v1/deletedrecords/recover/route");

const URL = "/api/v1/deletedrecords/recover";
const patch = (body, options = {}) =>
  PATCH(buildRequest(URL, { method: "PATCH", body, ...options }));

// entity_type -> how the route looks the record up and what it logs
const ENTITIES = [
  {
    type: "client",
    model: "client",
    where: { client_id: "rec-1" },
    row: { client_id: "rec-1", client_name: "Bettio", is_deleted: true },
    loggedId: "rec-1",
    notFound: "Client not found",
  },
  {
    type: "project",
    model: "project",
    where: { id: "rec-1" },
    row: { id: "rec-1", project_id: "PRJ-1", is_deleted: true },
    loggedId: "PRJ-1",
    notFound: "Project not found",
  },
  {
    type: "lot",
    model: "lot",
    where: { id: "rec-1" },
    row: { id: "rec-1", lot_id: "LOT-1", is_deleted: true },
    loggedId: "LOT-1",
    notFound: "Lot not found",
  },
  {
    type: "item",
    model: "item",
    where: { item_id: "rec-1" },
    row: { item_id: "rec-1", is_deleted: true },
    loggedId: "rec-1",
    notFound: "Item not found",
  },
  {
    type: "supplier",
    model: "supplier",
    where: { supplier_id: "rec-1" },
    row: { supplier_id: "rec-1", name: "Blum", is_deleted: true },
    loggedId: "rec-1",
    notFound: "Supplier not found",
  },
];

const employeeRow = (overrides = {}) => ({
  id: "rec-1",
  employee_id: "EMP-7",
  image_id: "img-1",
  is_deleted: true,
  ...overrides,
});

function mockAll() {
  for (const e of ENTITIES) {
    prismaMock[e.model].findUnique.mockResolvedValue(e.row);
    prismaMock[e.model].update.mockImplementation(async ({ data }) => ({
      ...e.row,
      ...data,
    }));
  }
  prismaMock.employees.findUnique.mockResolvedValue(employeeRow());
  prismaMock.employees.update.mockImplementation(async ({ data }) => ({
    ...employeeRow(),
    ...data,
  }));
  prismaMock.media.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.logs.create.mockResolvedValue({});
}

describe("PATCH /api/v1/deletedrecords/recover", () => {
  describeAuthorization(
    (options) => patch({ id: "rec-1", entity_type: "client" }, options),
    {
      modules: "delete_media",
      setup: mockAll,
      untouched: () => [prismaMock.client.update],
    },
  );

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockAll();
    });

    describe.each(ENTITIES)("entity_type '$type'", (e) => {
      it("clears is_deleted, returns the record and logs the recovery", async () => {
        const res = await patch({ id: "rec-1", entity_type: e.type });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json).toEqual({
          status: true,
          message: `${e.type} recovered successfully`,
          data: { ...e.row, is_deleted: false },
        });
        expect(json.warning).toBeUndefined();
        expect(prismaMock[e.model].findUnique).toHaveBeenCalledWith({
          where: e.where,
        });
        expect(prismaMock[e.model].update).toHaveBeenCalledWith({
          where: e.where,
          data: { is_deleted: false },
        });
        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: {
            user_id: "user-1",
            entity_type: e.type,
            entity_id: e.loggedId,
            action: "UPDATE",
            description: `${e.type} recovered successfully`,
          },
        });
      });

      it("returns 404 when the record does not exist", async () => {
        prismaMock[e.model].findUnique.mockResolvedValue(null);

        const res = await patch({ id: "rec-1", entity_type: e.type });

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: e.notFound,
        });
        expect(prismaMock[e.model].update).not.toHaveBeenCalled();
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 when the update fails", async () => {
        prismaMock[e.model].update.mockRejectedValue(new Error("DB down"));

        const res = await patch({ id: "rec-1", entity_type: e.type });

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });
    });

    describe("entity_type 'employee'", () => {
      it("restores the employee and their soft-deleted photo in one transaction", async () => {
        const res = await patch({ id: "rec-1", entity_type: "employee" });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "employee recovered successfully",
          data: { ...employeeRow(), is_deleted: false },
        });
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(prismaMock.media.updateMany).toHaveBeenCalledWith({
          where: { id: "img-1", is_deleted: true },
          data: { is_deleted: false },
        });
        expect(prismaMock.employees.update).toHaveBeenCalledWith({
          where: { id: "rec-1" },
          data: { is_deleted: false },
        });
        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            entity_type: "employee",
            entity_id: "EMP-7",
            action: "UPDATE",
          }),
        });
      });

      it("skips the photo when the employee has none", async () => {
        prismaMock.employees.findUnique.mockResolvedValue(
          employeeRow({ image_id: null }),
        );

        const res = await patch({ id: "rec-1", entity_type: "employee" });

        expect(res.status).toBe(200);
        expect(prismaMock.media.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.employees.update).toHaveBeenCalled();
      });

      it("returns 404 when the employee does not exist", async () => {
        prismaMock.employees.findUnique.mockResolvedValue(null);

        const res = await patch({ id: "rec-1", entity_type: "employee" });

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Employee not found",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it("returns 500 and writes no log when the transaction fails", async () => {
        prismaMock.employees.update.mockRejectedValue(new Error("DB down"));

        const res = await patch({ id: "rec-1", entity_type: "employee" });

        expect(res.status).toBe(500);
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });
    });

    // Current behaviour: is_deleted is not checked, so "recovering" an
    // active record succeeds and writes a misleading log entry.
    it("recovers a record that was never deleted", async () => {
      prismaMock.client.findUnique.mockResolvedValue({
        client_id: "rec-1",
        is_deleted: false,
      });

      const res = await patch({ id: "rec-1", entity_type: "client" });

      expect(res.status).toBe(200);
      expect(prismaMock.client.update).toHaveBeenCalled();
      expect(prismaMock.logs.create).toHaveBeenCalled();
    });

    // Current behaviour: recovery touches only the one record. Recovering a
    // project leaves its deleted lots deleted, and a lot can be recovered
    // while its project is still deleted.
    it("recovers a project without touching its lots", async () => {
      await patch({ id: "rec-1", entity_type: "project" });

      expect(prismaMock.lot.update).not.toHaveBeenCalled();
      expect(prismaMock.lot.updateMany).not.toHaveBeenCalled();
    });

    it("recovers a lot without checking its project", async () => {
      await patch({ id: "rec-1", entity_type: "lot" });

      expect(prismaMock.project.findUnique).not.toHaveBeenCalled();
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await patch({ id: "rec-1", entity_type: "supplier" });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe(true);
      expect(json.warning).toBe("Note: Recovery succeeded but logging failed");
    });

    it.each([
      ["id is missing", { entity_type: "client" }],
      ["entity_type is missing", { id: "rec-1" }],
      ["id is empty", { id: "", entity_type: "client" }],
      ["the body is empty", {}],
    ])("returns 400 when %s", async (_, body) => {
      const res = await patch(body);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "ID and entity type are required",
      });
    });

    it.each(["contact", "Client", "media", "lot_file"])(
      "returns 400 for unsupported entity_type %j",
      async (entity_type) => {
        const res = await patch({ id: "rec-1", entity_type });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Invalid entity type",
        });
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      },
    );

    it("returns 500 when the lookup fails", async () => {
      prismaMock.lot.findUnique.mockRejectedValue(new Error("DB down"));

      const res = await patch({ id: "rec-1", entity_type: "lot" });

      expect(res.status).toBe(500);
      expect(prismaMock.lot.update).not.toHaveBeenCalled();
    });

    it("returns 500 for a malformed JSON body", async () => {
      const res = await PATCH(
        buildRequest(URL, {
          method: "PATCH",
          rawBody: "{not json",
          headers: { "content-type": "application/json" },
        }),
      );

      expect(res.status).toBe(500);
    });
  });
});
