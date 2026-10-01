import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/lot/active/route");

const get = (options) => GET(buildRequest("/api/v1/lot/active", options));

describe("GET /api/v1/lot/active", () => {
  describeAuthorization(get, {
    modules: ["calendar", "lotatglance"],
    setup: () => prismaMock.lot.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.lot.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("returns active, non-deleted lots", async () => {
      const lots = [{ id: "l1", lot_id: "lot-1", status: "ACTIVE" }];
      prismaMock.lot.findMany.mockResolvedValue(lots);

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Active lots fetched successfully",
        data: lots,
      });
    });

    it("queries with project/client, stages and assignees, ordered by client name", async () => {
      prismaMock.lot.findMany.mockResolvedValue([]);

      await get();

      expect(prismaMock.lot.findMany).toHaveBeenCalledWith({
        where: { status: "ACTIVE", is_deleted: false },
        include: {
          project: {
            select: {
              name: true,
              project_id: true,
              client: { select: { client_id: true, client_name: true } },
            },
          },
          stages: {
            select: {
              stage_id: true,
              name: true,
              status: true,
              notes: true,
              startDate: true,
              endDate: true,
              assigned_to: {
                include: {
                  employee: {
                    select: {
                      employee_id: true,
                      first_name: true,
                      last_name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { project: { client: { client_name: "asc" } } },
      });
    });

    it("only exposes names and ids of assigned employees", async () => {
      prismaMock.lot.findMany.mockResolvedValue([]);

      await get();

      const { select } =
        prismaMock.lot.findMany.mock.calls[0][0].include.stages.select
          .assigned_to.include.employee;
      expect(Object.keys(select)).toEqual([
        "employee_id",
        "first_name",
        "last_name",
      ]);
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.lot.findMany.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
