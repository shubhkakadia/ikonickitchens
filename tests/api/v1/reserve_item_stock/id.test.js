// Tests for src/app/api/v1/reserve_item_stock/[id]/route.js
//
// KNOWN BUG: GET and PATCH treat the result of requireAuth() like an object
// with an `authenticated` flag (`authResult.authenticated`). requireAuth()
// actually returns `null` when the caller is allowed and a ready-made error
// response otherwise, so:
//   - every authorised call throws a TypeError and returns 500, and
//   - every auth failure (401 or 403) hits NextResponse.json(undefined), which
//     throws, so it also returns 500.
// Net effect: GET and PATCH always return 500.
// DELETE uses requireAuth() correctly.
//
// The "current behaviour" tests below pin the broken behaviour. The tests
// wrapped in `whenFixed` describe the intended behaviour; they are marked
// `it.fails`, so they pass today and start failing as soon as the routes are
// fixed. At that point, change `whenFixed` to `it`, and replace the
// "current behaviour" tests with the standard authorization matrix.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthorizedUser, mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

vi.mock("@/lib/mtoStatusHelper", () => ({ checkAndUpdateMTOStatus: vi.fn() }));

const { GET, PATCH, DELETE } =
  await import("@/app/api/v1/reserve_item_stock/[id]/route");
const { checkAndUpdateMTOStatus } = await import("@/lib/mtoStatusHelper");

const ID = "res-1";
const URL = `/api/v1/reserve_item_stock/${ID}`;
const ctx = () => routeContext({ id: ID });

const whenFixed = it.fails;

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

  beforeEach(() => {
    prismaMock.reserve_item_stock.findUnique.mockResolvedValue(
      storedReservation(),
    );
  });

  describe("current behaviour (bug)", () => {
    it("returns 500 for an authorised user", async () => {
      mockMasterAdmin();

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.reserve_item_stock.findUnique).not.toHaveBeenCalled();
    });

    it.each([
      ["no token", { token: null }, null],
      [
        "a user without the module",
        undefined,
        { userType: "manager", modules: [] },
      ],
      [
        "a disallowed role",
        undefined,
        { userType: "employee", modules: ["materialstoorder"] },
      ],
    ])("returns 500 instead of 401/403 for %s", async (_, options, user) => {
      if (user) mockAuthorizedUser(user);

      const res = await get(options);

      expect(res.status).toBe(500);
      expect(prismaMock.reserve_item_stock.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("intended behaviour", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    whenFixed("returns the reservation with its item details", async () => {
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

    whenFixed("returns 404 when the reservation does not exist", async () => {
      prismaMock.reserve_item_stock.findUnique.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Stock reservation not found",
      });
    });

    whenFixed(
      "returns 403 for a manager without the materialstoorder module",
      async () => {
        mockAuthorizedUser({ userType: "manager", modules: [] });

        const res = await get();

        expect(res.status).toBe(403);
      },
    );

    whenFixed("returns 401 when no token is sent", async () => {
      const res = await get({ token: null });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        status: false,
        message: "Unauthorized",
      });
    });
  });
});

describe("PATCH /api/v1/reserve_item_stock/[id]", () => {
  const patch = (body = { quantity: 8 }, options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());

  function mockUpdate({
    existing = storedReservation(),
    stock = 10,
    mto = { id: "mi-2" },
  } = {}) {
    prismaMock.reserve_item_stock.findUnique.mockResolvedValue(existing);
    prismaMock.item.findUnique.mockResolvedValue({
      item_id: "ITEM-A",
      quantity: stock,
    });
    prismaMock.materials_to_order_item.findUnique.mockResolvedValue(mto);
    prismaMock.reserve_item_stock.update.mockImplementation(
      async ({ data }) => ({
        ...storedReservation(),
        ...data,
      }),
    );
    prismaMock.item.update.mockResolvedValue({});
    prismaMock.logs.create.mockResolvedValue({});
  }

  beforeEach(() => {
    mockUpdate();
  });

  describe("current behaviour (bug)", () => {
    it("returns 500 for an authorised user", async () => {
      mockMasterAdmin();

      const res = await patch();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.reserve_item_stock.update).not.toHaveBeenCalled();
      expect(prismaMock.item.update).not.toHaveBeenCalled();
    });

    it("returns 500 instead of 401 for an unauthenticated caller", async () => {
      const res = await patch(undefined, { token: null });

      expect(res.status).toBe(500);
      expect(prismaMock.reserve_item_stock.update).not.toHaveBeenCalled();
    });
  });

  describe("intended behaviour", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    whenFixed(
      "increasing the quantity reserves more stock and logs",
      async () => {
        const res = await patch({ quantity: 8 });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "Stock reservation updated successfully",
          data: storedReservation({ quantity: 8 }),
        });
        expect(prismaMock.reserve_item_stock.update).toHaveBeenCalledWith({
          where: { id: ID },
          data: { quantity: 8 },
        });
        expect(prismaMock.item.update).toHaveBeenCalledWith({
          where: { item_id: "ITEM-A" },
          data: { quantity: { increment: -3 } },
        });
        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            entity_type: "reserve_item_stock",
            entity_id: ID,
            action: "UPDATE",
          }),
        });
      },
    );

    whenFixed("decreasing the quantity returns stock to the item", async () => {
      await patch({ quantity: 2 });

      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { item_id: "ITEM-A" },
        data: { quantity: { increment: 3 } },
      });
    });

    whenFixed("leaves stock alone when the quantity is unchanged", async () => {
      const res = await patch({ quantity: 5 });

      expect(res.status).toBe(200);
      expect(prismaMock.item.update).not.toHaveBeenCalled();
    });

    whenFixed("rejects an increase beyond the available stock", async () => {
      mockUpdate({ stock: 2 });

      const res = await patch({ quantity: 8 });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Not enough stock available for this increase",
        data: { available: 2, requested: 3, shortage: 1 },
      });
      expect(prismaMock.reserve_item_stock.update).not.toHaveBeenCalled();
    });

    whenFixed(
      "rejects a quantity below what has already been used",
      async () => {
        mockUpdate({ existing: storedReservation({ used_quantity: 4 }) });

        const res = await patch({ quantity: 3 });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Quantity cannot be less than the already used quantity (4)",
          data: { used_quantity: 4 },
        });
      },
    );

    whenFixed("rejects a quantity of zero or less", async () => {
      const res = await patch({ quantity: 0 });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Quantity must be greater than 0",
      });
    });

    whenFixed(
      "moves the reservation to another MTO item without touching stock",
      async () => {
        const res = await patch({ mto_id: "mi-2" });

        expect(res.status).toBe(200);
        expect(prismaMock.reserve_item_stock.update).toHaveBeenCalledWith({
          where: { id: ID },
          data: { mto_id: "mi-2" },
        });
        expect(prismaMock.item.update).not.toHaveBeenCalled();
      },
    );

    whenFixed(
      "returns 404 when the target MTO item does not exist",
      async () => {
        mockUpdate({ mto: null });

        const res = await patch({ mto_id: "ghost" });

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Materials to order item not found",
        });
      },
    );

    whenFixed("returns 404 when the reservation does not exist", async () => {
      mockUpdate({ existing: null });

      const res = await patch();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Stock reservation not found",
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
