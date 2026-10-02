// Tests for src/app/api/v1/updates/route.js and unread-count/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthorizedUser, mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/updates/route");
const { GET: GET_COUNT } =
  await import("@/app/api/v1/updates/unread-count/route");

const get = (query = "", options) =>
  GET(buildRequest(`/api/v1/updates${query}`, { method: "GET", ...options }));

const row = (id, extra = {}) => ({
  id: `rec-${id}`,
  read_at: null,
  update: {
    id,
    type: "CALENDAR_EVENT_CREATED",
    title: "Calendar event created",
    message: "Site visit",
    url: `/admin/calendar?event=${id}`,
    createdAt: new Date("2026-10-02T00:00:00Z"),
    updatedAt: new Date("2026-10-02T01:00:00Z"),
    actor: {
      id: "a1",
      username: "alex",
      employee: { first_name: "Alex", last_name: "Doe" },
    },
  },
  ...extra,
});

const setup = () => {
  prismaMock.update_recipient.findMany.mockResolvedValue([]);
  prismaMock.update_recipient.count.mockResolvedValue(0);
};

describe("GET /api/v1/updates", () => {
  describeAuthorization((o) => get("", o), {
    setup,
    untouched: () => [prismaMock.update_recipient.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockAuthorizedUser({ userType: "manager", modules: ["calendar"] });
      setup();
    });

    it("returns the caller's updates, flattened, with the unread count", async () => {
      prismaMock.update_recipient.findMany.mockResolvedValue([
        row("e1"),
        row("e2", { read_at: new Date("2026-10-02T02:00:00Z") }),
      ]);
      prismaMock.update_recipient.count.mockResolvedValue(1);

      const res = await get();
      const { data } = await res.json();

      expect(res.status).toBe(200);
      expect(data.unread_count).toBe(1);
      expect(data.hasMore).toBe(false);
      expect(data.updates[0]).toMatchObject({
        id: "e1",
        type: "CALENDAR_EVENT_CREATED",
        label: "Calendar event created",
        url: "/admin/calendar?event=e1",
        actor: { id: "a1", name: "Alex Doe" },
        is_read: false,
      });
      expect(data.updates[1].is_read).toBe(true);
    });

    it("only reads the caller's own rows, limited to the modules they hold", async () => {
      await get();
      const { where } = prismaMock.update_recipient.findMany.mock.calls[0][0];
      expect(where).toEqual({
        user_id: "user-1",
        update: {
          type: { in: ["CALENDAR_EVENT_CREATED", "CALENDAR_EVENT_UPDATED"] },
        },
      });
    });

    it("returns nothing for a user with no matching modules", async () => {
      mockAuthorizedUser({ userType: "manager", modules: [] });
      await get();
      const { where } = prismaMock.update_recipient.findMany.mock.calls[0][0];
      expect(where.update.type.in).toEqual([]);
    });

    it("lets a master-admin see every type", async () => {
      mockMasterAdmin();
      await get();
      const { where } = prismaMock.update_recipient.findMany.mock.calls[0][0];
      expect(where.update.type.in).toHaveLength(10);
    });

    it("filters unread and by an allowed type, ignoring a type they cannot see", async () => {
      await get("?unread=1&type=CALENDAR_EVENT_UPDATED");
      let { where } = prismaMock.update_recipient.findMany.mock.calls[0][0];
      expect(where).toEqual({
        user_id: "user-1",
        read_at: null,
        update: { type: { in: ["CALENDAR_EVENT_UPDATED"] } },
      });

      prismaMock.update_recipient.findMany.mockClear();
      await get("?type=STAGE_UPDATED");
      ({ where } = prismaMock.update_recipient.findMany.mock.calls[0][0]);
      expect(where.update.type.in).toEqual([]);
    });

    it("pages with limit and skip, newest first, and reports hasMore", async () => {
      prismaMock.update_recipient.findMany.mockResolvedValue([
        row("e1"),
        row("e2"),
        row("e3"),
      ]);
      const res = await get("?limit=2&skip=4");
      const { data } = await res.json();

      const args = prismaMock.update_recipient.findMany.mock.calls[0][0];
      expect(args).toMatchObject({ skip: 4, take: 3 });
      expect(args.orderBy[0]).toEqual({ update: { updatedAt: "desc" } });
      expect(data.updates).toHaveLength(2);
      expect(data.hasMore).toBe(true);
    });

    it("caps the page size", async () => {
      await get("?limit=9999");
      expect(prismaMock.update_recipient.findMany.mock.calls[0][0].take).toBe(
        51,
      );
    });

    it("returns 500 when the query fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      prismaMock.update_recipient.findMany.mockRejectedValue(
        new Error("DB down"),
      );
      const res = await get();
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});

describe("GET /api/v1/updates/unread-count", () => {
  const getCount = (o) =>
    GET_COUNT(
      buildRequest("/api/v1/updates/unread-count", { method: "GET", ...o }),
    );

  describeAuthorization(getCount, {
    setup: () => prismaMock.update_recipient.count.mockResolvedValue(0),
    untouched: () => [prismaMock.update_recipient.count],
  });

  it("counts the caller's unread updates within their modules", async () => {
    mockAuthorizedUser({ userType: "manager", modules: ["statements"] });
    prismaMock.update_recipient.count.mockResolvedValue(7);

    const res = await getCount();

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ unread_count: 7 });
    expect(prismaMock.update_recipient.count).toHaveBeenCalledWith({
      where: {
        user_id: "user-1",
        read_at: null,
        update: { type: { in: ["SUPPLIER_STATEMENT_ADDED"] } },
      },
    });
  });
});
