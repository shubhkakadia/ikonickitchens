import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/client/all/route");

const get = (options) => GET(buildRequest("/api/v1/client/all", options));

describe("GET /api/v1/client/all", () => {
  describeAuthorization(get, {
    modules: "all_clients",
    setup: () => prismaMock.client.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.client.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("returns all non-deleted clients with contacts, projects and lot statuses", async () => {
      const clients = [
        {
          client_id: "c1",
          client_name: "Bettio Construction",
          contacts: [{ id: "k1", first_name: "Ann" }],
          projects: [{ id: "p1", lots: [{ status: "ACTIVE" }] }],
        },
      ];
      prismaMock.client.findMany.mockResolvedValue(clients);

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Clients fetched successfully",
        data: clients,
      });
      expect(prismaMock.client.findMany).toHaveBeenCalledWith({
        where: { is_deleted: false },
        include: {
          contacts: true,
          projects: {
            where: { is_deleted: false },
            include: {
              lots: {
                where: { is_deleted: false },
                select: { status: true },
              },
            },
          },
        },
      });
    });

    it("returns an empty list when there are no clients", async () => {
      prismaMock.client.findMany.mockResolvedValue([]);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.client.findMany.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
