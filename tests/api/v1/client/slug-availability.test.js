import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/client/slug-availability/route");

const get = (query = "slug=ABCD", options) =>
  GET(buildRequest(`/api/v1/client/slug-availability?${query}`, options));

describe("GET /api/v1/client/slug-availability", () => {
  describeAuthorization((options) => get("slug=ABCD", options), {
    modules: ["add_clients", "client_details"],
    setup: () => prismaMock.client.findFirst.mockResolvedValue(null),
    untouched: () => [prismaMock.client.findFirst],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("reports a free slug as available", async () => {
      prismaMock.client.findFirst.mockResolvedValue(null);

      const res = await get("slug=ABCD");

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: true, available: true });
      expect(prismaMock.client.findFirst).toHaveBeenCalledWith({
        where: { client_slug: "ABCD" },
        select: { client_id: true },
      });
    });

    it("reports a taken slug as unavailable", async () => {
      prismaMock.client.findFirst.mockResolvedValue({ client_id: "c1" });

      const res = await get("slug=ABCD");

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: true, available: false });
    });

    it("normalises the slug (uppercase, strips non-alphanumerics) before checking", async () => {
      prismaMock.client.findFirst.mockResolvedValue(null);

      await get("slug=a-b%20c1");

      expect(prismaMock.client.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { client_slug: "ABC1" } }),
      );
    });

    it("excludes the given client id so a client can keep its own slug", async () => {
      prismaMock.client.findFirst.mockResolvedValue(null);

      const res = await get("slug=ABCD&excludeId=c1");

      expect(await res.json()).toEqual({ status: true, available: true });
      expect(prismaMock.client.findFirst).toHaveBeenCalledWith({
        where: { client_slug: "ABCD", NOT: { client_id: "c1" } },
        select: { client_id: true },
      });
    });

    it("ignores an empty excludeId", async () => {
      prismaMock.client.findFirst.mockResolvedValue(null);

      await get("slug=ABCD&excludeId=");

      expect(prismaMock.client.findFirst).toHaveBeenCalledWith({
        where: { client_slug: "ABCD" },
        select: { client_id: true },
      });
    });

    it.each([
      ["too short", "slug=ABC"],
      ["empty", "slug="],
      ["only symbols", "slug=--__"],
      ["symbols leaving < 4 chars", "slug=a-b-c"],
    ])(
      "returns available: false without querying when slug is %s",
      async (_, query) => {
        const res = await get(query);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          available: false,
          message: "Slug must be exactly 4 letters",
        });
        expect(prismaMock.client.findFirst).not.toHaveBeenCalled();
      },
    );

    // Current behaviour: longer slugs are silently truncated to 4 characters.
    it("truncates slugs longer than 4 characters instead of rejecting them", async () => {
      prismaMock.client.findFirst.mockResolvedValue(null);

      const res = await get("slug=abcdef");

      expect(await res.json()).toEqual({ status: true, available: true });
      expect(prismaMock.client.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { client_slug: "ABCD" } }),
      );
    });

    // Current behaviour (bug): searchParams.get() returns null, and
    // normalizeClientSlug(null) becomes "NULL", which passes validation.
    it("checks the literal slug NULL when the slug param is missing", async () => {
      prismaMock.client.findFirst.mockResolvedValue(null);

      const res = await get("");

      expect(await res.json()).toEqual({ status: true, available: true });
      expect(prismaMock.client.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { client_slug: "NULL" } }),
      );
    });

    // Current behaviour: this route has no try/catch, so a DB error
    // propagates to Next.js instead of returning the standard 500 JSON.
    it("throws when the query fails (no error handling)", async () => {
      prismaMock.client.findFirst.mockRejectedValue(new Error("DB down"));

      await expect(get("slug=ABCD")).rejects.toThrow("DB down");
    });
  });
});
