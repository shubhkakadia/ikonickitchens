// Tests for src/app/api/v1/project/next-id/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/project/next-id/route");

const get = (query = "?client_id=client-1", options) =>
  GET(buildRequest(`/api/v1/project/next-id${query}`, options));

function mockLookup({ slug = "btto", projects = [], missing = false } = {}) {
  prismaMock.client.findFirst.mockResolvedValue(
    missing ? null : { client_slug: slug },
  );
  prismaMock.project.findMany.mockResolvedValue(
    projects.map((project_id) => ({ project_id })),
  );
}

describe("GET /api/v1/project/next-id", () => {
  describeAuthorization((options) => get(undefined, options), {
    modules: ["add_projects", "client_details"],
    setup: () => mockLookup(),
    untouched: () => [prismaMock.client.findFirst],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockLookup();
    });

    it("returns the first id for a client with no projects", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        data: { project_id: "IKC-BTTO-0001", sequence: 1 },
      });
    });

    it("looks up the client by id, ignoring deleted clients", async () => {
      await get("?client_id=client-9");

      expect(prismaMock.client.findFirst).toHaveBeenCalledWith({
        where: { client_id: "client-9", is_deleted: false },
        select: { client_slug: true },
      });
    });

    it("searches the client's existing project ids by prefix", async () => {
      await get();

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: { project_id: { startsWith: "IKC-btto-" } },
        select: { project_id: true },
      });
    });

    it("continues after the highest existing sequence, case-insensitively", async () => {
      mockLookup({
        projects: ["ikc-btto-0001", "IKC-BTTO-0007", "ikc-btto-0003"],
      });

      const res = await get();

      expect((await res.json()).data).toEqual({
        project_id: "IKC-BTTO-0008",
        sequence: 8,
      });
    });

    it("ignores ids that do not match the client's pattern", async () => {
      mockLookup({ projects: ["ikc-btto-abc", "ikc-btto-0002", "custom-id"] });

      expect((await (await get()).json()).data.sequence).toBe(3);
    });

    it("returns 400 when client_id is missing or empty", async () => {
      for (const query of ["", "?client_id="]) {
        const res = await get(query);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Client is required",
        });
      }
      expect(prismaMock.client.findFirst).not.toHaveBeenCalled();
    });

    it("returns 404 when the client does not exist", async () => {
      mockLookup({ missing: true });

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Client not found",
      });
      expect(prismaMock.project.findMany).not.toHaveBeenCalled();
    });

    it.each([
      ["too short", "ab"],
      ["too long", "abcde"],
      ["contains digits", "ab12"],
      ["empty", ""],
      ["null", null],
    ])("returns 409 when the client slug is %s", async (_, slug) => {
      mockLookup({ slug });

      const res = await get();

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        status: false,
        message: "Client has an invalid slug",
      });
      expect(prismaMock.project.findMany).not.toHaveBeenCalled();
    });

    it("returns 409 when the sequence limit is reached", async () => {
      mockLookup({ projects: ["IKC-BTTO-9999"] });

      const res = await get();

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        status: false,
        message: "Project ID sequence limit reached for this client",
      });
    });

    it("returns 500 when a query fails", async () => {
      prismaMock.client.findFirst.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
