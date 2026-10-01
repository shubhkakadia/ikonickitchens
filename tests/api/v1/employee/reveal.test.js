// Tests for src/app/api/v1/employee/[id]/reveal/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin, mockAuthorizedUser } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { encryptValue } from "@/lib/employeeData";

const { GET } = await import("@/app/api/v1/employee/[id]/reveal/route");

const reveal = (field, options) =>
  GET(
    buildRequest(`/api/v1/employee/EMP-1/reveal?field=${field}`, options),
    routeContext({ id: "EMP-1" }),
  );

describe("GET /api/v1/employee/[id]/reveal", () => {
  beforeEach(() => {
    process.env.EMPLOYEE_DATA_KEY = "test-key";
    prismaMock.logs.create.mockResolvedValue({});
  });

  it("rejects requests without a token", async () => {
    const res = await reveal("tfn_number", { token: null });
    expect(res.status).toBe(401);
  });

  it.each(["admin", "manager", "employee"])(
    "forbids %s users, even with every module",
    async (userType) => {
      mockAuthorizedUser({
        userType,
        modules: ["all_employees", "employee_details"],
      });

      const res = await reveal("tfn_number");

      expect(res.status).toBe(403);
      expect(prismaMock.employees.findFirst).not.toHaveBeenCalled();
    },
  );

  describe("as master-admin", () => {
    beforeEach(() => mockMasterAdmin());

    it("returns the decrypted value and writes an audit log", async () => {
      prismaMock.employees.findFirst.mockResolvedValue({
        employee_id: "EMP-1",
        tfn_number: encryptValue("123456789"),
      });

      const res = await reveal("tfn_number");

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual({
        field: "tfn_number",
        value: "123456789",
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entity_type: "employee",
          entity_id: "EMP-1",
          action: "OTHER",
        }),
      });
    });

    it("reveals the super member ID", async () => {
      prismaMock.employees.findFirst.mockResolvedValue({
        employee_id: "EMP-1",
        supper_account_number: encryptValue("998877661"),
      });

      const res = await reveal("supper_account_number");

      expect((await res.json()).data).toEqual({
        field: "supper_account_number",
        value: "998877661",
      });
    });

    it("returns legacy plaintext values as stored", async () => {
      prismaMock.employees.findFirst.mockResolvedValue({
        employee_id: "EMP-1",
        bank_account_number: "12345678",
      });

      const res = await reveal("bank_account_number");

      expect((await res.json()).data.value).toBe("12345678");
    });

    it.each(["dob", "address", "password", ""])(
      "rejects the non-revealable field %j",
      async (field) => {
        const res = await reveal(field);

        expect(res.status).toBe(400);
        expect(prismaMock.employees.findFirst).not.toHaveBeenCalled();
      },
    );

    it("returns 404 for an unknown or deleted employee", async () => {
      prismaMock.employees.findFirst.mockResolvedValue(null);

      const res = await reveal("tfn_number");

      expect(res.status).toBe(404);
    });

    it("refuses to reveal when the audit log cannot be written", async () => {
      prismaMock.employees.findFirst.mockResolvedValue({
        employee_id: "EMP-1",
        tfn_number: "123456789",
      });
      prismaMock.logs.create.mockRejectedValue(new Error("db down"));

      const res = await reveal("tfn_number");

      expect(res.status).toBe(500);
      expect(JSON.stringify(await res.json())).not.toContain("123456789");
    });
  });
});
