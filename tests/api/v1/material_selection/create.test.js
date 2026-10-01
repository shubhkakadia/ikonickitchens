// Tests for src/app/api/v1/material_selection/create/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { POST } = await import("@/app/api/v1/material_selection/create/route");

const URL = "/api/v1/material_selection/create";
const LOT_ID = "LOT-1";

const post = (body = { lot_id: LOT_ID }, options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

const storedLot = () => ({
  lot_id: LOT_ID,
  name: "Lot 1",
  project: { name: "Smith Residence" },
});

// Primes every prisma call the happy path makes. By default the lot has no
// material_selection yet and no earlier versions.
function mockCreate({ existingSelection = null, latestVersion = null } = {}) {
  prismaMock.users.findUnique.mockResolvedValue({ id: "user-1" });
  prismaMock.lot.findUnique.mockResolvedValue(storedLot());
  prismaMock.project.findUnique.mockResolvedValue({ project_id: "PRJ-1" });
  prismaMock.quote.findUnique.mockResolvedValue({ quote_id: "Q-1" });
  prismaMock.material_selection.findUnique.mockResolvedValue(existingSelection);
  prismaMock.material_selection.create.mockImplementation(async ({ data }) => ({
    id: "ms-1",
    ...data,
  }));
  prismaMock.material_selection.update.mockImplementation(async ({ data }) => ({
    id: existingSelection?.id ?? "ms-1",
    ...existingSelection,
    ...data,
  }));
  prismaMock.lot.update.mockResolvedValue({});
  prismaMock.material_selection_versions.findFirst.mockResolvedValue(
    latestVersion,
  );
  prismaMock.material_selection_versions.updateMany.mockResolvedValue({
    count: 0,
  });
  prismaMock.material_selection_versions.create.mockImplementation(
    async ({ data }) => ({ id: "v-new", ...data }),
  );
  prismaMock.media.findMany.mockResolvedValue([]);
  prismaMock.logs.create.mockResolvedValue({});
}

const versionData = () =>
  prismaMock.material_selection_versions.create.mock.calls[0][0].data;

describe("POST /api/v1/material_selection/create", () => {
  describeAuthorization((options) => post(undefined, options), {
    modules: "project_details",
    setup: () => mockCreate(),
    untouched: () => [
      prismaMock.lot.findUnique,
      prismaMock.material_selection.create,
      prismaMock.material_selection_versions.create,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockCreate();
    });

    describe("first version for a lot", () => {
      it("creates the selection, links the lot, creates version 1 and logs", async () => {
        const res = await post({
          lot_id: LOT_ID,
          project_id: "PRJ-1",
          quote_id: "Q-1",
          notes: "Client wants matte",
        });

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.status).toBe(true);
        expect(json.message).toBe(
          "Material selection and version created successfully",
        );
        expect(json.warning).toBeUndefined();
        expect(json.data.version).toMatchObject({
          id: "v-new",
          version_number: 1,
          is_current: true,
          quote_id: "Q-1",
          notes: "Client wants matte",
        });
        expect(json.data.material_selection).toMatchObject({
          id: "ms-1",
          media: [],
        });

        expect(prismaMock.material_selection.create).toHaveBeenCalledWith({
          data: {
            lot_id: LOT_ID,
            project_id: "PRJ-1",
            quote_id: "Q-1",
            createdBy_id: "user-1",
          },
        });
        expect(prismaMock.lot.update).toHaveBeenCalledWith({
          where: { lot_id: LOT_ID },
          data: { material_selection_id: "ms-1" },
        });
        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: {
            user_id: "user-1",
            entity_type: "material_selection",
            entity_id: "ms-1",
            action: "CREATE",
            description:
              "Material selection and version created successfully for lot: Lot 1 for project: Smith Residence",
          },
        });
      });

      it("stores null project and quote when they are not provided", async () => {
        await post({ lot_id: LOT_ID });

        expect(prismaMock.material_selection.create).toHaveBeenCalledWith({
          data: {
            lot_id: LOT_ID,
            project_id: null,
            quote_id: null,
            createdBy_id: "user-1",
          },
        });
        expect(prismaMock.project.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.quote.findUnique).not.toHaveBeenCalled();
      });

      it("takes createdBy from the session, not the request body", async () => {
        await post({ lot_id: LOT_ID, createdBy_id: "attacker" });

        expect(
          prismaMock.material_selection.create.mock.calls[0][0].data
            .createdBy_id,
        ).toBe("user-1");
      });

      it("makes the new version current and points the selection at it", async () => {
        await post();

        expect(
          prismaMock.material_selection_versions.updateMany,
        ).toHaveBeenCalledWith({
          where: { material_selection_id: "ms-1", is_current: true },
          data: { is_current: false },
        });
        expect(prismaMock.material_selection.update).toHaveBeenCalledWith({
          where: { id: "ms-1" },
          data: { current_version_id: "v-new" },
        });
      });

      it("runs the writes inside a transaction", async () => {
        await post();

        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
      });
    });

    describe("subsequent versions", () => {
      const existing = () => ({
        id: "ms-1",
        lot_id: LOT_ID,
        project_id: "PRJ-OLD",
        quote_id: "Q-OLD",
        createdBy_id: "original-creator",
      });

      beforeEach(() => {
        mockCreate({
          existingSelection: existing(),
          latestVersion: { version_number: 3 },
        });
      });

      it("reuses the existing selection and increments the version number", async () => {
        await post();

        expect(prismaMock.material_selection.create).not.toHaveBeenCalled();
        expect(prismaMock.lot.update).not.toHaveBeenCalled();
        expect(versionData().version_number).toBe(4);
        expect(versionData().material_selection_id).toBe("ms-1");
        expect(
          prismaMock.material_selection_versions.findFirst,
        ).toHaveBeenCalledWith({
          where: { material_selection_id: "ms-1" },
          orderBy: { version_number: "desc" },
          select: { version_number: true },
        });
      });

      it("does not touch the selection when neither project_id nor quote_id is sent", async () => {
        await post({ lot_id: LOT_ID });

        // only the current_version_id update, never a project/quote update
        const updates = prismaMock.material_selection.update.mock.calls.map(
          ([args]) => args.data,
        );
        expect(updates).toEqual([{ current_version_id: "v-new" }]);
      });

      it("updates project_id and quote_id when provided, without changing createdBy", async () => {
        await post({ lot_id: LOT_ID, project_id: "PRJ-1", quote_id: "Q-1" });

        const first = prismaMock.material_selection.update.mock.calls[0][0];
        expect(first).toEqual({
          where: { id: "ms-1" },
          data: { project_id: "PRJ-1", quote_id: "Q-1" },
        });
      });

      // Current behaviour: an explicit null quote_id unlinks the quote.
      it("unlinks the quote from the selection when quote_id is null", async () => {
        await post({ lot_id: LOT_ID, quote_id: null });

        const first = prismaMock.material_selection.update.mock.calls[0][0];
        expect(first.data).toEqual({ quote_id: null });
      });

      it("returns the updated selection in the response", async () => {
        const res = await post({ lot_id: LOT_ID, project_id: "PRJ-1" });

        const json = await res.json();
        expect(json.data.material_selection.id).toBe("ms-1");
        expect(json.data.material_selection.createdBy_id).toBe(
          "original-creator",
        );
      });
    });

    describe("is_current", () => {
      it("defaults to true", async () => {
        await post();

        expect(versionData().is_current).toBe(true);
      });

      it("leaves the other versions and the pointer alone when false", async () => {
        const res = await post({ lot_id: LOT_ID, is_current: false });

        expect(res.status).toBe(201);
        expect(versionData().is_current).toBe(false);
        expect(
          prismaMock.material_selection_versions.updateMany,
        ).not.toHaveBeenCalled();
        expect(prismaMock.material_selection.update).not.toHaveBeenCalled();
      });
    });

    describe("version fields", () => {
      it("converts missing and empty heights to null", async () => {
        await post({
          lot_id: LOT_ID,
          ceiling_height: "",
          bulkhead_height: null,
          // kicker_height omitted
          cabinetry_height: "",
        });

        expect(versionData()).toMatchObject({
          ceiling_height: null,
          bulkhead_height: null,
          kicker_height: null,
          cabinetry_height: null,
        });
      });

      it("keeps provided heights, including zero", async () => {
        await post({
          lot_id: LOT_ID,
          ceiling_height: 2700,
          bulkhead_height: "300.50",
          kicker_height: 0,
          cabinetry_height: 900,
        });

        expect(versionData()).toMatchObject({
          ceiling_height: 2700,
          bulkhead_height: "300.50",
          kicker_height: 0,
          cabinetry_height: 900,
        });
      });

      it("stores empty notes as null", async () => {
        await post({ lot_id: LOT_ID, notes: "" });

        expect(versionData().notes).toBeNull();
      });
    });

    describe("areas and items", () => {
      it("omits the areas key when there are no areas", async () => {
        await post({ lot_id: LOT_ID, areas: [] });

        expect(versionData()).not.toHaveProperty("areas");
      });

      it("creates nested areas and items with defaults applied", async () => {
        await post({
          lot_id: LOT_ID,
          areas: [
            {
              area_name: "Kitchen",
              area_instance_id: 2,
              bed_option: "Queen",
              notes: "Island",
              items: [
                {
                  name: "Benchtop",
                  category: "Stone",
                  is_applicable: true,
                  item_notes: "20mm",
                },
                { name: "Handles" },
              ],
            },
            { area_name: "Laundry" },
          ],
        });

        expect(versionData().areas).toEqual({
          create: [
            {
              area_name: "Kitchen",
              area_instance_id: 2,
              bed_option: "Queen",
              notes: "Island",
              items: {
                create: [
                  {
                    name: "Benchtop",
                    category: "Stone",
                    is_applicable: true,
                    item_notes: "20mm",
                  },
                  {
                    name: "Handles",
                    category: null,
                    is_applicable: false,
                    item_notes: null,
                  },
                ],
              },
            },
            {
              area_name: "Laundry",
              area_instance_id: 1,
              bed_option: null,
              notes: null,
            },
          ],
        });
      });

      it("keeps is_applicable: false when explicitly sent", async () => {
        await post({
          lot_id: LOT_ID,
          areas: [
            {
              area_name: "Kitchen",
              items: [{ name: "X", is_applicable: false }],
            },
          ],
        });

        expect(
          versionData().areas.create[0].items.create[0].is_applicable,
        ).toBe(false);
      });

      it("asks Prisma to return the version with areas and items", async () => {
        await post();

        expect(
          prismaMock.material_selection_versions.create.mock.calls[0][0]
            .include,
        ).toEqual({ areas: { include: { items: true } } });
      });

      it("returns 400 naming the area that has no area_name", async () => {
        const res = await post({
          lot_id: LOT_ID,
          areas: [{ area_name: "Kitchen" }, { notes: "oops" }],
        });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Area at index 1 is missing required field: area_name",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it("returns 400 naming the item that has no name", async () => {
        const res = await post({
          lot_id: LOT_ID,
          areas: [{ area_name: "Kitchen", items: [{ name: "A" }, {}] }],
        });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            'Item at index 1 in area "Kitchen" is missing required field: name',
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      // Current behaviour: null skips validation but areas.map then throws.
      it("returns 500 when areas is null", async () => {
        const res = await post({ lot_id: LOT_ID, areas: null });

        expect(res.status).toBe(500);
        expect(
          prismaMock.material_selection_versions.create,
        ).not.toHaveBeenCalled();
      });
    });

    describe("validation and lookups", () => {
      it("returns 401 when the session cannot be re-read", async () => {
        const session = mockMasterAdmin();
        prismaMock.sessions.findUnique
          .mockReset()
          .mockResolvedValueOnce(session)
          .mockResolvedValueOnce(null);

        const res = await post();

        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({
          status: false,
          message: "Invalid session",
        });
        expect(prismaMock.users.findUnique).not.toHaveBeenCalled();
      });

      it("returns 404 when the session user no longer exists", async () => {
        prismaMock.users.findUnique.mockResolvedValue(null);

        const res = await post();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "User not found with id: user-1",
        });
        expect(prismaMock.lot.findUnique).not.toHaveBeenCalled();
      });

      it("returns 400 when lot_id is missing", async () => {
        const res = await post({});

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "lot_id is required",
        });
        expect(prismaMock.lot.findUnique).not.toHaveBeenCalled();
      });

      it("returns 404 when the lot does not exist", async () => {
        prismaMock.lot.findUnique.mockResolvedValue(null);

        const res = await post();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Lot not found with id: LOT-1",
        });
        expect(prismaMock.lot.findUnique).toHaveBeenCalledWith({
          where: { lot_id: LOT_ID },
          include: { project: true },
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it("returns 404 when the project does not exist", async () => {
        prismaMock.project.findUnique.mockResolvedValue(null);

        const res = await post({ lot_id: LOT_ID, project_id: "PRJ-X" });

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Project not found with id: PRJ-X",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it("returns 404 when the quote does not exist", async () => {
        prismaMock.quote.findUnique.mockResolvedValue(null);

        const res = await post({ lot_id: LOT_ID, quote_id: "Q-X" });

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Quote not found with id: Q-X",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });
    });

    describe("failures", () => {
      it("returns 201 with a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await post();

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.warning).toBe(
          "Note: Creation succeeded but logging failed",
        );
        expect(json.data.version.id).toBe("v-new");
      });

      it("returns 500 when the transaction fails", async () => {
        prismaMock.material_selection_versions.create.mockRejectedValue(
          new Error("unique constraint"),
        );

        const res = await post();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
        expect(prismaMock.media.findMany).not.toHaveBeenCalled();
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 when fetching media fails", async () => {
        prismaMock.media.findMany.mockRejectedValue(new Error("DB down"));

        const res = await post();

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
        expect(prismaMock.lot.findUnique).not.toHaveBeenCalled();
      });
    });

    it("fetches only non-deleted media for the selection", async () => {
      await post();

      expect(prismaMock.media.findMany).toHaveBeenCalledWith({
        where: { material_selection_id: "ms-1", is_deleted: false },
      });
    });
  });
});
