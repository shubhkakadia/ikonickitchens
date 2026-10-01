// Tests for src/app/api/v1/stage/[id]/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

// sendNotification sends real WhatsApp messages; never call it in tests.
vi.mock("@/lib/notification", () => ({ sendNotification: vi.fn() }));

const { PATCH, DELETE } = await import("@/app/api/v1/stage/[id]/route");
const { sendNotification } = await import("@/lib/notification");

const ID = "stage-1";
const URL = `/api/v1/stage/${ID}`;
const ctx = () => routeContext({ id: ID });

const LOT_START = new Date("2026-03-01T00:00:00.000Z");
const LOT_DUE = new Date("2026-04-01T00:00:00.000Z");

const storedStage = (
  lot = { startDate: LOT_START, installationDueDate: LOT_DUE },
) => ({
  stage_id: ID,
  lot_id: "btto-001-l1",
  name: "drafting",
  status: "NOT_STARTED",
  lot,
});

const completeStage = (overrides = {}) => ({
  stage_id: ID,
  lot_id: "btto-001-l1",
  name: "drafting",
  status: "NOT_STARTED",
  lot: { project: { name: "Smith House", client: { client_name: "Acme" } } },
  assigned_to: [],
  ...overrides,
});

describe("PATCH /api/v1/stage/[id]", () => {
  const patch = (body = { notes: "Updated" }, options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());

  function mockUpdate({
    existing = storedStage(),
    complete = completeStage(),
  } = {}) {
    prismaMock.stage.findUnique.mockImplementation(async (args) =>
      args?.include?.assigned_to ? complete : existing,
    );
    prismaMock.stage.update.mockImplementation(async ({ data }) => ({
      stage_id: ID,
      ...data,
    }));
    prismaMock.stage_employee.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.stage_employee.createMany.mockResolvedValue({ count: 0 });
    prismaMock.logs.create.mockResolvedValue({});
  }

  const updateData = () => prismaMock.stage.update.mock.calls[0][0].data;

  describeAuthorization((options) => patch(undefined, options), {
    modules: ["project_details", "lotatglance", "site_measurements"],
    setup: () => mockUpdate(),
    untouched: () => [prismaMock.stage.update, prismaMock.$transaction],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    describe("updating a stage", () => {
      it("updates the stage and logs the update", async () => {
        const res = await patch({ notes: "Updated" });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "Stage updated successfully",
          data: completeStage(),
        });
        expect(prismaMock.stage.update).toHaveBeenCalledWith({
          where: { stage_id: ID },
          data: expect.objectContaining({ notes: "Updated" }),
        });
        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: {
            user_id: "user-1",
            entity_type: "stage",
            entity_id: ID,
            action: "UPDATE",
            description:
              "Stage updated successfully: drafting for lot: btto-001-l1 and project: Smith House",
          },
        });
      });

      it("lowercases a new name and leaves it alone when not sent", async () => {
        await patch({ name: "Final Design" });
        expect(updateData().name).toBe("final design");

        prismaMock.stage.update.mockClear();
        await patch({ notes: "x" });
        expect(updateData().name).toBeUndefined();
      });

      it("passes status and notes through; omitted ones are left unchanged", async () => {
        await patch({ status: "IN_PROGRESS" });

        expect(updateData().status).toBe("IN_PROGRESS");
        expect(updateData().notes).toBeUndefined();
      });

      it("runs in a transaction and re-reads the stage with its relations", async () => {
        await patch();

        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
        expect(prismaMock.stage.findUnique).toHaveBeenLastCalledWith(
          expect.objectContaining({ where: { stage_id: ID } }),
        );
      });

      it("returns 404 when the stage does not exist", async () => {
        mockUpdate({ existing: null });

        const res = await patch();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Stage not found",
        });
        expect(prismaMock.stage.update).not.toHaveBeenCalled();
      });
    });

    describe("employee assignments", () => {
      it("replaces all assignments with the new list", async () => {
        await patch({ assigned_to: ["emp-1", "emp-2"] });

        expect(prismaMock.stage_employee.deleteMany).toHaveBeenCalledWith({
          where: { stage_id: ID },
        });
        expect(prismaMock.stage_employee.createMany).toHaveBeenCalledWith({
          data: [
            { stage_id: ID, employee_id: "emp-1" },
            { stage_id: ID, employee_id: "emp-2" },
          ],
          skipDuplicates: true,
        });
      });

      it("clears all assignments when assigned_to is an empty list", async () => {
        await patch({ assigned_to: [] });

        expect(prismaMock.stage_employee.deleteMany).toHaveBeenCalledOnce();
        expect(prismaMock.stage_employee.createMany).not.toHaveBeenCalled();
      });

      // Current behaviour (risky): a PATCH that leaves assigned_to out, such as
      // a notes-only edit, removes every employee from the stage.
      it("clears all assignments when assigned_to is omitted", async () => {
        await patch({ notes: "only notes" });

        expect(prismaMock.stage_employee.deleteMany).toHaveBeenCalledWith({
          where: { stage_id: ID },
        });
        expect(prismaMock.stage_employee.createMany).not.toHaveBeenCalled();
      });

      it("returns 500 when creating the new assignments fails", async () => {
        prismaMock.stage_employee.createMany.mockRejectedValue(
          new Error("FK violation"),
        );

        const res = await patch({ assigned_to: ["ghost"] });

        expect(res.status).toBe(500);
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });
    });

    describe("dates", () => {
      it("stores dates inside the lot's range", async () => {
        const res = await patch({
          startDate: "2026-03-05",
          endDate: "2026-03-20",
        });

        expect(res.status).toBe(200);
        expect(updateData().startDate).toEqual(new Date("2026-03-05"));
        expect(updateData().endDate).toEqual(new Date("2026-03-20"));
      });

      it("accepts dates exactly on the lot's boundaries", async () => {
        const res = await patch({
          startDate: LOT_START.toISOString(),
          endDate: LOT_DUE.toISOString(),
        });

        expect(res.status).toBe(200);
      });

      // Current behaviour (risky): omitted dates are written as null, so any
      // PATCH that does not resend the dates wipes them.
      it("clears the stage dates when they are omitted", async () => {
        await patch({ notes: "only notes" });

        expect(updateData().startDate).toBeNull();
        expect(updateData().endDate).toBeNull();
      });

      it("clears a date sent as an empty string", async () => {
        await patch({ endDate: "", startDate: "2026-03-05" });

        expect(updateData().endDate).toBeNull();
        expect(updateData().startDate).toEqual(new Date("2026-03-05"));
      });

      it.each([
        [
          "the lot has no start date",
          { startDate: null, installationDueDate: LOT_DUE },
        ],
        [
          "the lot has no installation due date",
          { startDate: LOT_START, installationDueDate: null },
        ],
      ])("returns 400 when %s", async (_, lot) => {
        mockUpdate({ existing: storedStage(lot) });

        const res = await patch({ startDate: "2026-03-05" });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Set the parent lot start and installation due dates before scheduling a stage",
        });
        expect(prismaMock.stage.update).not.toHaveBeenCalled();
      });

      it("does not require the lot to have dates when no dates are sent", async () => {
        mockUpdate({
          existing: storedStage({ startDate: null, installationDueDate: null }),
        });

        const res = await patch({ notes: "x" });

        expect(res.status).toBe(200);
      });

      it.each([
        ["starts before the lot", { startDate: "2026-02-28" }],
        ["ends after the lot's due date", { endDate: "2026-04-02" }],
      ])("returns 400 when the stage %s", async (_, dates) => {
        const res = await patch(dates);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Stage dates must stay within the parent lot date range",
        });
        expect(prismaMock.stage.update).not.toHaveBeenCalled();
      });

      it("reads the lot's dates together with the stage", async () => {
        await patch();

        expect(prismaMock.stage.findUnique).toHaveBeenCalledWith({
          where: { stage_id: ID },
          include: {
            lot: { select: { startDate: true, installationDueDate: true } },
          },
        });
      });
    });

    describe("notification", () => {
      it("is sent when the stage ends up DONE", async () => {
        mockUpdate({ complete: completeStage({ status: "DONE" }) });

        await patch({ status: "DONE" });

        expect(sendNotification).toHaveBeenCalledWith(
          {
            type: "stage",
            stage_id: ID,
            lot_id: "btto-001-l1",
            stage_name: "drafting",
            status: "DONE",
            project_name: "Smith House",
            client_name: "Acme",
          },
          "stage_completed",
        );
      });

      it("is not sent for other statuses", async () => {
        await patch({ status: "IN_PROGRESS" });

        expect(sendNotification).not.toHaveBeenCalled();
      });

      // Current behaviour: it fires whenever the stage is DONE after the
      // update, even if it already was and only the notes changed.
      it("re-sends for an already DONE stage on any edit", async () => {
        mockUpdate({ complete: completeStage({ status: "DONE" }) });

        await patch({ notes: "typo fix" });

        expect(sendNotification).toHaveBeenCalledTimes(1);
      });

      it("still returns 200 when the notification fails", async () => {
        mockUpdate({ complete: completeStage({ status: "DONE" }) });
        sendNotification.mockRejectedValue(new Error("WhatsApp down"));

        const res = await patch({ status: "DONE" });

        expect(res.status).toBe(200);
      });
    });

    describe("failures", () => {
      it("returns 200 with a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await patch();

        expect(res.status).toBe(200);
        expect((await res.json()).warning).toBe(
          "Note: Update succeeded but logging failed",
        );
      });

      it("returns 500 when the update fails", async () => {
        prismaMock.stage.update.mockRejectedValue(new Error("DB down"));

        const res = await patch();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
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
        expect(prismaMock.stage.update).not.toHaveBeenCalled();
      });
    });
  });
});

describe("DELETE /api/v1/stage/[id]", () => {
  const del = (options) =>
    DELETE(buildRequest(URL, { method: "DELETE", ...options }), ctx());

  const deleted = () => ({
    stage_id: ID,
    lot_id: "btto-001-l1",
    name: "drafting",
    lot: { project: { project_id: "p1", name: "Smith House" } },
  });

  function mockDelete() {
    prismaMock.stage.delete.mockResolvedValue(deleted());
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization(del, {
    modules: "project_details",
    setup: mockDelete,
    untouched: () => [prismaMock.stage.delete],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    // Current behaviour: a hard delete, unlike the soft-deleted lots and projects.
    it("deletes the stage and logs the deletion", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Stage deleted successfully",
        data: deleted(),
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.stage.delete).toHaveBeenCalledWith({
        where: { stage_id: ID },
        include: {
          lot: {
            select: { project: { select: { project_id: true, name: true } } },
          },
        },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "stage",
          entity_id: ID,
          action: "DELETE",
          description:
            "Stage deleted successfully: drafting for lot: btto-001-l1 and project: Smith House",
        },
      });
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Deletion succeeded but logging failed",
      );
    });

    // Current behaviour: a missing stage (Prisma P2025) is a 500, not a 404.
    it("returns 500 when the stage does not exist", async () => {
      prismaMock.stage.delete.mockRejectedValue(
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
  });
});
