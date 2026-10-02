// Tests for src/lib/updates.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../helpers/prismaMock";
import { buildRequest } from "../helpers/request";

const {
  publishUpdate,
  publishMtoCreated,
  publishLotNotesUpdate,
  allowedTypesFor,
  feedWhere,
  lotUrl,
  formatAdelaide,
  UPDATE_TYPES,
} = await import("@/lib/updates");

const base = {
  actorId: "actor-1",
  type: "CALENDAR_EVENT_CREATED",
  title: "Calendar event created",
  message: '"Site visit" on 3 Oct 2026',
  url: "/admin/calendar?event=m1",
};

beforeEach(() => {
  prismaMock.users.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
  prismaMock.update_event.findFirst.mockResolvedValue(null);
  prismaMock.update_event.create.mockResolvedValue({ id: "e1" });
  prismaMock.update_event.update.mockResolvedValue({});
  prismaMock.update_recipient.updateMany.mockResolvedValue({ count: 2 });
  prismaMock.update_recipient.createMany.mockResolvedValue({ count: 0 });
});

describe("publishUpdate", () => {
  it("fans out to active, non-employee users with the module, excluding the actor", async () => {
    await publishUpdate(base);

    const { where } = prismaMock.users.findMany.mock.calls[0][0];
    expect(where).toEqual({
      is_active: true,
      id: { not: "actor-1" },
      user_type: { not: "employee" },
      OR: [
        { user_type: "master-admin" },
        { module_access: { is: { OR: [{ calendar: true }] } } },
      ],
    });
  });

  it("accepts any of several module flags for a type", async () => {
    await publishUpdate({ ...base, type: "STAGE_UPDATED" });
    const { where } = prismaMock.users.findMany.mock.calls[0][0];
    expect(where.OR[1].module_access.is.OR).toEqual([
      { project_details: true },
      { lotatglance: true },
    ]);
  });

  it("creates the event with one recipient row per user", async () => {
    await publishUpdate(base);

    expect(prismaMock.update_event.create).toHaveBeenCalledWith({
      data: {
        type: "CALENDAR_EVENT_CREATED",
        actor_id: "actor-1",
        title: base.title,
        message: base.message,
        url: base.url,
        dedupe_key: null,
        recipients: { create: [{ user_id: "u1" }, { user_id: "u2" }] },
      },
    });
  });

  it("creates nothing when nobody has access", async () => {
    prismaMock.users.findMany.mockResolvedValue([]);
    expect(await publishUpdate(base)).toBe(true);
    expect(prismaMock.update_event.create).not.toHaveBeenCalled();
  });

  it("takes the actor from the session token when none is passed", async () => {
    prismaMock.sessions.findUnique.mockResolvedValue({ user_id: "from-token" });
    await publishUpdate({
      ...base,
      actorId: undefined,
      req: buildRequest("/x"),
    });

    const { where } = prismaMock.users.findMany.mock.calls[0][0];
    expect(where.id).toEqual({ not: "from-token" });
    expect(prismaMock.update_event.create.mock.calls[0][0].data.actor_id).toBe(
      "from-token",
    );
  });

  describe("dedupe", () => {
    const existing = { id: "e-old" };

    it("refresh rewrites the event, marks it unread and adds new recipients", async () => {
      prismaMock.update_event.findFirst.mockResolvedValue(existing);

      await publishUpdate({
        ...base,
        dedupeKey: "notes:lot-1:overview",
        windowMinutes: 30,
      });

      const { where } = prismaMock.update_event.findFirst.mock.calls[0][0];
      expect(where).toMatchObject({
        dedupe_key: "notes:lot-1:overview",
        actor_id: "actor-1",
      });
      expect(where.updatedAt.gte).toBeInstanceOf(Date);
      expect(prismaMock.update_event.update).toHaveBeenCalledWith({
        where: { id: "e-old" },
        data: { title: base.title, message: base.message, url: base.url },
      });
      expect(prismaMock.update_recipient.updateMany).toHaveBeenCalledWith({
        where: { update_id: "e-old" },
        data: { read_at: null },
      });
      expect(prismaMock.update_recipient.createMany).toHaveBeenCalledWith({
        data: [
          { update_id: "e-old", user_id: "u1" },
          { update_id: "e-old", user_id: "u2" },
        ],
        skipDuplicates: true,
      });
      expect(prismaMock.update_event.create).not.toHaveBeenCalled();
    });

    it("skip does nothing when the key exists, whoever the actor was", async () => {
      prismaMock.update_event.findFirst.mockResolvedValue(existing);

      await publishUpdate({
        ...base,
        dedupeKey: "mto-created:m1",
        onDuplicate: "skip",
      });

      const { where } = prismaMock.update_event.findFirst.mock.calls[0][0];
      expect(where).toEqual({ dedupe_key: "mto-created:m1" });
      expect(prismaMock.update_event.create).not.toHaveBeenCalled();
      expect(prismaMock.update_event.update).not.toHaveBeenCalled();
    });

    it("creates a new event when no earlier one matches", async () => {
      await publishUpdate({ ...base, dedupeKey: "k", windowMinutes: 5 });
      expect(prismaMock.update_event.create).toHaveBeenCalledOnce();
      expect(
        prismaMock.update_event.create.mock.calls[0][0].data.dedupe_key,
      ).toBe("k");
    });
  });

  describe("never throws", () => {
    beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

    it("returns false when the lookup fails", async () => {
      prismaMock.users.findMany.mockRejectedValue(new Error("DB down"));
      expect(await publishUpdate(base)).toBe(false);
    });

    it("returns false when the insert fails", async () => {
      prismaMock.update_event.create.mockRejectedValue(new Error("DB down"));
      expect(await publishUpdate(base)).toBe(false);
    });

    it("rejects an unknown type without touching the database", async () => {
      expect(await publishUpdate({ ...base, type: "NOPE" })).toBe(false);
      expect(prismaMock.users.findMany).not.toHaveBeenCalled();
    });
  });
});

describe("allowedTypesFor / feedWhere", () => {
  const auth = (modules, userType = "manager") => ({
    userType,
    moduleAccess: Object.fromEntries(modules.map((m) => [m, true])),
    user: { id: "me" },
  });

  it("limits a user to the types their modules allow", () => {
    expect(allowedTypesFor(auth(["calendar"]))).toEqual([
      "CALENDAR_EVENT_CREATED",
      "CALENDAR_EVENT_UPDATED",
    ]);
    expect(allowedTypesFor(auth(["lotatglance"]))).toEqual(["STAGE_UPDATED"]);
    expect(allowedTypesFor(auth([]))).toEqual([]);
  });

  it("lets a master-admin see every type", () => {
    expect(allowedTypesFor(auth([], "master-admin"))).toEqual(UPDATE_TYPES);
  });

  it("scopes the feed to the caller and their allowed types", () => {
    expect(feedWhere(auth(["statements"]))).toEqual({
      user_id: "me",
      update: { type: { in: ["SUPPLIER_STATEMENT_ADDED"] } },
    });
  });

  it("adds the unread filter and narrows to one allowed type", () => {
    const where = feedWhere(auth(["calendar"]), {
      unread: true,
      type: "CALENDAR_EVENT_CREATED",
    });
    expect(where).toEqual({
      user_id: "me",
      read_at: null,
      update: { type: { in: ["CALENDAR_EVENT_CREATED"] } },
    });
  });

  it("returns nothing for a type the user may not see", () => {
    const where = feedWhere(auth(["calendar"]), { type: "STAGE_UPDATED" });
    expect(where.update.type.in).toEqual([]);
  });
});

describe("lotUrl", () => {
  it("opens the overview of a lot by default", () => {
    expect(lotUrl("IKC-ABCD-001", "abcd-001-l1")).toBe(
      "/admin/projects/ikc-abcd-001?lot=abcd-001-l1&tab=overview",
    );
  });

  it("maps a tab kind to its tab id", () => {
    expect(lotUrl("p1", "l1", "ARCHITECTURE_DRAWINGS")).toBe(
      "/admin/projects/p1?lot=l1&tab=architecture_drawings",
    );
  });

  it("maps the site-photo kinds to the site_photos tab and a subtab", () => {
    expect(lotUrl("p1", "l1", "INSTALLATION_PHOTOS")).toBe(
      "/admin/projects/p1?lot=l1&tab=site_photos&sub=installation",
    );
  });
});

describe("formatAdelaide", () => {
  it("formats in Adelaide time", () => {
    // 00:00 UTC on 3 Oct 2026 is 10:30 in Adelaide (daylight saving)
    expect(formatAdelaide("2026-10-03T00:00:00.000Z")).toMatch(/3 Oct 2026/);
  });

  it("does not throw on a missing or invalid date", () => {
    expect(formatAdelaide(undefined)).toBe("an unknown time");
    expect(formatAdelaide("garbage")).toBe("an unknown time");
  });
});

describe("publishMtoCreated", () => {
  it("does not announce an empty draft", async () => {
    expect(await publishMtoCreated({ mtoId: "m1", itemCount: 0 })).toBe(false);
    expect(prismaMock.users.findMany).not.toHaveBeenCalled();
  });

  it("announces once per MTO, linking to its row", async () => {
    await publishMtoCreated({
      mtoId: "m1",
      projectName: "Smith",
      itemCount: 2,
    });
    const { data } = prismaMock.update_event.create.mock.calls[0][0];
    expect(data).toMatchObject({
      type: "MTO_CREATED",
      message: "2 items for Smith",
      url: "/admin/suppliers/materialstoorder?mto=m1",
      dedupe_key: "mto-created:m1",
    });
  });
});

describe("publishLotNotesUpdate", () => {
  const lot = {
    lot_id: "l1",
    name: "Lot 1",
    project_id: "p1",
    project: { name: "Smith" },
  };

  it("collapses tab-note saves per lot and tab for 30 minutes", async () => {
    prismaMock.lot.findUnique.mockResolvedValue(lot);
    prismaMock.update_event.findFirst.mockResolvedValue({ id: "e-old" });

    await publishLotNotesUpdate({
      req: undefined,
      lotId: "l1",
      tabKind: "CHANGES_TO_DO",
    });

    const { where } = prismaMock.update_event.findFirst.mock.calls[0][0];
    expect(where.dedupe_key).toBe("notes:l1:CHANGES_TO_DO");
    expect(prismaMock.update_event.update.mock.calls[0][0].data.url).toBe(
      "/admin/projects/p1?lot=l1&tab=changes_to_do",
    );
  });

  it("uses the overview for lot-level notes", async () => {
    prismaMock.lot.findUnique.mockResolvedValue(lot);
    await publishLotNotesUpdate({ lotId: "l1" });
    const { data } = prismaMock.update_event.create.mock.calls[0][0];
    expect(data.message).toBe("Overview notes (Lot 1, Smith)");
    expect(data.dedupe_key).toBe("notes:l1:overview");
  });

  it("does nothing when the lot is gone", async () => {
    prismaMock.lot.findUnique.mockResolvedValue(null);
    expect(await publishLotNotesUpdate({ lotId: "gone" })).toBe(false);
    expect(prismaMock.update_event.create).not.toHaveBeenCalled();
  });
});
