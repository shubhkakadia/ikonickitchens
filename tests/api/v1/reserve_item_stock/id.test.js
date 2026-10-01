// Tests for src/app/api/v1/reserve_item_stock/[id]/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

vi.mock("@/lib/mtoStatusHelper", () => ({ checkAndUpdateMTOStatus: vi.fn() }));

const { GET, PATCH, DELETE } =
  await import("@/app/api/v1/reserve_item_stock/[id]/route");
const { checkAndUpdateMTOStatus } = await import("@/lib/mtoStatusHelper");

const ID = "res-1";
const URL = `/api/v1/reserve_item_stock/${ID}`;
const ctx = () => routeContext({ id: ID });

const storedReservation = (overrides = {}) => ({
  id: ID,
  item_id: "ITEM-A",
  quantity: 5,
  used_quantity: 0,
  mto_id: "mi-1",
  ...overrides,
});

describe("GET /api/v1/reserve_item_stock/[id]", () => {
  const get = (options) => GET(buildRequest(URL, options), ctx());

  const mockGet = () =>
    prismaMock.reserve_item_stock.findUnique.mockResolvedValue(
      storedReservation(),
    );

  describeAuthorization(get, {
    modules: "materialstoorder",
    setup: mockGet,
    untouched: () => [prismaMock.reserve_item_stock.findUnique],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockGet();
    });

    it("returns the reservation with its item details", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Stock reservation retrieved successfully",
        data: storedReservation(),
      });
      const args = prismaMock.reserve_item_stock.findUnique.mock.calls[0][0];
      expect(args.where).toEqual({ id: ID });
      expect(args.include.item.include).toEqual({
        sheet: true,
        handle: true,
        hardware: true,
        accessory: true,
        edging_tape: true,
      });
    });

    it("returns 404 when the reservation does not exist", async () => {
      prismaMock.reserve_item_stock.findUnique.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Stock reservation not found",
      });
    });

    it("returns 500 when the lookup fails", async () => {
      prismaMock.reserve_item_stock.findUnique.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await get();

      expect(res.status).toBe(500);
    });
  });
});

describe("PATCH /api/v1/reserve_item_stock/[id]", () => {
  const patch = (body = { quantity: 8 }, options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());

  // `stock` is what a failed conditional decrement reports as available;
  // `takes` is whether the conditional decrement succeeds; `written` is
  // whether the guarded reservation write still matches the row.
  function mockUpdate({
    existing = storedReservation(),
    stock = 10,
    takes = true,
    written = true,
    mto = { id: "mi-2", item_id: "ITEM-A", quantity: 10 },
    others = 0,
  } = {}) {
    prismaMock.reserve_item_stock.findUnique.mockImplementation(async () =>
      existing
        ? {
            ...existing,
            ...(prismaMock.reserve_item_stock.updateMany.mock.calls.length
              ? prismaMock.reserve_item_stock.updateMany.mock.calls.at(-1)[0]
                  .data
              : {}),
          }
        : null,
    );
    prismaMock.item.findUnique.mockResolvedValue({
      item_id: "ITEM-A",
      quantity: stock,
    });
    prismaMock.materials_to_order_item.findUnique.mockResolvedValue(mto);
    prismaMock.reserve_item_stock.aggregate.mockResolvedValue({
      _sum: { quantity: others || null },
    });
    prismaMock.reserve_item_stock.updateMany.mockResolvedValue({
      count: written ? 1 : 0,
    });
    prismaMock.item.updateMany.mockResolvedValue({ count: takes ? 1 : 0 });
    prismaMock.item.update.mockResolvedValue({});
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization((options) => patch(undefined, options), {
    modules: "materialstoorder",
    setup: () => mockUpdate(),
    untouched: () => [
      prismaMock.reserve_item_stock.updateMany,
      prismaMock.$transaction,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    it("increasing the quantity reserves more stock atomically and logs", async () => {
      const res = await patch({ quantity: 8 });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Stock reservation updated successfully",
        data: storedReservation({ quantity: 8 }),
      });
      expect(prismaMock.reserve_item_stock.updateMany).toHaveBeenCalledWith({
        where: { id: ID, quantity: 5, used_quantity: 0 },
        data: { quantity: 8 },
      });
      expect(prismaMock.item.updateMany).toHaveBeenCalledWith({
        where: {
          item_id: "ITEM-A",
          is_deleted: false,
          quantity: { gte: 3 },
        },
        data: { quantity: { decrement: 3 } },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entity_type: "reserve_item_stock",
          entity_id: ID,
          action: "UPDATE",
        }),
      });
    });

    it("locks the MTO line inside the transaction before changing anything", async () => {
      await patch({ quantity: 8 });

      expect(prismaMock.$transaction).toHaveBeenCalledOnce();
      expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
      const [strings, ...values] = prismaMock.$queryRaw.mock.calls[0];
      expect(strings.join("?")).toMatch(
        /FROM materials_to_order_item[\s\S]*FOR UPDATE/,
      );
      expect(values).toEqual(["mi-1"]);
      expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prismaMock.reserve_item_stock.updateMany.mock.invocationCallOrder[0],
      );
    });

    it("decreasing the quantity returns stock to the item", async () => {
      await patch({ quantity: 2 });

      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { item_id: "ITEM-A" },
        data: { quantity: { increment: 3 } },
      });
      expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
    });

    it("leaves stock alone when the quantity is unchanged", async () => {
      const res = await patch({ quantity: 5 });

      expect(res.status).toBe(200);
      expect(prismaMock.item.update).not.toHaveBeenCalled();
      expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
    });

    it("rejects an increase beyond the available stock", async () => {
      mockUpdate({ stock: 2, takes: false });

      const res = await patch({ quantity: 8 });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Not enough stock available for this increase",
        data: { available: 2, requested: 3, shortage: 1 },
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("rejects an increase that would exceed the MTO quantity", async () => {
      mockUpdate({
        mto: { id: "mi-1", item_id: "ITEM-A", quantity: 10 },
        others: 4,
      });

      const res = await patch({ quantity: 8 });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message:
          "Reservation would exceed the quantity required by the materials to order item",
        data: { required: 10, already_reserved: 4, requested: 8 },
      });
      expect(prismaMock.reserve_item_stock.aggregate).toHaveBeenCalledWith({
        where: { mto_id: "mi-1", id: { not: ID } },
        _sum: { quantity: true },
      });
      expect(prismaMock.reserve_item_stock.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
    });

    it("always lets a reservation shrink, even if the MTO quantity dropped", async () => {
      mockUpdate({
        mto: { id: "mi-1", item_id: "ITEM-A", quantity: 3 },
        others: 4,
      });

      const res = await patch({ quantity: 4 });

      expect(res.status).toBe(200);
      expect(prismaMock.reserve_item_stock.aggregate).not.toHaveBeenCalled();
    });

    it("returns 409 when the reservation changed since it was read", async () => {
      mockUpdate({ written: false });

      const res = await patch({ quantity: 8 });

      expect(res.status).toBe(409);
      expect((await res.json()).message).toMatch(/changed by someone else/);
      expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("rejects a quantity below what has already been used", async () => {
      mockUpdate({ existing: storedReservation({ used_quantity: 4 }) });

      const res = await patch({ quantity: 3 });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Quantity cannot be less than the already used quantity (4)",
        data: { used_quantity: 4 },
      });
      expect(prismaMock.reserve_item_stock.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      ["zero", 0],
      ["negative", -2],
      ["not a number", "abc"],
    ])("rejects a quantity that is %s", async (_, quantity) => {
      const res = await patch({ quantity });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Quantity must be greater than 0",
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("rejects a fractional quantity instead of truncating it", async () => {
      const res = await patch({ quantity: 7.5 });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Quantity must be a whole number",
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("moves the reservation to another MTO line without touching stock", async () => {
      const res = await patch({ mto_id: "mi-2" });

      expect(res.status).toBe(200);
      expect(prismaMock.reserve_item_stock.updateMany).toHaveBeenCalledWith({
        where: { id: ID, quantity: 5, used_quantity: 0 },
        data: { quantity: 5, mto_id: "mi-2" },
      });
      expect(prismaMock.item.update).not.toHaveBeenCalled();
      expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
    });

    it("locks both MTO lines, in a fixed order, when moving", async () => {
      await patch({ mto_id: "mi-0" });

      const locked = prismaMock.$queryRaw.mock.calls.map((c) => c[1]);
      expect(locked).toEqual(["mi-0", "mi-1"]);
    });

    it("refuses to move onto a line that cannot hold the reservation", async () => {
      mockUpdate({
        mto: { id: "mi-2", item_id: "ITEM-A", quantity: 6 },
        others: 3,
      });

      const res = await patch({ mto_id: "mi-2" });

      expect(res.status).toBe(400);
      expect((await res.json()).data).toEqual({
        required: 6,
        already_reserved: 3,
        requested: 5,
      });
      expect(prismaMock.reserve_item_stock.updateMany).not.toHaveBeenCalled();
    });

    it("returns 400 when the target MTO line is for a different item", async () => {
      mockUpdate({ mto: { id: "mi-2", item_id: "ITEM-OTHER", quantity: 10 } });

      const res = await patch({ mto_id: "mi-2" });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Item does not match the materials to order item",
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("returns 404 when the target MTO item does not exist", async () => {
      mockUpdate({ mto: null });

      const res = await patch({ mto_id: "ghost" });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Materials to order item not found",
      });
    });

    it("returns 404 when the reservation does not exist", async () => {
      mockUpdate({ existing: null });

      const res = await patch();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Stock reservation not found",
      });
    });

    it("returns 500 when the transaction fails", async () => {
      prismaMock.reserve_item_stock.updateMany.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await patch();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});

describe("DELETE /api/v1/reserve_item_stock/[id]", () => {
  const del = (options) =>
    DELETE(buildRequest(URL, { method: "DELETE", ...options }), ctx());

  const withMto = (reservation, status) => ({
    ...reservation,
    mto: { mto: { status } },
  });

  function mockDelete({
    existing = withMto(storedReservation(), "DRAFT"),
    deleted,
  } = {}) {
    prismaMock.reserve_item_stock.findUnique.mockResolvedValue(existing);
    prismaMock.reserve_item_stock.delete.mockResolvedValue(
      deleted ?? storedReservation(),
    );
    prismaMock.item.update.mockResolvedValue({});
    prismaMock.logs.create.mockResolvedValue({});
    checkAndUpdateMTOStatus.mockResolvedValue(false);
  }

  describeAuthorization(del, {
    modules: "materialstoorder",
    setup: () => mockDelete(),
    untouched: () => [prismaMock.reserve_item_stock.delete],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    it("deletes the reservation, returns its unused stock and logs", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Stock reservation deleted successfully",
      });
      expect(prismaMock.reserve_item_stock.findUnique).toHaveBeenCalledWith({
        where: { id: ID },
        include: { mto: { include: { mto: true } } },
      });
      expect(prismaMock.reserve_item_stock.delete).toHaveBeenCalledWith({
        where: { id: ID },
      });
      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { item_id: "ITEM-A" },
        data: { quantity: { increment: 5 } },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "reserve_item_stock",
          entity_id: ID,
          action: "DELETE",
          description: "Stock reservation deleted successfully: ITEM-A",
        },
      });
    });

    it("runs the delete and stock restore in one transaction", async () => {
      await del();

      expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    });

    it("locks the MTO line first, like stock usage and the other reservation routes", async () => {
      await del();

      expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
      const [strings, ...values] = prismaMock.$queryRaw.mock.calls[0];
      expect(strings.join("?")).toMatch(
        /FROM materials_to_order_item[\s\S]*FOR UPDATE/,
      );
      expect(values).toEqual(["mi-1"]);
      expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prismaMock.reserve_item_stock.delete.mock.invocationCallOrder[0],
      );
    });

    it("only returns the unused part of the reservation", async () => {
      mockDelete({
        deleted: storedReservation({ quantity: 10, used_quantity: 4 }),
      });

      await del();

      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { item_id: "ITEM-A" },
        data: { quantity: { increment: 6 } },
      });
    });

    it("reads used_quantity from the deleted row, not the earlier lookup", async () => {
      mockDelete({
        existing: withMto(storedReservation({ used_quantity: 0 }), "DRAFT"),
        deleted: storedReservation({ quantity: 5, used_quantity: 2 }),
      });

      await del();

      expect(prismaMock.item.update.mock.calls[0][0].data.quantity).toEqual({
        increment: 3,
      });
    });

    it.each([
      ["fully used", { quantity: 4, used_quantity: 4 }],
      ["over used", { quantity: 4, used_quantity: 9 }],
    ])(
      "returns nothing to stock when the reservation was %s",
      async (_, deleted) => {
        mockDelete({ deleted: storedReservation(deleted) });

        const res = await del();

        expect(res.status).toBe(200);
        expect(prismaMock.item.update).not.toHaveBeenCalled();
      },
    );

    it("treats a null used_quantity as zero", async () => {
      mockDelete({
        deleted: storedReservation({ quantity: 3, used_quantity: null }),
      });

      await del();

      expect(prismaMock.item.update.mock.calls[0][0].data.quantity).toEqual({
        increment: 3,
      });
    });

    it("re-checks the MTO status afterwards", async () => {
      await del();

      expect(checkAndUpdateMTOStatus).toHaveBeenCalledWith("mi-1");
    });

    describe("MTO status guard", () => {
      it.each(["FULLY_ORDERED", "CLOSED"])(
        "returns 403 when the MTO is %s",
        async (status) => {
          mockDelete({ existing: withMto(storedReservation(), status) });

          const res = await del();

          expect(res.status).toBe(403);
          expect(await res.json()).toEqual({
            status: false,
            message: `Cannot delete reservation. The associated Materials to Order is ${status}.`,
            data: {
              mtoStatus: status,
              allowedStatuses: ["DRAFT", "PARTIALLY_ORDERED"],
            },
          });
          expect(prismaMock.reserve_item_stock.delete).not.toHaveBeenCalled();
          expect(prismaMock.item.update).not.toHaveBeenCalled();
        },
      );

      it.each(["DRAFT", "PARTIALLY_ORDERED"])(
        "allows deletion when the MTO is %s",
        async (status) => {
          mockDelete({ existing: withMto(storedReservation(), status) });

          const res = await del();

          expect(res.status).toBe(200);
        },
      );

      it("allows deletion when the MTO item has no parent loaded", async () => {
        mockDelete({ existing: { ...storedReservation(), mto: null } });

        const res = await del();

        expect(res.status).toBe(200);
      });
    });

    it("returns 404 when the reservation does not exist", async () => {
      mockDelete({ existing: null });

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Stock reservation not found",
      });
      expect(prismaMock.reserve_item_stock.delete).not.toHaveBeenCalled();
    });

    it("still succeeds when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).not.toHaveProperty("warning");
      expect(checkAndUpdateMTOStatus).toHaveBeenCalledWith("mi-1");
    });

    it("returns 404, not 500, when the reservation was removed after the lookup", async () => {
      // e.g. a stock usage consumed the whole reservation in between; Prisma
      // reports a delete of a missing row as P2025
      prismaMock.reserve_item_stock.delete.mockRejectedValue(
        Object.assign(new Error("Record to delete does not exist."), {
          code: "P2025",
        }),
      );

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Stock reservation not found",
      });
      // nothing is returned to stock, logged, or re-checked
      expect(prismaMock.item.update).not.toHaveBeenCalled();
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
      expect(checkAndUpdateMTOStatus).not.toHaveBeenCalled();
    });

    it("returns 500 when the delete fails", async () => {
      prismaMock.reserve_item_stock.delete.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await del();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 500 when the status check fails", async () => {
      checkAndUpdateMTOStatus.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
    });
  });
});
