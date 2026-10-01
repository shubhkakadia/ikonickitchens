// Tests for src/app/api/v1/meeting/create/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

// sendNotification sends real WhatsApp messages; never call it in tests.
vi.mock("@/lib/notification", () => ({ sendNotification: vi.fn() }));

const { POST } = await import("@/app/api/v1/meeting/create/route");
const { sendNotification } = await import("@/lib/notification");

const URL = "/api/v1/meeting/create";

// Adelaide is UTC+10:30 in March (daylight time) and UTC+9:30 in July.
const MARCH_LOCAL = "2026-03-02T09:00:00";
const MARCH_UTC = "2026-03-01T22:30:00.000Z";
const MARCH_END_LOCAL = "2026-03-02T10:00:00";
const MARCH_END_UTC = "2026-03-01T23:30:00.000Z";

const validBody = (overrides = {}) => ({
  title: "Site visit",
  date_time: MARCH_LOCAL,
  date_time_end: MARCH_END_LOCAL,
  notes: "Bring samples",
  remainder: "1 hour before",
  participant_ids: ["user-2"],
  lot_ids: ["LOT-1"],
  ...overrides,
});

const post = (body = validBody(), options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

const detailedMeeting = (overrides = {}) => ({
  title: "Site visit",
  date_time: new Date(MARCH_UTC),
  notes: "Bring samples",
  participants: [
    { employee: { first_name: "Ann", last_name: "Lee" } },
    { employee: { first_name: "Bob", last_name: "Ray" } },
  ],
  lots: [
    {
      lot_id: "LOT-1",
      project: { name: "Smith House", client: { client_name: "Acme" } },
    },
  ],
  ...overrides,
});

function mockCreate({ details = detailedMeeting() } = {}) {
  prismaMock.meeting.findFirst.mockResolvedValue(null);
  prismaMock.meeting.create.mockImplementation(async ({ data }) => ({
    id: "meeting-1",
    title: data.title,
    participants: [],
    lots: [],
  }));
  prismaMock.meeting.findUnique.mockResolvedValue(details);
  prismaMock.logs.create.mockResolvedValue({});
}

const createArgs = () => prismaMock.meeting.create.mock.calls[0][0];

describe("POST /api/v1/meeting/create", () => {
  describeAuthorization((options) => post(undefined, options), {
    modules: "calendar",
    setup: () => mockCreate(),
    untouched: () => [prismaMock.meeting.findFirst, prismaMock.meeting.create],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockCreate();
    });

    it("creates the meeting and logs the creation", async () => {
      const res = await post();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Meeting created successfully",
        data: {
          id: "meeting-1",
          title: "Site visit",
          participants: [],
          lots: [],
        },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "meeting",
          entity_id: "meeting-1",
          action: "CREATE",
          description: "Meeting created successfully: Site visit",
        },
      });
    });

    describe("time handling", () => {
      it("treats the submitted times as Adelaide local time (summer)", async () => {
        await post();

        const { data } = createArgs();
        expect(data.date_time).toEqual(new Date(MARCH_UTC));
        expect(data.date_time_end).toEqual(new Date(MARCH_END_UTC));
      });

      it("accounts for the winter offset", async () => {
        await post(
          validBody({
            date_time: "2026-07-01T09:00:00",
            date_time_end: "2026-07-01T10:00:00",
          }),
        );

        const { data } = createArgs();
        expect(data.date_time).toEqual(new Date("2026-06-30T23:30:00.000Z"));
        expect(data.date_time_end).toEqual(
          new Date("2026-07-01T00:30:00.000Z"),
        );
      });

      it("ignores a trailing Z on the submitted time", async () => {
        await post(validBody({ date_time: `${MARCH_LOCAL}Z` }));

        expect(createArgs().data.date_time).toEqual(new Date(MARCH_UTC));
      });

      it("stores a null end time when none is given", async () => {
        await post(validBody({ date_time_end: undefined }));

        expect(createArgs().data.date_time_end).toBeNull();
      });
    });

    describe("participants, lots and optional fields", () => {
      it("connects the participants and lots", async () => {
        await post(
          validBody({
            participant_ids: ["user-2", "user-3"],
            lot_ids: ["A", "B"],
          }),
        );

        const { data } = createArgs();
        expect(data.participants).toEqual({
          connect: [{ id: "user-2" }, { id: "user-3" }, { id: "user-1" }],
        });
        expect(data.lots).toEqual({
          connect: [{ lot_id: "A" }, { lot_id: "B" }],
        });
      });

      it("always adds the creator as a participant, without duplicating them", async () => {
        await post(validBody({ participant_ids: ["user-1", "user-2"] }));

        expect(createArgs().data.participants.connect).toEqual([
          { id: "user-1" },
          { id: "user-2" },
        ]);
      });

      it("defaults to just the creator and no lots", async () => {
        await post({ title: "Solo", date_time: MARCH_LOCAL });

        const { data } = createArgs();
        expect(data.participants).toEqual({ connect: [{ id: "user-1" }] });
        expect(data.lots).toEqual({ connect: [] });
      });

      it("creates the meeting without adding a creator when the session cannot be re-read", async () => {
        const session = mockMasterAdmin();
        prismaMock.sessions.findUnique
          .mockReset()
          .mockResolvedValueOnce(session)
          .mockResolvedValueOnce(null);

        const res = await post(validBody({ participant_ids: ["user-2"] }));

        expect(res.status).toBe(200);
        expect(createArgs().data.participants.connect).toEqual([
          { id: "user-2" },
        ]);
      });

      it.each([
        ["notes", { notes: "" }],
        ["remainder", { remainder: "" }],
      ])("stores empty %s as null", async (field, override) => {
        await post(validBody(override));

        expect(createArgs().data[field]).toBeNull();
      });

      it("includes participants and lots in the returned meeting", async () => {
        await post();

        const { include } = createArgs();
        expect(include.participants.select).toEqual({
          id: true,
          username: true,
          employee: { select: { first_name: true, last_name: true } },
        });
        expect(include.lots.select).toEqual({ lot_id: true, name: true });
      });
    });

    describe("validation", () => {
      it.each([
        ["title is missing", { title: undefined }],
        ["title is empty", { title: "" }],
        ["date_time is missing", { date_time: undefined }],
      ])("returns 400 when %s", async (_, override) => {
        const res = await post(validBody(override));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Title and date_time are required",
        });
        expect(prismaMock.meeting.findFirst).not.toHaveBeenCalled();
        expect(prismaMock.meeting.create).not.toHaveBeenCalled();
      });
    });

    describe("overlap check", () => {
      it("looks for meetings that start before the new end and end after the new start", async () => {
        await post();

        expect(prismaMock.meeting.findFirst).toHaveBeenCalledWith({
          where: {
            AND: [
              { date_time: { lt: new Date(MARCH_END_UTC) } },
              { date_time_end: { gt: new Date(MARCH_UTC) } },
            ],
          },
          select: {
            id: true,
            title: true,
            date_time: true,
            date_time_end: true,
          },
        });
      });

      it("uses the start as the end when no end time is given", async () => {
        await post(validBody({ date_time_end: undefined }));

        const { where } = prismaMock.meeting.findFirst.mock.calls[0][0];
        expect(where.AND).toEqual([
          { date_time: { lt: new Date(MARCH_UTC) } },
          { date_time_end: { gt: new Date(MARCH_UTC) } },
        ]);
      });

      it("returns 409 with the clashing meeting", async () => {
        const clash = {
          id: "m-0",
          title: "Existing",
          date_time: "2026-03-01T22:00:00.000Z",
          date_time_end: "2026-03-01T23:00:00.000Z",
        };
        prismaMock.meeting.findFirst.mockResolvedValue(clash);

        const res = await post();

        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
          status: false,
          message: "Meeting time overlaps with existing meeting",
          overlappingMeeting: clash,
        });
        expect(prismaMock.meeting.create).not.toHaveBeenCalled();
        expect(sendNotification).not.toHaveBeenCalled();
      });
    });

    describe("notification", () => {
      it('sends a "meeting_confirmation" with the formatted details', async () => {
        await post();

        expect(prismaMock.meeting.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: "meeting-1" } }),
        );
        expect(sendNotification).toHaveBeenCalledWith(
          {
            title: "Site visit",
            project_names: "Smith House",
            lot_id_client: "LOT-1 (Acme)",
            date: "02/03/2026",
            time: "9:00 AM",
            participant1: "Ann Lee",
            participant2_plus: "Bob Ray",
            notes: "Bring samples",
          },
          "meeting_confirmation",
        );
      });

      it("formats the date and time in Adelaide time", async () => {
        mockCreate({
          details: detailedMeeting({
            date_time: new Date("2026-06-30T23:30:00.000Z"),
          }),
        });

        await post();

        expect(sendNotification.mock.calls[0][0]).toMatchObject({
          date: "01/07/2026",
          time: "9:00 AM",
        });
      });

      it("de-duplicates project names and falls back per lot for a missing client or project", async () => {
        mockCreate({
          details: detailedMeeting({
            lots: [
              {
                lot_id: "L1",
                project: { name: "Smith", client: { client_name: "Acme" } },
              },
              { lot_id: "L2", project: { name: "Smith", client: null } },
              { lot_id: "L3", project: null },
            ],
          }),
        });

        await post();

        expect(sendNotification.mock.calls[0][0]).toMatchObject({
          project_names: "Smith",
          lot_id_client: "L1 (Acme), L2 (Unknown Client), L3 (Unknown Client)",
        });
      });

      it("lists several participants after the first, skipping those without a name", async () => {
        mockCreate({
          details: detailedMeeting({
            participants: [
              { employee: { first_name: "Ann", last_name: "Lee" } },
              { employee: null },
              { employee: { first_name: "Cy", last_name: null } },
              { employee: { first_name: "Di", last_name: "Fox" } },
            ],
          }),
        });

        await post();

        expect(sendNotification.mock.calls[0][0]).toMatchObject({
          participant1: "Ann Lee",
          participant2_plus: "Cy, Di Fox",
        });
      });

      it("uses placeholder text when there is nothing to list", async () => {
        mockCreate({
          details: detailedMeeting({ participants: [], lots: [], notes: null }),
        });

        await post();

        expect(sendNotification.mock.calls[0][0]).toMatchObject({
          project_names: "No projects",
          lot_id_client: "No lots",
          participant1: "No participants",
          participant2_plus: "",
          notes: "No notes provided",
        });
      });

      it("does not notify when the meeting cannot be re-read", async () => {
        prismaMock.meeting.findUnique.mockResolvedValue(null);

        const res = await post();

        expect(res.status).toBe(200);
        expect(sendNotification).not.toHaveBeenCalled();
      });

      it("still returns 200 when the notification fails", async () => {
        sendNotification.mockRejectedValue(new Error("WhatsApp down"));

        const res = await post();

        expect(res.status).toBe(200);
        expect((await res.json()).status).toBe(true);
      });

      it("still returns 200 when the notification lookup fails", async () => {
        prismaMock.meeting.findUnique.mockRejectedValue(new Error("DB down"));

        const res = await post();

        expect(res.status).toBe(200);
      });
    });

    describe("failures", () => {
      // Current behaviour: unlike most routes this responds 200, not 201.
      it("returns 200 with a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await post();

        expect(res.status).toBe(200);
        expect((await res.json()).warning).toBe(
          "Note: Creation succeeded but logging failed",
        );
        expect(sendNotification).toHaveBeenCalledTimes(1);
      });

      it("returns 500 when the overlap lookup fails", async () => {
        prismaMock.meeting.findFirst.mockRejectedValue(new Error("DB down"));

        const res = await post();

        expect(res.status).toBe(500);
        expect(prismaMock.meeting.create).not.toHaveBeenCalled();
      });

      it("returns 500 when the create fails", async () => {
        prismaMock.meeting.create.mockRejectedValue(
          new Error("unknown user id"),
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
        expect(prismaMock.meeting.create).not.toHaveBeenCalled();
      });
    });
  });
});
