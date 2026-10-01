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

// `stock` is what a failed conditional decrement reports as available.
// `takes` is whether the conditional decrement succeeds.
function mockReserve({
  stock = 10,
  takes = true,
  mto = {},
  item = {},
  alreadyReserved = 0,
} = {}) {
  prismaMock.item.findUnique.mockResolvedValue({
    item_id: "ITEM-A",
    quantity: stock,
    is_deleted: false,
    ...item,
  });
  prismaMock.materials_to_order_item.findUnique.mockResolvedValue(
    mto === null
      ? null
      : {
          id: "mi-1",
          item_id: "ITEM-A",
          quantity: 10,
          mto: { is_deleted: false },
          ...mto,
        },
  );
  prismaMock.reserve_item_stock.aggregate.mockResolvedValue({
    _sum: { quantity: alreadyReserved || null },
  });
  prismaMock.item.updateMany.mockResolvedValue({ count: takes ? 1 : 0 });
  prismaMock.reserve_item_stock.create.mockImplementation(async ({ data }) => ({
    id: "res-1",
    ...data,
  }));
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

    it("takes the stock with a conditional decrement, never below zero", async () => {
      await post();

      expect(prismaMock.item.updateMany).toHaveBeenCalledWith({
        where: {
          item_id: "ITEM-A",
          is_deleted: false,
          quantity: { gte: 4 },
        },
        data: { quantity: { decrement: 4 } },
      });
      // an unconditional update is what used to let stock go negative
      expect(prismaMock.item.update).not.toHaveBeenCalled();
    });

    it("locks the MTO line before checking anything", async () => {
      await post();

      expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
      const [strings, ...values] = prismaMock.$queryRaw.mock.calls[0];
      expect(strings.join("?")).toMatch(
        /FROM materials_to_order_item[\s\S]*FOR UPDATE/,
      );
      expect(values).toEqual(["mi-1"]);
      expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prismaMock.item.updateMany.mock.invocationCallOrder[0],
      );
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
      expect(prismaMock.item.updateMany.mock.calls[0][0].data.quantity).toEqual(
        { decrement: 6 },
      );
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

      it.each([
        ["negative", -3],
        ["not a number", "abc"],
        ["Infinity", "Infinity"],
      ])("returns 400 when the quantity is %s", async (_, quantity) => {
        const res = await post(validBody({ quantity }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Quantity must be greater than 0",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it("rejects a fractional quantity instead of truncating it", async () => {
        const res = await post(validBody({ quantity: 2.9 }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Quantity must be a whole number",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it.each([
        ["does not exist", null],
        ["is soft deleted", { is_deleted: true }],
      ])("returns 404 when the item %s", async (_, item) => {
        if (item === null) {
          prismaMock.item.findUnique.mockResolvedValue(null);
        } else {
          mockReserve({ item });
        }

        const res = await post();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Item not found",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
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

      it("returns 400 when the MTO line is for a different item", async () => {
        mockReserve({ mto: { item_id: "ITEM-OTHER" } });

        const res = await post();

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Item does not match the materials to order item",
        });
        expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.reserve_item_stock.create).not.toHaveBeenCalled();
      });
    });

    describe("stock and MTO limits", () => {
      it("allows reserving exactly the available stock", async () => {
        mockReserve({ stock: 4 });

        const res = await post();

        expect(res.status).toBe(201);
      });

      it("returns 400 with the shortage when the conditional decrement loses", async () => {
        mockReserve({ stock: 3, takes: false });

        const res = await post();

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Not enough stock available",
          data: { available: 3, requested: 4, shortage: 1 },
        });
        expect(prismaMock.reserve_item_stock.create).not.toHaveBeenCalled();
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
        expect(checkAndUpdateMTOStatus).not.toHaveBeenCalled();
      });

      it("treats missing stock as zero", async () => {
        mockReserve({ stock: null, takes: false });

        const res = await post();

        expect(res.status).toBe(400);
        expect((await res.json()).data.available).toBe(0);
      });

      it("does not over-reserve when two requests race for the last units", async () => {
        // Only one conditional decrement can win; the loser must be refused
        // rather than pushing stock negative.
        let stock = 10;
        prismaMock.item.updateMany.mockImplementation(async ({ where, data }) => {
          if (stock >= where.quantity.gte) {
            stock -= data.quantity.decrement;
            return { count: 1 };
          }
          return { count: 0 };
        });
        prismaMock.item.findUnique.mockImplementation(async () => ({
          item_id: "ITEM-A",
          quantity: stock,
          is_deleted: false,
        }));
        mockMasterAdmin();
        prismaMock.materials_to_order_item.findUnique.mockResolvedValue({
          id: "mi-1",
          item_id: "ITEM-A",
          quantity: 10,
          mto: { is_deleted: false },
        });

        const [a, b] = await Promise.all([
          post(validBody({ quantity: 10 })),
          post(validBody({ quantity: 10 })),
        ]);

        expect([a.status, b.status].sort()).toEqual([201, 400]);
        expect(stock).toBe(0);
      });

      it("allows reserving up to what the MTO line needs", async () => {
        mockReserve({ alreadyReserved: 6 });

        const res = await post();

        expect(res.status).toBe(201);
        expect(prismaMock.reserve_item_stock.aggregate).toHaveBeenCalledWith({
          where: { mto_id: "mi-1" },
          _sum: { quantity: true },
        });
      });

      it("returns 400 when total reservations would exceed the MTO quantity", async () => {
        mockReserve({ alreadyReserved: 7 });

        const res = await post();

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Reservation would exceed the quantity required by the materials to order item",
          data: { required: 10, already_reserved: 7, requested: 4 },
        });
        expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.reserve_item_stock.create).not.toHaveBeenCalled();
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

      it("still succeeds when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await post();

        expect(res.status).toBe(201);
        expect(prismaMock.reserve_item_stock.create).toHaveBeenCalledOnce();
        expect(checkAndUpdateMTOStatus).toHaveBeenCalledWith("mi-1");
      });

      it("returns 500 when the transaction fails", async () => {
        prismaMock.reserve_item_stock.create.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await post();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
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
