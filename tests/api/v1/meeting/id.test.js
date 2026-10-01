// Tests for src/app/api/v1/meeting/[id]/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

// sendNotification sends real WhatsApp messages; never call it in tests.
vi.mock("@/lib/notification", () => ({ sendNotification: vi.fn() }));

const { PATCH, DELETE } = await import("@/app/api/v1/meeting/[id]/route");
const { sendNotification } = await import("@/lib/notification");

const ID = "meeting-1";
const URL = `/api/v1/meeting/${ID}`;
const ctx = () => routeContext({ id: ID });

// DELETE reads `params.id` without awaiting. Next.js 15 still allows that on
// the params promise (with a deprecation warning), so mimic it here.
const syncCtx = () => ({
  params: Object.assign(Promise.resolve({ id: ID }), { id: ID }),
});

// Adelaide is UTC+10:30 in March (daylight time) and UTC+9:30 in July.
const MARCH_LOCAL = "2026-03-02T09:00:00";
const MARCH_UTC = "2026-03-01T22:30:00.000Z";
const MARCH_END_LOCAL = "2026-03-02T10:00:00";
const MARCH_END_UTC = "2026-03-01T23:30:00.000Z";

const storedMeeting = (overrides = {}) => ({
  id: ID,
  title: "Site visit",
  ...overrides,
});

describe("PATCH /api/v1/meeting/[id]", () => {
  const validBody = (overrides = {}) => ({
    title: "Updated visit",
    date_time: MARCH_LOCAL,
    date_time_end: MARCH_END_LOCAL,
    notes: "New notes",
    remainder: "30 min before",
    participant_ids: ["user-2", "user-3"],
    lot_ids: ["LOT-1"],
    ...overrides,
  });
  const patch = (body = validBody(), options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());

  const detailedMeeting = (overrides = {}) => ({
    title: "Updated visit",
    date_time: new Date(MARCH_UTC),
    notes: "New notes",
    participants: [{ employee: { first_name: "Ann", last_name: "Lee" } }],
    lots: [
      {
        lot_id: "LOT-1",
        project: { name: "Smith House", client: { client_name: "Acme" } },
      },
    ],
    ...overrides,
  });

  function mockUpdate({ details = detailedMeeting() } = {}) {
    prismaMock.meeting.findUnique.mockImplementation(async (args) =>
      args?.include ? details : storedMeeting(),
    );
    prismaMock.meeting.findFirst.mockResolvedValue(null);
    prismaMock.meeting.update.mockImplementation(async ({ data }) => ({
      id: ID,
      title: data.title,
      participants: [],
      lots: [],
    }));
    prismaMock.logs.create.mockResolvedValue({});
  }

  const updateArgs = () => prismaMock.meeting.update.mock.calls[0][0];

  describeAuthorization((options) => patch(undefined, options), {
    modules: "calendar",
    setup: () => mockUpdate(),
    untouched: () => [prismaMock.meeting.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    it("updates the meeting and logs the update", async () => {
      const res = await patch();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Meeting updated successfully",
        data: { id: ID, title: "Updated visit", participants: [], lots: [] },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "meeting",
          entity_id: ID,
          action: "UPDATE",
          description: "Meeting updated: Updated visit",
        },
      });
    });

    it("converts Adelaide local times to UTC and replaces participants and lots", async () => {
      await patch();

      expect(updateArgs().where).toEqual({ id: ID });
      expect(updateArgs().data).toEqual({
        title: "Updated visit",
        date_time: new Date(MARCH_UTC),
        date_time_end: new Date(MARCH_END_UTC),
        notes: "New notes",
        remainder: "30 min before",
        participants: { set: [{ id: "user-2" }, { id: "user-3" }] },
        lots: { set: [{ lot_id: "LOT-1" }] },
      });
    });

    it("accounts for the winter offset and ignores a trailing Z", async () => {
      await patch(
        validBody({
          date_time: "2026-07-01T09:00:00Z",
          date_time_end: undefined,
        }),
      );

      expect(updateArgs().data.date_time).toEqual(
        new Date("2026-06-30T23:30:00.000Z"),
      );
      expect(updateArgs().data.date_time_end).toBeNull();
    });

    // Current behaviour: unlike create, the editor is not added automatically,
    // so omitting participant_ids clears everyone.
    it("clears participants and lots when they are not sent", async () => {
      await patch({ title: "Bare", date_time: MARCH_LOCAL });

      expect(updateArgs().data.participants).toEqual({ set: [] });
      expect(updateArgs().data.lots).toEqual({ set: [] });
    });

    it.each([
      ["notes", { notes: "" }],
      ["remainder", { remainder: "" }],
    ])("stores empty %s as null", async (field, override) => {
      await patch(validBody(override));

      expect(updateArgs().data[field]).toBeNull();
    });

    describe("validation and lookups", () => {
      it.each([
        ["title is missing", { title: undefined }],
        ["date_time is missing", { date_time: undefined }],
      ])("returns 400 when %s", async (_, override) => {
        const res = await patch(validBody(override));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Title and date_time are required",
        });
        expect(prismaMock.meeting.findUnique).not.toHaveBeenCalled();
      });

      it("returns 404 when the meeting does not exist", async () => {
        prismaMock.meeting.findUnique.mockResolvedValue(null);

        const res = await patch();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Meeting not found",
        });
        expect(prismaMock.meeting.findFirst).not.toHaveBeenCalled();
        expect(prismaMock.meeting.update).not.toHaveBeenCalled();
      });

      it("validates the body before checking that the meeting exists", async () => {
        prismaMock.meeting.findUnique.mockResolvedValue(null);

        const res = await patch(validBody({ title: "" }));

        expect(res.status).toBe(400);
      });
    });

    describe("overlap check", () => {
      it("excludes the meeting being edited", async () => {
        await patch();

        expect(prismaMock.meeting.findFirst).toHaveBeenCalledWith({
          where: {
            id: { not: ID },
            AND: [
              { date_time: { lt: new Date(MARCH_END_UTC) } },
              { date_time_end: { gt: new Date(MARCH_UTC) } },
            ],
          },
        });
      });

      it("uses the start as the end when no end time is given", async () => {
        await patch(validBody({ date_time_end: undefined }));

        const { where } = prismaMock.meeting.findFirst.mock.calls[0][0];
        expect(where.AND).toEqual([
          { date_time: { lt: new Date(MARCH_UTC) } },
          { date_time_end: { gt: new Date(MARCH_UTC) } },
        ]);
      });

      it("returns 409 with the clashing meeting", async () => {
        const clash = { id: "m-0", title: "Existing" };
        prismaMock.meeting.findFirst.mockResolvedValue(clash);

        const res = await patch();

        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
          status: false,
          message: "Meeting time overlaps with existing meeting",
          overlappingMeeting: clash,
        });
        expect(prismaMock.meeting.update).not.toHaveBeenCalled();
        expect(sendNotification).not.toHaveBeenCalled();
      });
    });

    describe("notification", () => {
      it('sends a "meeting_confirmation" with the updated details', async () => {
        await patch();

        expect(sendNotification).toHaveBeenCalledWith(
          {
            title: "Updated visit",
            project_names: "Smith House",
            lot_id_client: "LOT-1 (Acme)",
            date: "02/03/2026",
            time: "9:00 AM",
            participant1: "Ann Lee",
            participant2_plus: "",
            notes: "New notes",
          },
          "meeting_confirmation",
        );
      });

      it("uses placeholder text when there is nothing to list", async () => {
        mockUpdate({
          details: detailedMeeting({ participants: [], lots: [], notes: null }),
        });

        await patch();

        expect(sendNotification.mock.calls[0][0]).toMatchObject({
          project_names: "No projects",
          lot_id_client: "No lots",
          participant1: "No participants",
          notes: "No notes provided",
        });
      });

      it("does not notify when the meeting cannot be re-read", async () => {
        prismaMock.meeting.findUnique.mockImplementation(async (args) =>
          args?.include ? null : storedMeeting(),
        );

        const res = await patch();

        expect(res.status).toBe(200);
        expect(sendNotification).not.toHaveBeenCalled();
      });

      it("still returns 200 when the notification fails", async () => {
        sendNotification.mockRejectedValue(new Error("WhatsApp down"));

        const res = await patch();

        expect(res.status).toBe(200);
      });
    });

    describe("failures", () => {
      // Current behaviour: a logging failure is ignored silently, with no
      // warning in the response (create does add one).
      it("returns 200 without a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await patch();

        expect(res.status).toBe(200);
        expect(await res.json()).not.toHaveProperty("warning");
      });

      it("returns 500 when the update fails", async () => {
        prismaMock.meeting.update.mockRejectedValue(
          new Error("unknown user id"),
        );

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
        expect(prismaMock.meeting.update).not.toHaveBeenCalled();
      });
    });
  });
});

describe("DELETE /api/v1/meeting/[id]", () => {
  const del = (options) =>
    DELETE(buildRequest(URL, { method: "DELETE", ...options }), syncCtx());

  function mockDelete() {
    prismaMock.meeting.findUnique.mockResolvedValue(storedMeeting());
    prismaMock.meeting.delete.mockResolvedValue(storedMeeting());
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization(del, {
    modules: "calendar",
    setup: mockDelete,
    untouched: () => [prismaMock.meeting.delete],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    // Current behaviour: a hard delete, unlike most entities here.
    it("deletes the meeting and logs the deletion", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Meeting deleted successfully",
      });
      expect(prismaMock.meeting.findUnique).toHaveBeenCalledWith({
        where: { id: ID },
      });
      expect(prismaMock.meeting.delete).toHaveBeenCalledWith({
        where: { id: ID },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "meeting",
          entity_id: ID,
          action: "DELETE",
          description: "Meeting deleted: Site visit",
        },
      });
    });

    it("returns 404 when the meeting does not exist", async () => {
      prismaMock.meeting.findUnique.mockResolvedValue(null);

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Meeting not found",
      });
      expect(prismaMock.meeting.delete).not.toHaveBeenCalled();
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 200 without a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).not.toHaveProperty("warning");
    });

    it("returns 500 when the lookup fails", async () => {
      prismaMock.meeting.findUnique.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });

    it("returns 500 when the delete fails", async () => {
      prismaMock.meeting.delete.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });
  });
});
