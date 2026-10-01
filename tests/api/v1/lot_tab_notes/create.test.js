// Tests for src/app/api/v1/lot_tab_notes/create/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { POST } = await import("@/app/api/v1/lot_tab_notes/create/route");

const URL = "/api/v1/lot_tab_notes/create";
const validBody = () => ({
  lot_id: "lot-1",
  tab: "architecture",
  notes: "First note",
});
const created = (overrides = {}) => ({
  id: "tab-1",
  ...validBody(),
  ...overrides,
});

const post = (body = validBody(), options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

function mockCreate() {
  prismaMock.lot_tab.create.mockImplementation(async ({ data }) => ({
    id: "tab-1",
    ...data,
  }));
  prismaMock.logs.create.mockResolvedValue({});
}

describe("POST /api/v1/lot_tab_notes/create", () => {
  describeAuthorization((options) => post(undefined, options), {
    modules: "project_details",
    setup: mockCreate,
    untouched: () => [prismaMock.lot_tab.create],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockCreate();
    });

    it("creates the lot tab and logs the creation", async () => {
      const res = await post();

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Lot tab notes saved successfully",
        data: created(),
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.lot_tab.create).toHaveBeenCalledWith({
        data: validBody(),
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "lot_tab_notes",
          entity_id: "tab-1",
          action: "CREATE",
          description: "Lot tab notes saved successfully: First note",
        },
      });
    });

    it("ignores fields other than lot_id, tab and notes", async () => {
      await post({ ...validBody(), id: "forced-id", is_deleted: true });

      expect(prismaMock.lot_tab.create).toHaveBeenCalledWith({
        data: validBody(),
      });
    });

    // Current behaviour: no validation; missing fields go straight to Prisma,
    // which would reject them if the columns are required.
    it("passes missing fields through as undefined", async () => {
      await post({});

      expect(prismaMock.lot_tab.create).toHaveBeenCalledWith({
        data: { lot_id: undefined, tab: undefined, notes: undefined },
      });
    });

    it("returns 201 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await post();

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({
        status: true,
        message: "Lot tab notes saved successfully",
        data: created(),
        warning: "Note: Creation succeeded but logging failed",
      });
    });

    it("returns 500 when the create fails", async () => {
      prismaMock.lot_tab.create.mockRejectedValue(new Error("FK violation"));

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
      expect(prismaMock.lot_tab.create).not.toHaveBeenCalled();
    });
  });
});
