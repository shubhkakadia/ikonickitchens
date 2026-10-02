// Tests for src/app/api/v1/updates/[id]/read, read-all and [id]/readers
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthorizedUser } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { PATCH } = await import("@/app/api/v1/updates/[id]/read/route");
const { POST } = await import("@/app/api/v1/updates/read-all/route");
const { GET: READERS } =
  await import("@/app/api/v1/updates/[id]/readers/route");

const ID = "update-1";

describe("PATCH /api/v1/updates/[id]/read", () => {
  const patch = (options) =>
    PATCH(
      buildRequest(`/api/v1/updates/${ID}/read`, {
        method: "PATCH",
        ...options,
      }),
      routeContext({ id: ID }),
    );

  describeAuthorization(patch, {
    setup: () =>
      prismaMock.update_recipient.updateMany.mockResolvedValue({ count: 1 }),
    untouched: () => [prismaMock.update_recipient.updateMany],
  });

  beforeEach(() => mockAuthorizedUser({ userType: "manager", modules: [] }));

  it("stamps read_at on the caller's own unread row only", async () => {
    prismaMock.update_recipient.updateMany.mockResolvedValue({ count: 1 });

    const res = await patch();

    expect(res.status).toBe(200);
    expect(prismaMock.update_recipient.updateMany).toHaveBeenCalledWith({
      where: { update_id: ID, user_id: "user-1", read_at: null },
      data: { read_at: expect.any(Date) },
    });
  });

  it("is idempotent: an already-read update still succeeds and keeps its read time", async () => {
    prismaMock.update_recipient.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.update_recipient.findFirst.mockResolvedValue({ id: "rec-1" });

    const res = await patch();

    expect(res.status).toBe(200);
    // the where clause requires read_at: null, so the first read time is never overwritten
    expect(
      prismaMock.update_recipient.updateMany.mock.calls[0][0].where.read_at,
    ).toBeNull();
  });

  it("returns 404 when the update was never sent to the caller", async () => {
    prismaMock.update_recipient.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.update_recipient.findFirst.mockResolvedValue(null);

    const res = await patch();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      status: false,
      message: "Update not found",
    });
  });

  it("returns 500 when the write fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.update_recipient.updateMany.mockRejectedValue(
      new Error("DB down"),
    );
    expect((await patch()).status).toBe(500);
  });
});

describe("POST /api/v1/updates/read-all", () => {
  const post = (body, options) =>
    POST(
      buildRequest("/api/v1/updates/read-all", {
        method: "POST",
        body,
        ...options,
      }),
    );

  describeAuthorization((o) => post({}, o), {
    setup: () =>
      prismaMock.update_recipient.updateMany.mockResolvedValue({ count: 0 }),
    untouched: () => [prismaMock.update_recipient.updateMany],
  });

  beforeEach(() => {
    mockAuthorizedUser({ userType: "manager", modules: ["calendar"] });
    prismaMock.update_recipient.updateMany.mockResolvedValue({ count: 3 });
  });

  it("marks every unread update the caller can see as read", async () => {
    const res = await post({});

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ count: 3 });
    expect(prismaMock.update_recipient.updateMany).toHaveBeenCalledWith({
      where: {
        user_id: "user-1",
        read_at: null,
        update: {
          type: { in: ["CALENDAR_EVENT_CREATED", "CALENDAR_EVENT_UPDATED"] },
        },
      },
      data: { read_at: expect.any(Date) },
    });
  });

  it("limits it to one type when asked", async () => {
    await post({ type: "CALENDAR_EVENT_UPDATED" });
    const { where } = prismaMock.update_recipient.updateMany.mock.calls[0][0];
    expect(where.update.type.in).toEqual(["CALENDAR_EVENT_UPDATED"]);
  });

  it("never touches updates in modules the caller cannot see", async () => {
    await post({ type: "STAGE_UPDATED" });
    const { where } = prismaMock.update_recipient.updateMany.mock.calls[0][0];
    expect(where.update.type.in).toEqual([]);
  });

  it("copes with an empty body", async () => {
    const res = await post(undefined);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1/updates/[id]/readers", () => {
  const readers = (options) =>
    READERS(
      buildRequest(`/api/v1/updates/${ID}/readers`, {
        method: "GET",
        ...options,
      }),
      routeContext({ id: ID }),
    );

  describeAuthorization(readers, {
    roles: ["master-admin", "admin"],
    setup: () => prismaMock.update_recipient.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.update_recipient.findMany],
  });

  it("lists who has and hasn't read it", async () => {
    mockAuthorizedUser({ userType: "admin", modules: [] });
    const readAt = new Date("2026-10-02T03:00:00Z");
    prismaMock.update_recipient.findMany.mockResolvedValue([
      {
        read_at: readAt,
        user: {
          id: "u1",
          username: "sam",
          employee: { first_name: "Sam", last_name: "Lee" },
        },
      },
      { read_at: null, user: { id: "u2", username: "kim", employee: null } },
    ]);

    const res = await readers();
    const { data } = await res.json();

    expect(res.status).toBe(200);
    expect(data.readers).toEqual([
      {
        user_id: "u1",
        name: "Sam Lee",
        read_at: readAt.toISOString(),
        is_read: true,
      },
      { user_id: "u2", name: "kim", read_at: null, is_read: false },
    ]);
    expect(prismaMock.update_recipient.findMany.mock.calls[0][0].where).toEqual(
      {
        update_id: ID,
      },
    );
  });
});
