import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin, mockAuthorizedUser } from "../../../helpers/auth";
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

    const sensitive = {
      id: "e1",
      tfn_number: "123456789",
      bank_account_number: "12345678",
      bank_account_bsb: "065-000",
      supper_account_number: "999888777",
      dob: "1990-01-01T00:00:00.000Z",
      address: "1 Secret St",
    };

    it("masks the TFN, bank and super numbers even for master-admin", async () => {
      prismaMock.employees.findMany.mockResolvedValue([{ ...sensitive }]);

      const { data } = await (await get()).json();

      expect(data[0]).toMatchObject({
        tfn_number: "***6789",
        bank_account_number: "***5678",
        supper_account_number: "***8777",
        bank_account_bsb: "065-000",
        dob: sensitive.dob,
      });
    });

    it("limits other staff to a public select with masked numbers only", async () => {
      mockAuthorizedUser({ userType: "manager", modules: ["all_employees"] });
      prismaMock.employees.findMany.mockResolvedValue([{ ...sensitive }]);

      const { data } = await (await get()).json();

      const { select } = prismaMock.employees.findMany.mock.calls[0][0];
      expect(select.tfn_number).toBe(true);
      expect(select.dob).toBeUndefined();
      expect(select.address).toBeUndefined();
      expect(select.bank_account_bsb).toBeUndefined();
      expect(data[0].tfn_number).toBe("***6789");
      expect(data[0].bank_account_number).toBe("***5678");
      expect(data[0].dob).toBeUndefined();
      expect(data[0].address).toBeUndefined();
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
