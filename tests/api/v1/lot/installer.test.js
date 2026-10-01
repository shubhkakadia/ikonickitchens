// Tests for src/app/api/v1/lot/installer/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthorizedUser } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/lot/installer/[id]/route");

const ALL_ROLES = ["master-admin", "admin", "manager", "employee"];
const get = (id = "EMP-7", options) =>
  GET(
    buildRequest(`/api/v1/lot/installer/${id}`, options),
    routeContext({ id }),
  );

const whereOf = () => prismaMock.lot.findMany.mock.calls[0][0].where;

describe("GET /api/v1/lot/installer/[id]", () => {
  beforeEach(() => {
    prismaMock.lot.findMany.mockResolvedValue([]);
  });

  describeAuthorization((options) => get("EMP-7", options), {
    roles: ALL_ROLES,
    modules: "site_photos",
    untouched: () => [prismaMock.lot.findMany],
  });

  describe("handler", () => {
    it.each(["master-admin", "admin"])(
      "gives a %s every active lot",
      async (userType) => {
        mockAuthorizedUser({ userType, modules: ["site_photos"] });
        const lots = [{ id: "l1" }, { id: "l2" }];
        prismaMock.lot.findMany.mockResolvedValue(lots);

        const res = await get();

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "All active lots fetched successfully",
          data: lots,
        });
        expect(whereOf()).toEqual({ status: "ACTIVE", is_deleted: false });
      },
    );

    it.each(["manager", "employee"])(
      "limits a %s to lots where they are the installer",
      async (userType) => {
        mockAuthorizedUser({
          userType,
          modules: ["site_photos"],
          employeeId: "EMP-7",
        });

        const res = await get();

        expect(res.status).toBe(200);
        expect((await res.json()).message).toBe(
          "Installer lots fetched successfully",
        );
        expect(whereOf()).toEqual({
          status: "ACTIVE",
          is_deleted: false,
          installer_id: "EMP-7",
        });
      },
    );

    it("ignores the id in the URL for non-admins (no peeking at others)", async () => {
      mockAuthorizedUser({
        userType: "employee",
        modules: ["site_photos"],
        employeeId: "EMP-7",
      });

      await get("EMP-SOMEONE-ELSE");

      expect(whereOf().installer_id).toBe("EMP-7");
    });

    it("returns an empty list without querying for a non-admin with no employee record", async () => {
      mockAuthorizedUser({
        userType: "manager",
        modules: ["site_photos"],
        employeeId: null,
      });

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Installer lots fetched successfully",
        data: [],
      });
      expect(prismaMock.lot.findMany).not.toHaveBeenCalled();
    });

    it("includes project/client and only non-deleted cabinetry drawings", async () => {
      mockAuthorizedUser({ userType: "admin", modules: ["site_photos"] });

      await get();

      const args = prismaMock.lot.findMany.mock.calls[0][0];
      expect(args.include).toEqual({
        project: {
          select: {
            name: true,
            project_id: true,
            client: { select: { client_name: true } },
          },
        },
        tabs: {
          where: { tab: "CABINETRY_DRAWINGS" },
          include: {
            files: {
              where: { is_deleted: false },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      });
      expect(args.orderBy).toEqual({ project: { name: "asc" } });
    });

    it("returns 400 when the id is empty", async () => {
      mockAuthorizedUser({ userType: "admin", modules: ["site_photos"] });

      const res = await get("");

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "id is required",
      });
      expect(prismaMock.lot.findMany).not.toHaveBeenCalled();
    });

    it("returns 500 when the query fails", async () => {
      mockAuthorizedUser({ userType: "admin", modules: ["site_photos"] });
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
