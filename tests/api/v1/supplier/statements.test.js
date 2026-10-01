// Tests for src/app/api/v1/supplier/statements/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/supplier/statements/route");

const get = (options) =>
  GET(buildRequest("/api/v1/supplier/statements", options), routeContext());

const storedStatements = () => [
  {
    id: "st-1",
    month_year: "March 2026",
    supplier: { name: "Alpha" },
    supplier_file: null,
  },
];

describe("GET /api/v1/supplier/statements", () => {
  describeAuthorization(get, {
    modules: "statements",
    setup: () => prismaMock.supplier_statement.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.supplier_statement.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.supplier_statement.findMany.mockResolvedValue(
        storedStatements(),
      );
    });

    it("returns the statements with supplier and file", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Statements fetched successfully",
        data: storedStatements(),
      });
      expect(prismaMock.supplier_statement.findMany).toHaveBeenCalledWith({
        where: { supplier: { is_deleted: false } },
        include: { supplier: true, supplier_file: true },
      });
    });

    it("returns an empty list when there are no statements", async () => {
      prismaMock.supplier_statement.findMany.mockResolvedValue([]);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.supplier_statement.findMany.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
