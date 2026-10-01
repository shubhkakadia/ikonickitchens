// Tests for src/app/api/v1/lot_tab_notes/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET, PATCH } = await import("@/app/api/v1/lot_tab_notes/[id]/route");

const ID = "tab-1";
const URL = `/api/v1/lot_tab_notes/${ID}`;
const ctx = () => routeContext({ id: ID });

const storedTab = (overrides = {}) => ({
  id: ID,
  lot_id: "lot-1",
  tab: "architecture",
  notes: "Old note",
  ...overrides,
});

describe("GET /api/v1/lot_tab_notes/[id]", () => {
  const get = (options) => GET(buildRequest(URL, options), ctx());

  describeAuthorization(get, {
    modules: "project_details",
    setup: () => prismaMock.lot_tab.findUnique.mockResolvedValue(storedTab()),
    untouched: () => [prismaMock.lot_tab.findUnique],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("returns the lot tab", async () => {
      prismaMock.lot_tab.findUnique.mockResolvedValue(storedTab());

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Lot tab notes fetched successfully",
        data: storedTab(),
      });
      expect(prismaMock.lot_tab.findUnique).toHaveBeenCalledWith({
        where: { id: ID },
      });
    });

    // Current behaviour: a missing tab is not a 404; data is null.
    it("returns 200 with null data when the tab does not exist", async () => {
      prismaMock.lot_tab.findUnique.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toBeNull();
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.lot_tab.findUnique.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});

describe("PATCH /api/v1/lot_tab_notes/[id]", () => {
  const patch = (body = { notes: "New note" }, options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());

  function mockUpdate() {
    prismaMock.lot_tab.update.mockImplementation(async ({ data }) =>
      storedTab(data),
    );
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization((options) => patch(undefined, options), {
    modules: "project_details",
    setup: mockUpdate,
    untouched: () => [prismaMock.lot_tab.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    it("updates the notes and logs the update", async () => {
      const res = await patch({ notes: "Measure twice" });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Lot tab notes updated successfully",
        data: storedTab({ notes: "Measure twice" }),
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.lot_tab.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { notes: "Measure twice" },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "lot_tab_notes",
          entity_id: ID,
          action: "UPDATE",
          description: "Lot tab notes updated successfully: Measure twice",
        },
      });
    });

    it("ignores fields other than notes", async () => {
      await patch({ notes: "Hi", lot_id: "other-lot", tab: "other" });

      expect(prismaMock.lot_tab.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { notes: "Hi" },
      });
    });

    it.each([
      ["an empty string", ""],
      ["null", null],
    ])("allows clearing the notes with %s", async (_, notes) => {
      const res = await patch({ notes });

      expect(res.status).toBe(200);
      expect(prismaMock.lot_tab.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { notes },
      });
    });

    // Current behaviour: no validation; Prisma treats undefined as "no change".
    it("calls update with undefined notes when the body is empty", async () => {
      const res = await patch({});

      expect(res.status).toBe(200);
      expect(prismaMock.lot_tab.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { notes: undefined },
      });
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await patch();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Lot tab notes updated successfully",
        data: storedTab({ notes: "New note" }),
        warning: "Note: Update succeeded but logging failed",
      });
    });

    // Current behaviour: a missing tab surfaces as a Prisma P2025 -> 500, not 404.
    it("returns 500 when the update fails", async () => {
      prismaMock.lot_tab.update.mockRejectedValue(
        Object.assign(new Error("Record to update not found."), {
          code: "P2025",
        }),
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
      expect(prismaMock.lot_tab.update).not.toHaveBeenCalled();
    });
  });
});
