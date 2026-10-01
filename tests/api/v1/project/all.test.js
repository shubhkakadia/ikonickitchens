// Tests for src/app/api/v1/project/all/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/project/all/route");

const URL = "/api/v1/project/all";
const get = (options) => GET(buildRequest(URL, options));

const storedProjects = () => [
  {
    project_id: "ikc-aaaa-0001",
    name: "A",
    client: { client_name: "Acme" },
    lots: [],
  },
  {
    project_id: "ikc-bbbb-0001",
    name: "B",
    client: { client_name: "Beta" },
    lots: [],
  },
];

describe("GET /api/v1/project/all", () => {
  describeAuthorization(get, {
    modules: ["all_projects", "usedmaterial"],
    setup: () => prismaMock.project.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.project.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.project.findMany.mockResolvedValue(storedProjects());
    });

    it("returns the projects", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Projects fetched successfully",
        data: storedProjects(),
      });
    });

    it("excludes deleted projects and lots, and sorts by client name", async () => {
      await get();

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: { is_deleted: false },
        include: { client: true, lots: { where: { is_deleted: false } } },
        orderBy: { client: { client_name: "asc" } },
      });
    });

    it("returns an empty list when there are no projects", async () => {
      prismaMock.project.findMany.mockResolvedValue([]);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.project.findMany.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
