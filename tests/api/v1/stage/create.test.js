// Tests for src/app/api/v1/stage/create/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

// sendNotification sends real WhatsApp messages; never call it in tests.
vi.mock("@/lib/notification", () => ({ sendNotification: vi.fn() }));

const { POST } = await import("@/app/api/v1/stage/create/route");
const { sendNotification } = await import("@/lib/notification");

const URL = "/api/v1/stage/create";
const validBody = (overrides = {}) => ({
  lot_id: "BTTO-001-L1",
  name: "Drafting",
  status: "NOT_STARTED",
  ...overrides,
});
const post = (body = validBody(), options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

const LOT_START = new Date("2026-03-01T00:00:00.000Z");
const LOT_DUE = new Date("2026-04-01T00:00:00.000Z");
const datedLot = () => ({ startDate: LOT_START, installationDueDate: LOT_DUE });

const completeStage = (overrides = {}) => ({
  stage_id: "stage-1",
  lot_id: "btto-001-l1",
  name: "drafting",
  status: "NOT_STARTED",
  lot: { project: { name: "Smith House", client: { client_name: "Acme" } } },
  assigned_to: [],
  ...overrides,
});

function mockCreate({ lot = datedLot(), complete = completeStage() } = {}) {
  prismaMock.lot.findUnique.mockResolvedValue(lot);
  prismaMock.stage.create.mockResolvedValue({ stage_id: "stage-1" });
  prismaMock.stage_employee.createMany.mockResolvedValue({ count: 0 });
  prismaMock.stage.findUnique.mockResolvedValue(complete);
  prismaMock.logs.create.mockResolvedValue({});
}

const createData = () => prismaMock.stage.create.mock.calls[0][0].data;

describe("POST /api/v1/stage/create", () => {
  describeAuthorization((options) => post(undefined, options), {
    modules: ["project_details", "lotatglance", "site_measurements"],
    setup: () => mockCreate(),
    untouched: () => [prismaMock.stage.create, prismaMock.$transaction],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockCreate();
    });

    describe("creating a stage", () => {
      it("creates the stage and logs it", async () => {
        const res = await post(validBody({ notes: "First pass" }));

        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({
          status: true,
          message: "Stage created successfully",
          data: completeStage(),
        });
        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: {
            user_id: "user-1",
            entity_type: "stage",
            entity_id: "stage-1",
            action: "CREATE",
            description:
              "Stage created successfully: drafting for lot: btto-001-l1 and project: Smith House",
          },
        });
      });

      it("lowercases the lot id and stage name", async () => {
        await post();

        expect(createData()).toMatchObject({
          lot_id: "btto-001-l1",
          name: "drafting",
          status: "NOT_STARTED",
          startDate: null,
          endDate: null,
        });
      });

      it("passes the status and notes through", async () => {
        await post(validBody({ status: "IN_PROGRESS", notes: "n" }));

        expect(createData()).toMatchObject({
          status: "IN_PROGRESS",
          notes: "n",
        });
      });

      it("runs in a transaction and re-reads the stage with its relations", async () => {
        await post();

        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
        expect(prismaMock.stage.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({ where: { stage_id: "stage-1" } }),
        );
      });
    });

    describe("employee assignments", () => {
      it("assigns the listed employees, skipping duplicates", async () => {
        await post(validBody({ assigned_to: ["emp-1", "emp-2"] }));

        expect(prismaMock.stage_employee.createMany).toHaveBeenCalledWith({
          data: [
            { stage_id: "stage-1", employee_id: "emp-1" },
            { stage_id: "stage-1", employee_id: "emp-2" },
          ],
          skipDuplicates: true,
        });
      });

      it.each([
        ["omitted", undefined],
        ["empty", []],
        ["null", null],
      ])("assigns nobody when assigned_to is %s", async (_, assigned_to) => {
        await post(validBody({ assigned_to }));

        expect(prismaMock.stage_employee.createMany).not.toHaveBeenCalled();
      });
    });

    describe("dates", () => {
      it("stores the dates when they are inside the lot's range", async () => {
        const res = await post(
          validBody({ startDate: "2026-03-05", endDate: "2026-03-20" }),
        );

        expect(res.status).toBe(201);
        expect(createData().startDate).toEqual(new Date("2026-03-05"));
        expect(createData().endDate).toEqual(new Date("2026-03-20"));
      });

      it("looks the lot up by its lowercased id", async () => {
        await post(validBody({ startDate: "2026-03-05" }));

        expect(prismaMock.lot.findUnique).toHaveBeenCalledWith({
          where: { lot_id: "btto-001-l1" },
          select: { startDate: true, installationDueDate: true },
        });
      });

      it("does not run the date-range lookup when no dates are sent", async () => {
        await post();

        expect(prismaMock.lot.findUnique).not.toHaveBeenCalledWith({
          where: { lot_id: "btto-001-l1" },
          select: { startDate: true, installationDueDate: true },
        });
      });

      it("accepts dates exactly on the lot's boundaries", async () => {
        const res = await post(
          validBody({
            startDate: LOT_START.toISOString(),
            endDate: LOT_DUE.toISOString(),
          }),
        );

        expect(res.status).toBe(201);
      });

      it("accepts a start date alone or an end date alone", async () => {
        expect(
          (await post(validBody({ startDate: "2026-03-05" }))).status,
        ).toBe(201);
        expect((await post(validBody({ endDate: "2026-03-20" }))).status).toBe(
          201,
        );
      });

      it("treats empty date strings as no date", async () => {
        const res = await post(validBody({ startDate: "", endDate: "  " }));

        // "  " is truthy so it triggers the lot check, but is stored as null
        expect(res.status).toBe(201);
        expect(createData().startDate).toBeNull();
        expect(createData().endDate).toBeNull();
      });

      it("stores an unparseable date as null", async () => {
        await post(validBody({ startDate: "not a date" }));

        // new Date("not a date") is Invalid Date: both comparisons are false
        expect(createData().startDate).toBeNull();
      });

      it.each([
        ["the lot does not exist", null],
        [
          "the lot has no start date",
          { startDate: null, installationDueDate: LOT_DUE },
        ],
        [
          "the lot has no installation due date",
          { startDate: LOT_START, installationDueDate: null },
        ],
      ])("returns 400 when %s", async (_, lot) => {
        mockCreate({ lot });

        const res = await post(validBody({ startDate: "2026-03-05" }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Set the parent lot start and installation due dates before scheduling a stage",
        });
        expect(prismaMock.stage.create).not.toHaveBeenCalled();
      });

      it.each([
        ["starts before the lot", { startDate: "2026-02-28" }],
        ["ends after the lot's due date", { endDate: "2026-04-02" }],
      ])("returns 400 when the stage %s", async (_, dates) => {
        const res = await post(validBody(dates));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Stage dates must stay within the parent lot date range",
        });
        expect(prismaMock.stage.create).not.toHaveBeenCalled();
      });

      // Current behaviour: only the lot bounds are checked, not start <= end.
      it("accepts an end date before the start date", async () => {
        const res = await post(
          validBody({ startDate: "2026-03-20", endDate: "2026-03-05" }),
        );

        expect(res.status).toBe(201);
      });

      // Current behaviour: the lot is not checked when no dates are sent, so a
      // stage can be created for a lot that does not exist (the database
      // foreign key is the only guard, giving a 500).
      it("returns 500 when the lot does not exist and no dates are sent", async () => {
        prismaMock.stage.create.mockRejectedValue(new Error("FK violation"));

        const res = await post();

        expect(res.status).toBe(500);
      });
    });

    describe("sync_all_lots", () => {
      const sibling = (lot_id, overrides = {}) => ({
        lot_id,
        name: lot_id,
        ...datedLot(),
        ...overrides,
      });

      // Project lookup returns the sync flag; the date-range lookup keeps
      // returning the (dated) source lot.
      function mockSync({ sync = true, siblings = [], existing = {} } = {}) {
        prismaMock.lot.findUnique.mockImplementation(async (args) =>
          args?.select?.project
            ? { project: { project_id: "btto-001", sync_all_lots: sync } }
            : datedLot(),
        );
        prismaMock.lot.findMany.mockResolvedValue(siblings);
        prismaMock.stage.findFirst.mockImplementation(async ({ where }) =>
          existing[where.lot_id]
            ? { stage_id: existing[where.lot_id] }
            : null,
        );
      }

      it("does nothing extra when the project does not sync", async () => {
        mockSync({ sync: false });

        const res = await post();

        expect(prismaMock.lot.findMany).not.toHaveBeenCalled();
        expect(prismaMock.stage.create).toHaveBeenCalledTimes(1);
        expect((await res.json()).sync).toBeUndefined();
      });

      it("looks up the other non-deleted lots of the project", async () => {
        mockSync({ siblings: [sibling("btto-001-l2")] });

        await post();

        expect(prismaMock.lot.findMany).toHaveBeenCalledWith({
          where: {
            project_id: "btto-001",
            is_deleted: false,
            lot_id: { not: "btto-001-l1" },
          },
          select: {
            lot_id: true,
            name: true,
            startDate: true,
            installationDueDate: true,
          },
        });
      });

      it("creates the stage on lots that do not have it yet", async () => {
        mockSync({
          siblings: [sibling("btto-001-l2"), sibling("btto-001-l3")],
        });

        const res = await post(
          validBody({
            status: "IN_PROGRESS",
            notes: "n",
            startDate: "2026-03-05",
            endDate: "2026-03-20",
            assigned_to: ["emp-1"],
          }),
        );

        // source lot + two siblings
        expect(prismaMock.stage.create).toHaveBeenCalledTimes(3);
        expect(prismaMock.stage.create.mock.calls[1][0].data).toEqual({
          lot_id: "btto-001-l2",
          name: "drafting",
          status: "IN_PROGRESS",
          notes: "n",
          startDate: new Date("2026-03-05"),
          endDate: new Date("2026-03-20"),
        });
        expect(prismaMock.stage_employee.createMany).toHaveBeenCalledTimes(3);
        expect((await res.json()).sync).toEqual({
          syncedLots: ["btto-001-l2", "btto-001-l3"],
          skippedLots: [],
        });
      });

      it("updates the same-named stage on lots that already have it", async () => {
        mockSync({
          siblings: [sibling("btto-001-l2")],
          existing: { "btto-001-l2": "stage-l2" },
        });

        await post(validBody({ status: "DONE", assigned_to: ["emp-1"] }));

        expect(prismaMock.stage.findFirst).toHaveBeenCalledWith({
          where: { lot_id: "btto-001-l2", name: "drafting" },
          select: { stage_id: true },
        });
        expect(prismaMock.stage.update).toHaveBeenCalledWith({
          where: { stage_id: "stage-l2" },
          data: expect.objectContaining({ name: "drafting", status: "DONE" }),
        });
        expect(prismaMock.stage_employee.deleteMany).toHaveBeenCalledWith({
          where: { stage_id: "stage-l2" },
        });
        // only the source lot is created
        expect(prismaMock.stage.create).toHaveBeenCalledTimes(1);
      });

      it("skips lots whose date range cannot hold the stage dates", async () => {
        mockSync({
          siblings: [
            sibling("btto-001-l2", {
              startDate: new Date("2026-03-10T00:00:00.000Z"),
            }),
            sibling("btto-001-l3", { startDate: null }),
            sibling("btto-001-l4"),
          ],
        });

        const res = await post(
          validBody({ startDate: "2026-03-05", endDate: "2026-03-20" }),
        );

        expect(res.status).toBe(201);
        expect((await res.json()).sync).toEqual({
          syncedLots: ["btto-001-l4"],
          skippedLots: ["btto-001-l2", "btto-001-l3"],
        });
      });

      it("syncs an undated stage to lots that have no dates", async () => {
        mockSync({
          siblings: [sibling("btto-001-l2", { startDate: null })],
        });

        const res = await post();

        expect((await res.json()).sync.syncedLots).toEqual(["btto-001-l2"]);
      });

      it("notes the synced lot count in the log entry", async () => {
        mockSync({ siblings: [sibling("btto-001-l2")] });

        await post();

        expect(prismaMock.logs.create.mock.calls[0][0].data.description).toBe(
          "Stage created successfully: drafting for lot: btto-001-l1 and project: Smith House (synced to 1 other lot(s))",
        );
      });
    });

    describe("notification", () => {
      it("is sent when the stage is created as DONE", async () => {
        mockCreate({ complete: completeStage({ status: "DONE" }) });

        await post(validBody({ status: "DONE" }));

        expect(sendNotification).toHaveBeenCalledWith(
          {
            type: "stage",
            stage_id: "stage-1",
            lot_id: "btto-001-l1",
            stage_name: "drafting",
            status: "DONE",
            project_name: "Smith House",
            client_name: "Acme",
          },
          "stage_completed",
        );
      });

      it.each(["NOT_STARTED", "IN_PROGRESS", "NA"])(
        "is not sent for status %s",
        async (status) => {
          mockCreate({ complete: completeStage({ status }) });

          await post(validBody({ status }));

          expect(sendNotification).not.toHaveBeenCalled();
        },
      );

      it("falls back to Unknown values when the project or client is missing", async () => {
        mockCreate({
          complete: completeStage({ status: "DONE", lot: { project: null } }),
        });

        await post(validBody({ status: "DONE" }));

        expect(sendNotification.mock.calls[0][0]).toMatchObject({
          project_name: "Unknown Project",
          client_name: "Unknown Client",
        });
      });

      it("still returns 201 when the notification fails", async () => {
        mockCreate({ complete: completeStage({ status: "DONE" }) });
        sendNotification.mockRejectedValue(new Error("WhatsApp down"));

        const res = await post(validBody({ status: "DONE" }));

        expect(res.status).toBe(201);
      });
    });

    describe("failures", () => {
      it("returns 201 with a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await post();

        expect(res.status).toBe(201);
        expect((await res.json()).warning).toBe(
          "Note: Creation succeeded but logging failed",
        );
      });

      it("returns 500 when the stage cannot be created", async () => {
        prismaMock.stage.create.mockRejectedValue(new Error("DB down"));

        const res = await post();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 when the employee assignment fails", async () => {
        prismaMock.stage_employee.createMany.mockRejectedValue(
          new Error("FK violation"),
        );

        const res = await post(validBody({ assigned_to: ["ghost"] }));

        expect(res.status).toBe(500);
        expect(prismaMock.stage.findUnique).not.toHaveBeenCalled();
      });

      // Current behaviour: no input validation; these throw while lowercasing.
      it.each([
        ["lot_id", { lot_id: undefined }],
        ["name", { name: undefined }],
      ])("returns 500 when %s is missing", async (_, override) => {
        const res = await post(validBody(override));

        expect(res.status).toBe(500);
        expect(prismaMock.stage.create).not.toHaveBeenCalled();
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
        expect(prismaMock.stage.create).not.toHaveBeenCalled();
      });
    });
  });
});
