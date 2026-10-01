import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/employee/all/route");

const get = (options) => GET(buildRequest("/api/v1/employee/all", options));

describe("GET /api/v1/employee/all", () => {
  describeAuthorization(get, {
    modules: ["all_employees", "project_details", "site_measurements"],
    setup: () => prismaMock.employees.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.employees.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("returns active, non-deleted employees with their photo", async () => {
      const employees = [{ id: "e1", employee_id: "EMP-1", image: null }];
      prismaMock.employees.findMany.mockResolvedValue(employees);

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Employees fetched successfully",
        data: employees,
      });
      expect(prismaMock.employees.findMany).toHaveBeenCalledWith({
        where: { is_deleted: false, is_active: true },
        include: { image: true },
      });
    });

    // Current behaviour (privacy): there is no select, so every column
    // (TFN, bank and super details, DOB, address...) is returned, including
    // to callers who only hold project_details or site_measurements.
    it("returns every employee column, including banking and TFN", async () => {
      const sensitive = {
        id: "e1",
        tfn_number: "123 456 789",
        bank_account_number: "12345678",
        bank_account_bsb: "065-000",
        supper_account_number: "999",
        dob: "1990-01-01T00:00:00.000Z",
      };
      prismaMock.employees.findMany.mockResolvedValue([sensitive]);

      const { data } = await (await get()).json();

      expect(
        prismaMock.employees.findMany.mock.calls[0][0].select,
      ).toBeUndefined();
      expect(data[0]).toEqual(sensitive);
    });

    it("returns an empty list when there are no employees", async () => {
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
