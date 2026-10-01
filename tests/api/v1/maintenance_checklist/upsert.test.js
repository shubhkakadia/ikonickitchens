// Tests for src/app/api/v1/maintenance_checklist/upsert/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { POST } =
  await import("@/app/api/v1/maintenance_checklist/upsert/route");

const URL = "/api/v1/maintenance_checklist/upsert";
const LOT_FILE_ID = "lot-file-1";

const validBody = (overrides = {}) => ({
  lot_file_id: LOT_FILE_ID,
  prepared_by_office: true,
  prepared_by_production: false,
  delivered_to_site: false,
  installed: false,
  ...overrides,
});

const post = (body = validBody(), options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

function mockUpsert({ existing = null } = {}) {
  prismaMock.maintenance_checklist.findUnique.mockResolvedValue(existing);
  prismaMock.maintenance_checklist.upsert.mockImplementation(
    async ({ create }) => ({ id: "checklist-1", ...create }),
  );
  prismaMock.logs.create.mockResolvedValue({});
}

describe("POST /api/v1/maintenance_checklist/upsert", () => {
  describeAuthorization((options) => post(undefined, options), {
    modules: "project_details",
    setup: () => mockUpsert(),
    untouched: () => [
      prismaMock.maintenance_checklist.findUnique,
      prismaMock.maintenance_checklist.upsert,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpsert();
    });

    it("creates the checklist when none exists and logs CREATE", async () => {
      const res = await post();

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({
        status: true,
        message: "Maintenance checklist upserted successfully",
        data: { id: "checklist-1", ...validBody() },
      });
      expect(prismaMock.maintenance_checklist.findUnique).toHaveBeenCalledWith({
        where: { lot_file_id: LOT_FILE_ID },
      });
      expect(prismaMock.maintenance_checklist.upsert).toHaveBeenCalledWith({
        where: { lot_file_id: LOT_FILE_ID },
        update: {
          prepared_by_office: true,
          prepared_by_production: false,
          delivered_to_site: false,
          installed: false,
        },
        create: validBody(),
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "maintenance_checklist",
          entity_id: "checklist-1",
          action: "CREATE",
          description:
            "Maintenance checklist upserted successfully: checklist-1",
        },
      });
    });

    it("logs UPDATE when a checklist already exists for the lot file", async () => {
      mockUpsert({ existing: { id: "checklist-1", lot_file_id: LOT_FILE_ID } });

      const res = await post(validBody({ installed: true }));

      // Current behaviour: an update also responds 201, not 200.
      expect(res.status).toBe(201);
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: "UPDATE" }),
      });
    });

    it("does not put lot_file_id in the update payload", async () => {
      await post();

      const { update } =
        prismaMock.maintenance_checklist.upsert.mock.calls[0][0];
      expect(update).not.toHaveProperty("lot_file_id");
    });

    it("ignores fields other than the checklist flags", async () => {
      await post({ ...validBody(), id: "forced-id", createdAt: "2000-01-01" });

      const args = prismaMock.maintenance_checklist.upsert.mock.calls[0][0];
      expect(args.create).toEqual(validBody());
      expect(args.update).not.toHaveProperty("id");
    });

    // Current behaviour: no validation; omitted flags are passed as undefined,
    // so on update Prisma leaves them unchanged and on create the DB default
    // (false) applies.
    it("passes omitted flags through as undefined", async () => {
      await post({ lot_file_id: LOT_FILE_ID });

      expect(prismaMock.maintenance_checklist.upsert).toHaveBeenCalledWith({
        where: { lot_file_id: LOT_FILE_ID },
        update: {
          prepared_by_office: undefined,
          prepared_by_production: undefined,
          delivered_to_site: undefined,
          installed: undefined,
        },
        create: {
          lot_file_id: LOT_FILE_ID,
          prepared_by_office: undefined,
          prepared_by_production: undefined,
          delivered_to_site: undefined,
          installed: undefined,
        },
      });
    });

    // Unlike most routes, a logging failure here fails the whole request,
    // even though the upsert has already been written.
    it("returns 500 when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await post();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.maintenance_checklist.upsert).toHaveBeenCalledOnce();
    });

    it("returns 500 when the existence lookup fails", async () => {
      prismaMock.maintenance_checklist.findUnique.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await post();

      expect(res.status).toBe(500);
      expect(prismaMock.maintenance_checklist.upsert).not.toHaveBeenCalled();
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 500 when the upsert fails", async () => {
      prismaMock.maintenance_checklist.upsert.mockRejectedValue(
        new Error("FK violation"),
      );

      const res = await post();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
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
      expect(prismaMock.maintenance_checklist.upsert).not.toHaveBeenCalled();
    });
  });
});
