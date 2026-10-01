import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin, mockAuthorizedUser } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const route = await import("@/app/api/v1/logs/route");
const { GET } = route;

const get = (query = "", options) =>
  GET(buildRequest(`/api/v1/logs${query}`, options));

describe("GET /api/v1/logs", () => {
  it("only exposes a GET handler (logs are read-only over the API)", () => {
    expect(typeof route.GET).toBe("function");
    expect(route.POST).toBeUndefined();
    expect(route.PATCH).toBeUndefined();
    expect(route.PUT).toBeUndefined();
    expect(route.DELETE).toBeUndefined();
  });

  describeAuthorization((options) => get("", options), {
    modules: ["logs", "dashboard"],
    setup: () => prismaMock.logs.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.logs.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.logs.findMany.mockResolvedValue([]);
    });

    it("returns logs with the acting user's username, newest first", async () => {
      const logs = [
        {
          id: "log-2",
          entity_type: "client",
          entity_id: "c1",
          action: "UPDATE",
          description: "Client updated successfully: Bettio",
          createdAt: "2026-02-01T00:00:00.000Z",
          user: { username: "ann" },
        },
        {
          id: "log-1",
          entity_type: "client",
          entity_id: "c1",
          action: "CREATE",
          description: "Client created successfully: Bettio",
          createdAt: "2026-01-01T00:00:00.000Z",
          user: null,
        },
      ];
      prismaMock.logs.findMany.mockResolvedValue(logs);

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Logs fetched successfully",
        data: logs,
      });
      expect(prismaMock.logs.findMany).toHaveBeenCalledWith({
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: "desc" },
      });
    });

    it("exposes only the username of the acting user", async () => {
      await get();

      const { select } = prismaMock.logs.findMany.mock.calls[0][0].include.user;
      expect(select).toEqual({ username: true });
    });

    it("keeps logs whose user has since been removed (user: null)", async () => {
      prismaMock.logs.findMany.mockResolvedValue([
        { id: "log-1", user_id: null, user: null },
      ]);

      const { data } = await (await get()).json();

      expect(data).toEqual([{ id: "log-1", user_id: null, user: null }]);
    });

    it("returns an empty list when there are no logs", async () => {
      const res = await get();

      expect((await res.json()).data).toEqual([]);
    });

    // Current behaviour (performance): no pagination and no limit. Every
    // log row is returned on each call, and the logs table grows forever.
    it("fetches the whole table with no take/skip", async () => {
      await get();

      const args = prismaMock.logs.findMany.mock.calls[0][0];
      expect(args.take).toBeUndefined();
      expect(args.skip).toBeUndefined();
      expect(args.where).toBeUndefined();
    });

    it.each([
      "?limit=10",
      "?page=2&pageSize=50",
      "?entity_type=client",
      "?user_id=user-1",
    ])("ignores query parameters (%s)", async (query) => {
      await get(query);

      expect(prismaMock.logs.findMany).toHaveBeenCalledWith({
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: "desc" },
      });
    });

    // Current behaviour: the dashboard module grants the full company-wide
    // audit trail, not just a recent-activity summary.
    it("gives a dashboard-only user every log entry", async () => {
      mockAuthorizedUser({ userType: "manager", modules: ["dashboard"] });
      prismaMock.logs.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toHaveLength(2);
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.logs.findMany.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal Server Error",
      });
    });
  });
});
