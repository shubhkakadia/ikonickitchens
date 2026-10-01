import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/contact/all/route");

const get = (options) => GET(buildRequest("/api/v1/contact/all", options));

describe("GET /api/v1/contact/all", () => {
  describeAuthorization(get, {
    modules: ["client_details", "supplier_details"],
    setup: () => prismaMock.contact.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.contact.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("returns every contact", async () => {
      const contacts = [
        { id: "k1", first_name: "Ann", client_id: "c1", supplier_id: null },
        { id: "k2", first_name: "Bob", client_id: null, supplier_id: "s1" },
      ];
      prismaMock.contact.findMany.mockResolvedValue(contacts);

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Contacts fetched successfully",
        data: contacts,
      });
    });

    // Current behaviour: no filter at all. Contacts of soft-deleted clients
    // and suppliers are included, and a caller with only client_details
    // also receives supplier contacts (and vice versa).
    it("queries without any filter", async () => {
      prismaMock.contact.findMany.mockResolvedValue([]);

      await get();

      expect(prismaMock.contact.findMany).toHaveBeenCalledWith();
    });

    it("returns an empty list when there are no contacts", async () => {
      prismaMock.contact.findMany.mockResolvedValue([]);

      const res = await get();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.contact.findMany.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
