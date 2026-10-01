import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/employee/all_inactive/route");

const get = (options) =>
  GET(buildRequest("/api/v1/employee/all_inactive", options));

describe("GET /api/v1/employee/all_inactive", () => {
  describeAuthorization(get, {
    modules: "all_employees",
    setup: () => prismaMock.employees.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.employees.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("returns inactive, non-deleted employees with their photo", async () => {
      const employees = [{ id: "e2", employee_id: "EMP-2", is_active: false }];
      prismaMock.employees.findMany.mockResolvedValue(employees);

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Employees fetched successfully",
        data: employees,
      });
      expect(prismaMock.employees.findMany).toHaveBeenCalledWith({
        where: { is_deleted: false, is_active: false },
        include: { image: true },
      });
    });

    it("returns an empty list when there are no inactive employees", async () => {
      prismaMock.employees.findMany.mockResolvedValue([]);

      const res = await get();

      expect((await res.json()).data).toEqual([]);
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.employees.findMany.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal Server Error",
      });
    });
  });
});
