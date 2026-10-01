// Tests for src/app/api/v1/reserve_item_stock/create/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

vi.mock("@/lib/mtoStatusHelper", () => ({ checkAndUpdateMTOStatus: vi.fn() }));

const { POST } = await import("@/app/api/v1/reserve_item_stock/create/route");
const { checkAndUpdateMTOStatus } = await import("@/lib/mtoStatusHelper");

const URL = "/api/v1/reserve_item_stock/create";
const validBody = (overrides = {}) => ({
  item_id: "ITEM-A",
  quantity: 4,
  mto_id: "mi-1",
  ...overrides,
});
const post = (body = validBody(), options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

function mockReserve({
  stock = 10,
  mto = { mto: { is_deleted: false } },
} = {}) {
  prismaMock.item.findUnique.mockResolvedValue({
    item_id: "ITEM-A",
    quantity: stock,
  });
  prismaMock.materials_to_order_item.findUnique.mockResolvedValue(mto);
  prismaMock.reserve_item_stock.create.mockImplementation(async ({ data }) => ({
    id: "res-1",
    ...data,
  }));
  prismaMock.item.update.mockResolvedValue({});
  prismaMock.logs.create.mockResolvedValue({});
  checkAndUpdateMTOStatus.mockResolvedValue(false);
}

describe("POST /api/v1/reserve_item_stock/create", () => {
  describeAuthorization((options) => post(undefined, options), {
    modules: "materialstoorder",
    setup: () => mockReserve(),
    untouched: () => [
      prismaMock.reserve_item_stock.create,
      prismaMock.$transaction,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockReserve();
    });

    it("creates the reservation, reduces stock and logs", async () => {
      const res = await post();

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({
        status: true,
        message: "Stock reservation created successfully",
        data: {
          id: "res-1",
          item_id: "ITEM-A",
          quantity: 4,
          mto_id: "mi-1",
          user_id: "user-1",
          used_quantity: 0,
        },
      });
      expect(prismaMock.reserve_item_stock.create).toHaveBeenCalledWith({
        data: {
          item_id: "ITEM-A",
          quantity: 4,
          mto_id: "mi-1",
          user_id: "user-1",
          used_quantity: 0,
        },
      });
      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { item_id: "ITEM-A" },
        data: { quantity: { decrement: 4 } },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "reserve_item_stock",
          entity_id: "res-1",
          action: "CREATE",
          description: "Stock reservation created successfully: ITEM-A",
        },
      });
    });

    it("writes the reservation and stock change in one transaction", async () => {
      await post();

      expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    });

    it("takes the user from the session, not the request body", async () => {
      await post(validBody({ user_id: "attacker" }));

      expect(
        prismaMock.reserve_item_stock.create.mock.calls[0][0].data.user_id,
      ).toBe("user-1");
    });

    it("re-checks the MTO status afterwards", async () => {
      await post();

      expect(checkAndUpdateMTOStatus).toHaveBeenCalledWith("mi-1");
    });

    it("accepts a numeric string quantity and stores an integer", async () => {
      await post(validBody({ quantity: "6" }));

      expect(
        prismaMock.reserve_item_stock.create.mock.calls[0][0].data.quantity,
      ).toBe(6);
      expect(prismaMock.item.update.mock.calls[0][0].data.quantity).toEqual({
        decrement: 6,
      });
    });

    it("truncates a fractional quantity", async () => {
      await post(validBody({ quantity: 2.9 }));

      expect(
        prismaMock.reserve_item_stock.create.mock.calls[0][0].data.quantity,
      ).toBe(2);
    });

    it("allows reserving exactly the available stock", async () => {
      mockReserve({ stock: 4 });

      const res = await post();

      expect(res.status).toBe(201);
    });

    describe("validation", () => {
      it.each([
        ["item_id", { item_id: undefined }],
        ["quantity", { quantity: undefined }],
        ["a quantity of 0", { quantity: 0 }],
        ["mto_id", { mto_id: undefined }],
      ])("returns 400 when %s is missing", async (_, override) => {
        const res = await post(validBody(override));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "item_id, quantity, and mto_id are required",
        });
        expect(prismaMock.item.findUnique).not.toHaveBeenCalled();
      });

      it("returns 400 for a negative quantity", async () => {
        const res = await post(validBody({ quantity: -3 }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Quantity must be greater than 0",
        });
      });

      it("returns 404 when the item does not exist", async () => {
        prismaMock.item.findUnique.mockResolvedValue(null);

        const res = await post();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Item not found",
        });
        expect(prismaMock.item.findUnique).toHaveBeenCalledWith({
          where: { item_id: "ITEM-A" },
        });
      });

      it.each([
        ["does not exist", null],
        ["belongs to a deleted MTO", { mto: { is_deleted: true } }],
      ])("returns 404 when the MTO item %s", async (_, mto) => {
        mockReserve({ mto });

        const res = await post();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Materials to order item not found",
        });
        expect(
          prismaMock.materials_to_order_item.findUnique,
        ).toHaveBeenCalledWith({
          where: { id: "mi-1" },
          include: { mto: { select: { is_deleted: true } } },
        });
        expect(prismaMock.reserve_item_stock.create).not.toHaveBeenCalled();
      });

      it("checks the item before the MTO item", async () => {
        prismaMock.item.findUnique.mockResolvedValue(null);
        prismaMock.materials_to_order_item.findUnique.mockResolvedValue(null);

        const res = await post();

        expect((await res.json()).message).toBe("Item not found");
      });

      it("returns 400 with the shortage when stock is insufficient", async () => {
        mockReserve({ stock: 3 });

        const res = await post();

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Not enough stock available",
          data: { available: 3, requested: 4, shortage: 1 },
        });
        expect(prismaMock.reserve_item_stock.create).not.toHaveBeenCalled();
        expect(prismaMock.item.update).not.toHaveBeenCalled();
      });

      it("treats missing stock as zero", async () => {
        mockReserve({ stock: null });

        const res = await post();

        expect(res.status).toBe(400);
        expect((await res.json()).data.available).toBe(0);
      });

      // Current behaviour: a non-numeric quantity passes validation (NaN <= 0
      // and 10 < NaN are both false) and NaN is sent to the database.
      it("passes NaN through for a non-numeric quantity", async () => {
        await post(validBody({ quantity: "abc" }));

        expect(
          prismaMock.reserve_item_stock.create.mock.calls[0][0].data.quantity,
        ).toBeNaN();
      });
    });

    describe("failures", () => {
      it("returns 401 when the session cannot be re-read", async () => {
        const session = mockMasterAdmin();
        prismaMock.sessions.findUnique
          .mockReset()
          .mockResolvedValueOnce(session)
          .mockResolvedValueOnce(null);

        const res = await post();

        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({
          status: false,
          message: "Invalid session",
        });
        expect(prismaMock.item.findUnique).not.toHaveBeenCalled();
      });

      // Current behaviour (bug): the "log failed" branch references an
      // undefined `employee` variable (copy-paste from the employee route), so
      // it throws a ReferenceError. The reservation and stock change are
      // already committed, but the caller gets a 500 and the MTO status is
      // not re-checked.
      it("returns 500 after committing when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await post();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
        expect(prismaMock.reserve_item_stock.create).toHaveBeenCalledOnce();
        expect(prismaMock.item.update).toHaveBeenCalledOnce();
        expect(checkAndUpdateMTOStatus).not.toHaveBeenCalled();
      });

      it("returns 500 when the transaction fails", async () => {
        prismaMock.reserve_item_stock.create.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await post();

        expect(res.status).toBe(500);
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 when the status check fails", async () => {
        checkAndUpdateMTOStatus.mockRejectedValue(new Error("DB down"));

        const res = await post();

        expect(res.status).toBe(500);
      });

      it("returns 500 for a malformed JSON body", async () => {
        const res = await POST(
          buildRequest(URL, {
            method: "POST",
            rawBody: "{not json",
            headers: { "content-type": "application/json" },
          }),
        );

        expect(res.status).toBe(500);
        expect(prismaMock.reserve_item_stock.create).not.toHaveBeenCalled();
      });
    });
  });
});
