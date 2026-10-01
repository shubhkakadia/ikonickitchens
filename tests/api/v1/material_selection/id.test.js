// Tests for src/app/api/v1/material_selection/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/material_selection/[id]/route");

const ID = "ms-1";
const URL = `/api/v1/material_selection/${ID}`;
const get = (options, params = { id: ID }) =>
  GET(buildRequest(URL, options), routeContext(params));

const storedSelection = () => ({
  id: ID,
  lot_id: "LOT-1",
  current_version_id: "v-2",
  currentVersion: { id: "v-2", areas: [] },
});
const storedMedia = () => [{ id: "media-1", material_selection_id: ID }];

function mockFetch() {
  prismaMock.material_selection.findUnique.mockResolvedValue(storedSelection());
  prismaMock.media.findMany.mockResolvedValue(storedMedia());
}

describe("GET /api/v1/material_selection/[id]", () => {
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

    it("returns the selection with its media attached", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Material selection fetched successfully",
        data: { ...storedSelection(), media: storedMedia() },
      });
    });

    it("looks the selection up by id with the nested includes", async () => {
      await get();

      const args = prismaMock.material_selection.findUnique.mock.calls[0][0];
      expect(args.where).toEqual({ id: ID });
      expect(Object.keys(args.include).sort()).toEqual(
        [
          "createdBy",
          "currentVersion",
          "lot",
          "project",
          "quote",
          "versions",
        ].sort(),
      );
      expect(args.include.currentVersion).toEqual({
        include: { areas: { include: { items: true } } },
      });
    });

    it("only fetches media that has not been soft deleted", async () => {
      await get();

      expect(prismaMock.media.findMany).toHaveBeenCalledWith({
        where: { material_selection_id: ID, is_deleted: false },
      });
    });

    it("returns 404 when the selection does not exist", async () => {
      prismaMock.material_selection.findUnique.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Material selection not found",
      });
      expect(prismaMock.media.findMany).not.toHaveBeenCalled();
    });

    it("returns 400 when the id param is missing", async () => {
      const res = await get(undefined, {});

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Material selection ID is required",
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
