// Tests for src/app/api/v1/meeting/all/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/meeting/all/[id]/route");

const USER_ID = "user-9";
const URL = `/api/v1/meeting/all/${USER_ID}`;
const get = (options, params = { id: USER_ID }) =>
  GET(buildRequest(URL, options), routeContext(params));

const storedMeetings = () => [
  { id: "m-1", title: "Site visit", participants: [{ id: USER_ID }], lots: [] },
];

describe("GET /api/v1/meeting/all/[id]", () => {
  describeAuthorization(get, {
    modules: "calendar",
    setup: () => prismaMock.meeting.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.meeting.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.meeting.findMany.mockResolvedValue(storedMeetings());
    });

    it("returns the meetings the user participates in", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Meetings fetched successfully",
        data: storedMeetings(),
      });
    });

    it("filters by participant and sorts by start time ascending", async () => {
      await get();

      const args = prismaMock.meeting.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        participants: { some: { id: USER_ID } },
      });
      expect(args.orderBy).toEqual({ date_time: "asc" });
    });

    it("includes participants (with employee names) and lots (with project)", async () => {
      await get();

      const { include } = prismaMock.meeting.findMany.mock.calls[0][0];
      expect(include.participants.select).toEqual({
        id: true,
        username: true,
        employee: { select: { first_name: true, last_name: true } },
      });
      expect(include.lots.select).toEqual({
        lot_id: true,
        name: true,
        project: { select: { name: true, project_id: true } },
      });
    });

    it("returns an empty list when the user has no meetings", async () => {
      prismaMock.meeting.findMany.mockResolvedValue([]);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
    });

    it("returns 400 when the id param is missing", async () => {
      const res = await get(undefined, {});

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "User ID is required",
      });
      expect(prismaMock.meeting.findMany).not.toHaveBeenCalled();
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.meeting.findMany.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
