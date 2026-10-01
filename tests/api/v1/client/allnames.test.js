import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/client/allnames/route");

const get = (options) => GET(buildRequest("/api/v1/client/allnames", options));

describe("GET /api/v1/client/allnames", () => {
  describeAuthorization(get, {
    modules: ["add_projects", "project_details"],
    setup: () => prismaMock.client.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.client.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("returns only id, name, slug and type for non-deleted clients", async () => {
      const clients = [
        {
          client_id: "c1",
          client_name: "Bettio Construction",
          client_slug: "BTTO",
          client_type: "builder",
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
        select: {
          client_id: true,
          client_name: true,
          client_slug: true,
          client_type: true,
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
