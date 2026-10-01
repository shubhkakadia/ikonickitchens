// Tests for src/app/api/v1/material_selection/lot/[lot_id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } =
  await import("@/app/api/v1/material_selection/lot/[lot_id]/route");

const LOT_ID = "LOT-1";
const URL = `/api/v1/material_selection/lot/${LOT_ID}`;
const get = (options, params = { lot_id: LOT_ID }) =>
  GET(buildRequest(URL, options), routeContext(params));

const storedSelection = () => ({
  id: "ms-1",
  lot_id: LOT_ID,
  current_version_id: "v-2",
  versions: [
    { id: "v-2", version_number: 2, is_current: true },
    { id: "v-1", version_number: 1, is_current: false },
  ],
});
const storedMedia = () => [{ id: "media-1", material_selection_id: "ms-1" }];

function mockFetch() {
  prismaMock.material_selection.findUnique.mockResolvedValue(storedSelection());
  prismaMock.media.findMany.mockResolvedValue(storedMedia());
}

describe("GET /api/v1/material_selection/lot/[lot_id]", () => {
  describeAuthorization(get, {
    modules: "project_details",
    setup: mockFetch,
    untouched: () => [
      prismaMock.material_selection.findUnique,
      prismaMock.media.findMany,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockFetch();
    });

    it("returns the selection for the lot with its media attached", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Material selection fetched successfully",
        data: { ...storedSelection(), media: storedMedia() },
      });
    });

    it("looks the selection up by lot_id, listing versions newest first", async () => {
      await get();

      const args = prismaMock.material_selection.findUnique.mock.calls[0][0];
      expect(args.where).toEqual({ lot_id: LOT_ID });
      expect(args.include.versions).toEqual({
        select: {
          id: true,
          version_number: true,
          is_current: true,
          createdAt: true,
        },
        orderBy: { version_number: "desc" },
      });
    });

    it("only fetches media that has not been soft deleted", async () => {
      await get();

      expect(prismaMock.media.findMany).toHaveBeenCalledWith({
        where: { material_selection_id: "ms-1", is_deleted: false },
      });
    });

    // Current behaviour: unlike GET by id, a lot with no selection is not a 404.
    it("returns 200 with null data when the lot has no selection", async () => {
      prismaMock.material_selection.findUnique.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "No material selection found for this lot",
        data: null,
      });
      expect(prismaMock.media.findMany).not.toHaveBeenCalled();
    });

    it("returns 400 when the lot_id param is missing", async () => {
      const res = await get(undefined, {});

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Lot ID is required",
      });
      expect(prismaMock.material_selection.findUnique).not.toHaveBeenCalled();
    });

    it("returns 500 when the selection query fails", async () => {
      prismaMock.material_selection.findUnique.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal Server Error",
      });
    });

    it("returns 500 when the media query fails", async () => {
      prismaMock.media.findMany.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
    });
  });
});
