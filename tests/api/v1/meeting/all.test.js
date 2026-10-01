// Tests for src/app/api/v1/meeting/all/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/meeting/all/route");

const URL = "/api/v1/meeting/all";
const get = (options) => GET(buildRequest(URL, options));

const storedMeetings = () => [
  { id: "m-1", title: "Site visit", participants: [], lots: [] },
  { id: "m-2", title: "Review", participants: [], lots: [] },
];

describe("GET /api/v1/meeting/all", () => {
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

    it("returns every meeting", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Meetings fetched successfully",
        data: storedMeetings(),
      });
    });

    it("sorts by start time ascending, with no filter", async () => {
      await get();

      const args = prismaMock.meeting.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual({ date_time: "asc" });
      expect(args).not.toHaveProperty("where");
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

    it("returns an empty list when there are no meetings", async () => {
      prismaMock.meeting.findMany.mockResolvedValue([]);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
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
