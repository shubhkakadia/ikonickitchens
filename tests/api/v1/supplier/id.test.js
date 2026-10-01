// Tests for src/app/api/v1/supplier/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET, PATCH, DELETE } = await import("@/app/api/v1/supplier/[id]/route");

const ID = "SUP-1";
const URL = `/api/v1/supplier/${ID}`;
const ctx = () => routeContext({ id: ID });

const storedSupplier = (overrides = {}) => ({
  supplier_id: ID,
  name: "Timber Co",
  is_deleted: false,
  ...overrides,
});

describe("GET /api/v1/supplier/[id]", () => {
  const get = (options) => GET(buildRequest(URL, options), ctx());

  describeAuthorization(get, {
    modules: "supplier_details",
    setup: () =>
      prismaMock.supplier.findFirst.mockResolvedValue(storedSupplier()),
    untouched: () => [prismaMock.supplier.findFirst],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.supplier.findFirst.mockResolvedValue(storedSupplier());
    });

    it("returns the supplier with contacts and statements", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Supplier fetched successfully",
        data: storedSupplier(),
      });
      expect(prismaMock.supplier.findFirst).toHaveBeenCalledWith({
        where: { supplier_id: ID, is_deleted: false },
        include: {
          contacts: true,
          statements: { include: { supplier_file: true } },
        },
      });
    });

    it("returns 404 when the supplier does not exist or is deleted", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Supplier not found",
      });
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.supplier.findFirst.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});

describe("PATCH /api/v1/supplier/[id]", () => {
  const patch = (body = { name: "Renamed" }, options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());

  function mockUpdate() {
    prismaMock.supplier.update.mockImplementation(async ({ data }) =>
      storedSupplier(data),
    );
    prismaMock.logs.create.mockResolvedValue({});
  }

  const updateData = () => prismaMock.supplier.update.mock.calls[0][0].data;

  describeAuthorization((options) => patch(undefined, options), {
    modules: "supplier_details",
    setup: mockUpdate,
    untouched: () => [prismaMock.supplier.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    it("updates the supplier and logs the update", async () => {
      const res = await patch({
        name: "Renamed",
        email: "new@timber.test",
        address: "2 Mill Rd",
        notes: "n",
        website: "https://new.test",
        abn_number: "99",
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe("Supplier updated successfully");
      expect(json.warning).toBeUndefined();
      expect(prismaMock.supplier.update).toHaveBeenCalledWith({
        where: { supplier_id: ID },
        data: expect.objectContaining({
          name: "Renamed",
          email: "new@timber.test",
          address: "2 Mill Rd",
          notes: "n",
          website: "https://new.test",
          abn_number: "99",
        }),
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "supplier",
          entity_id: ID,
          action: "UPDATE",
          description: "Supplier updated successfully: Renamed",
        },
      });
    });

    it("sends omitted fields as undefined so they are left unchanged", async () => {
      await patch({ notes: "only notes" });

      expect(updateData()).toEqual({
        name: undefined,
        email: undefined,
        phone: undefined,
        address: undefined,
        notes: "only notes",
        website: undefined,
        abn_number: undefined,
      });
    });

    it("formats the phone number", async () => {
      await patch({ phone: "+61412345678" });

      expect(updateData().phone).toBe("0412 345 678");
    });

    it.each([null, ""])("passes phone %j through unchanged", async (phone) => {
      await patch({ phone });

      expect(updateData().phone).toBe(phone);
    });

    it("never changes the supplier id", async () => {
      await patch({ name: "x", supplier_id: "hacked", is_deleted: true });

      expect(updateData()).not.toHaveProperty("supplier_id");
      expect(updateData()).not.toHaveProperty("is_deleted");
      expect(prismaMock.supplier.update.mock.calls[0][0].where).toEqual({
        supplier_id: ID,
      });
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await patch();

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Update succeeded but logging failed",
      );
    });

    // Current behaviour: no existence check, so a missing supplier (Prisma
    // P2025) or a duplicate name (P2002) is a 500.
    it.each([
      ["a missing supplier", "P2025"],
      ["a duplicate name", "P2002"],
    ])("returns 500 for %s", async (_, code) => {
      prismaMock.supplier.update.mockRejectedValue(
        Object.assign(new Error("Prisma error"), { code }),
      );

      const res = await patch();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 500 for a malformed JSON body", async () => {
      const res = await PATCH(
        buildRequest(URL, {
          method: "PATCH",
          rawBody: "{not json",
          headers: { "content-type": "application/json" },
        }),
        ctx(),
      );

      expect(res.status).toBe(500);
      expect(prismaMock.supplier.update).not.toHaveBeenCalled();
    });
  });
});

describe("DELETE /api/v1/supplier/[id]", () => {
  const del = (options) =>
    DELETE(buildRequest(URL, { method: "DELETE", ...options }), ctx());

  function mockDelete(existing = storedSupplier()) {
    prismaMock.supplier.findUnique.mockResolvedValue(existing);
    prismaMock.supplier.update.mockImplementation(async ({ data }) =>
      storedSupplier(data),
    );
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization(del, {
    modules: "supplier_details",
    setup: () => mockDelete(),
    untouched: () => [prismaMock.supplier.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    it("soft deletes the supplier and logs the deletion", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Supplier deleted successfully",
        data: storedSupplier({ is_deleted: true }),
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.supplier.update).toHaveBeenCalledWith({
        where: { supplier_id: ID },
        data: { is_deleted: true },
      });
      expect(prismaMock.supplier.delete).not.toHaveBeenCalled();
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "supplier",
          entity_id: ID,
          action: "DELETE",
          description: "Supplier deleted successfully: Timber Co",
        },
      });
    });

    it("returns 404 when the supplier does not exist", async () => {
      mockDelete(null);

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Supplier not found",
      });
      expect(prismaMock.supplier.update).not.toHaveBeenCalled();
    });

    it("returns 400 when the supplier is already deleted", async () => {
      mockDelete(storedSupplier({ is_deleted: true }));

      const res = await del();

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Supplier already deleted",
      });
      expect(prismaMock.supplier.update).not.toHaveBeenCalled();
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Supplier deleted successfully",
        data: storedSupplier({ is_deleted: true }),
        warning: "Note: Deletion succeeded but logging failed",
      });
    });

    it("returns 500 when the update fails", async () => {
      prismaMock.supplier.update.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
