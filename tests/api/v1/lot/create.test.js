import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { POST } = await import("@/app/api/v1/lot/create/route");

const URL = "/api/v1/lot/create";
const validBody = (overrides = {}) => ({
  lot_id: "bttO-001-l1",
  name: "Kitchen",
  project_id: "BTTO-001",
  startDate: "2026-03-01",
  installationDueDate: "2026-04-15",
  notes: "Rush job",
  ...overrides,
});
const post = (body = validBody(), options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

function mockCreate() {
  prismaMock.lot.findUnique.mockResolvedValue(null);
  prismaMock.lot.create.mockImplementation(async ({ data }) => ({
    id: "lot-uuid",
    ...data,
    project: { project_id: data.project_id, name: "Smith House" },
  }));
  prismaMock.logs.create.mockResolvedValue({});
}

const createArgs = () => prismaMock.lot.create.mock.calls[0][0];

describe("POST /api/v1/lot/create", () => {
  describeAuthorization((options) => post(validBody(), options), {
    modules: "project_details",
    setup: mockCreate,
    untouched: () => [prismaMock.lot.create],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockCreate();
    });

    it("creates an ACTIVE lot with lowercased ids and parsed dates", async () => {
      const res = await post();

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.status).toBe(true);
      expect(json.message).toBe("Lot created successfully");
      expect(json.warning).toBeUndefined();
      expect(json.data).toMatchObject({
        id: "lot-uuid",
        lot_id: "btto-001-l1",
        project: { name: "Smith House" },
      });

      expect(createArgs()).toEqual({
        data: {
          lot_id: "btto-001-l1",
          name: "Kitchen",
          project_id: "btto-001",
          startDate: new Date("2026-03-01"),
          installationDueDate: new Date("2026-04-15"),
          notes: "Rush job",
          status: "ACTIVE",
        },
        include: { project: true },
      });
    });

    it("logs the creation against the lot_id with the project name", async () => {
      await post();

      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "lot",
          entity_id: "btto-001-l1",
          action: "CREATE",
          description:
            "Lot created successfully: Kitchen for project: Smith House",
        },
      });
    });

    it("checks for an existing lot using the lowercased lot_id", async () => {
      await post();

      expect(prismaMock.lot.findUnique).toHaveBeenCalledWith({
        where: { lot_id: "btto-001-l1" },
      });
    });

    it("URL-decodes lot_id and project_id", async () => {
      await post(
        validBody({ lot_id: "BTTO%20001%2FL1", project_id: "BTTO%20001" }),
      );

      expect(createArgs().data).toMatchObject({
        lot_id: "btto 001/l1",
        project_id: "btto 001",
      });
    });

    it("always starts the lot as ACTIVE, ignoring a status in the body", async () => {
      await post(validBody({ status: "COMPLETED" }));

      expect(createArgs().data.status).toBe("ACTIVE");
    });

    it("ignores fields such as installer_id and is_deleted", async () => {
      await post(validBody({ installer_id: "EMP-1", is_deleted: true }));

      expect(createArgs().data).not.toHaveProperty("installer_id");
      expect(createArgs().data).not.toHaveProperty("is_deleted");
    });

    it.each([
      ["omitted", undefined],
      ["empty", ""],
      ["null", null],
    ])("stores null dates when they are %s", async (_, date) => {
      await post(validBody({ startDate: date, installationDueDate: date }));

      expect(createArgs().data.startDate).toBeNull();
      expect(createArgs().data.installationDueDate).toBeNull();
    });

    it("stores null for an unparseable date", async () => {
      await post(validBody({ startDate: "next tuesday" }));

      expect(createArgs().data.startDate).toBeNull();
    });

    it("returns 409 when the lot_id already exists", async () => {
      prismaMock.lot.findUnique.mockResolvedValue({ id: "other" });

      const res = await post();

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        status: false,
        message: "Lot already exists by this lot id: btto-001-l1",
      });
      expect(prismaMock.lot.create).not.toHaveBeenCalled();
    });

    // Current behaviour (bug): decodeURIComponent(undefined) is the string
    // "undefined", so a missing lot_id / project_id is stored literally.
    it("creates a lot with lot_id 'undefined' when lot_id is missing", async () => {
      const res = await post(validBody({ lot_id: undefined }));

      expect(res.status).toBe(201);
      expect(createArgs().data.lot_id).toBe("undefined");
    });

    it("uses project_id 'undefined' when project_id is missing", async () => {
      await post(validBody({ project_id: undefined }));

      expect(createArgs().data.project_id).toBe("undefined");
    });

    // Current behaviour: the project is not looked up, so an unknown or
    // soft-deleted project is only caught by the foreign key (500).
    it("does not check that the project exists", async () => {
      await post();

      expect(prismaMock.project.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.project.findFirst).not.toHaveBeenCalled();
    });

    it("returns 500 when the create fails (e.g. unknown project)", async () => {
      prismaMock.lot.create.mockRejectedValue(
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

    it("returns 500 for an id that is not valid URL encoding", async () => {
      const res = await post(validBody({ lot_id: "100%" }));

      expect(res.status).toBe(500);
      expect(prismaMock.lot.create).not.toHaveBeenCalled();
    });

    it("returns 201 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await post();

      expect(res.status).toBe(201);
      expect((await res.json()).warning).toBe(
        "Note: Creation succeeded but logging failed",
      );
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
      expect(prismaMock.lot.create).not.toHaveBeenCalled();
    });
  });
});
