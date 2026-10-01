// Tests for src/app/api/v1/materials_to_order/[id]/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

// sendNotification sends real WhatsApp messages; never call it in tests.
vi.mock("@/lib/notification", () => ({ sendNotification: vi.fn() }));
vi.mock("@/lib/mtoStatusHelper", () => ({ checkAndUpdateMTOStatus: vi.fn() }));

const { GET, PATCH, DELETE } =
  await import("@/app/api/v1/materials_to_order/[id]/route");
const { sendNotification } = await import("@/lib/notification");
const { checkAndUpdateMTOStatus } = await import("@/lib/mtoStatusHelper");

const ID = "mto-1";
const URL = `/api/v1/materials_to_order/${ID}`;
const ctx = () => routeContext({ id: ID });

const storedMto = (overrides = {}) => ({
  id: ID,
  project_id: "proj-1",
  is_deleted: false,
  used_material_completed: false,
  project: { name: "Smith House", client: { client_name: "Acme" } },
  lots: [{ lot_id: "LOT-1" }],
  items: [{ id: "mi-1" }],
  ...overrides,
});

describe("GET /api/v1/materials_to_order/[id]", () => {
  const get = (options) => GET(buildRequest(URL, options), ctx());

  describeAuthorization(get, {
    modules: "project_details",
    setup: () =>
      prismaMock.materials_to_order.findUnique.mockResolvedValue(storedMto()),
    untouched: () => [prismaMock.materials_to_order.findUnique],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      prismaMock.materials_to_order.findUnique.mockResolvedValue(storedMto());
      prismaMock.media.findMany.mockResolvedValue([{ id: "media-1" }]);
    });

    it("returns the MTO with its media attached", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Materials to order fetched successfully",
        data: { ...storedMto(), media: [{ id: "media-1" }] },
      });
      expect(prismaMock.materials_to_order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ID } }),
      );
      expect(prismaMock.media.findMany).toHaveBeenCalledWith({
        where: { materials_to_orderId: ID, is_deleted: false },
      });
    });

    it.each([
      ["does not exist", null],
      ["is soft deleted", storedMto({ is_deleted: true })],
    ])("returns 404 when the MTO %s", async (_, found) => {
      prismaMock.materials_to_order.findUnique.mockResolvedValue(found);

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Materials to order not found",
      });
      expect(prismaMock.media.findMany).not.toHaveBeenCalled();
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.materials_to_order.findUnique.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});

describe("PATCH /api/v1/materials_to_order/[id]", () => {
  const patch = (body = { notes: "New note" }, options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());

  const existingRow = (overrides = {}) => ({
    id: "mi-1",
    item_id: "ITEM-A",
    quantity: 5,
    notes: null,
    quantity_used: 0,
    _count: { ordered_items: 0 },
    ...overrides,
  });

  // prev = what the transaction reads first; mto = what update/refetch return
  function mockPatch({ prev = {}, mto = storedMto(), existing = [] } = {}) {
    prismaMock.materials_to_order.findUnique.mockImplementation(async (args) =>
      args?.select
        ? { used_material_completed: false, is_deleted: false, ...prev }
        : mto,
    );
    prismaMock.materials_to_order.update.mockResolvedValue(mto);
    prismaMock.materials_to_order_item.findMany.mockResolvedValue(existing);
    prismaMock.materials_to_order_item.update.mockResolvedValue({});
    prismaMock.materials_to_order_item.createMany.mockResolvedValue({});
    prismaMock.materials_to_order_item.deleteMany.mockResolvedValue({});
    prismaMock.reserve_item_stock.findMany.mockResolvedValue([]);
    prismaMock.reserve_item_stock.delete.mockResolvedValue({});
    prismaMock.item.update.mockResolvedValue({});
    prismaMock.item.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.stock_transaction.create.mockResolvedValue({});
    prismaMock.media.findMany.mockResolvedValue([]);
    prismaMock.logs.create.mockResolvedValue({});
    checkAndUpdateMTOStatus.mockResolvedValue(false);
  }

  describeAuthorization((options) => patch(undefined, options), {
    modules: ["project_details", "usedmaterial"],
    setup: () => mockPatch(),
    untouched: () => [prismaMock.materials_to_order.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockPatch();
    });

    describe("simple field updates", () => {
      it("updates the MTO, attaches media and logs", async () => {
        const res = await patch({ notes: "Hello" });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json).toEqual({
          status: true,
          message: "Materials to order updated successfully",
          data: { ...storedMto(), media: [] },
        });
        expect(prismaMock.materials_to_order.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: ID },
            data: { notes: "Hello" },
          }),
        );
        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: {
            user_id: "user-1",
            entity_type: "materials_to_order",
            entity_id: ID,
            action: "UPDATE",
            description:
              "Materials to order updated successfully for project: Smith House",
          },
        });
      });

      it("only updates the fields that were sent", async () => {
        await patch({ status: "FULLY_ORDERED", notes: "n", ignored: "x" });

        expect(
          prismaMock.materials_to_order.update.mock.calls[0][0].data,
        ).toEqual({ status: "FULLY_ORDERED", notes: "n" });
      });

      it("allows clearing notes with null", async () => {
        await patch({ notes: null });

        expect(
          prismaMock.materials_to_order.update.mock.calls[0][0].data,
        ).toEqual({ notes: null });
      });

      it("runs inside a transaction", async () => {
        await patch();

        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
      });

      it("does not sync items or check status when items are not sent", async () => {
        await patch({ notes: "x" });

        expect(
          prismaMock.materials_to_order_item.findMany,
        ).not.toHaveBeenCalled();
        expect(checkAndUpdateMTOStatus).not.toHaveBeenCalled();
      });
    });

    describe("notification", () => {
      it.each([
        ["status", { status: "FULLY_ORDERED" }],
        ["items", { items: [] }],
      ])("is sent when %s is sent", async (_, body) => {
        await patch(body);

        expect(sendNotification).toHaveBeenCalledTimes(1);
      });

      it.each([
        ["notes", { notes: "x" }],
        ["used_material_completed", { used_material_completed: true }],
      ])("is not sent for a %s-only update", async (_, body) => {
        mockPatch({ mto: storedMto() });

        await patch(body);

        expect(sendNotification).not.toHaveBeenCalled();
      });

      // Current behaviour (bug): the route reads project.client.name, but the
      // query selects client_name, so the client is always "Unknown Client".
      it("always reports Unknown Client", async () => {
        await patch({ status: "DRAFT" });

        expect(sendNotification).toHaveBeenCalledWith(
          {
            type: "material_to_order",
            materials_to_order_id: ID,
            project_id: "proj-1",
            project_name: "Smith House",
            client_name: "Unknown Client",
            lot_name: "LOT-1",
            is_new: false,
          },
          "materials_to_order_list_update",
        );
      });

      it("joins multiple lot ids and falls back when there are none", async () => {
        mockPatch({
          mto: storedMto({ lots: [{ lot_id: "L1" }, { lot_id: "L2" }] }),
        });
        await patch({ status: "DRAFT" });
        expect(sendNotification.mock.calls[0][0].lot_name).toBe("L1, L2");

        sendNotification.mockClear();
        mockPatch({ mto: storedMto({ lots: [] }) });
        await patch({ status: "DRAFT" });
        expect(sendNotification.mock.calls[0][0].lot_name).toBe("Unknown Lot");
      });

      it("still returns 200 when the notification fails", async () => {
        sendNotification.mockRejectedValue(new Error("WhatsApp down"));

        const res = await patch({ status: "DRAFT" });

        expect(res.status).toBe(200);
      });
    });

    describe("not found and completion rules", () => {
      it.each([
        ["does not exist", null],
        ["is soft deleted", { is_deleted: true }],
      ])("returns 404 when the MTO %s", async (_, prev) => {
        prismaMock.materials_to_order.findUnique.mockResolvedValue(prev);

        const res = await patch();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Materials to order not found",
        });
        expect(prismaMock.materials_to_order.update).not.toHaveBeenCalled();
      });

      it("refuses to revert used_material_completed", async () => {
        const res = await patch({ used_material_completed: false });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "This MTO is already completed for used material and cannot be moved back to active.",
        });
        expect(prismaMock.materials_to_order.update).not.toHaveBeenCalled();
      });
    });

    describe("items validation", () => {
      it.each([
        ["not an array", "nope"],
        ["an entry without item_id", [{ quantity: 1 }]],
        ["a zero quantity", [{ item_id: "A", quantity: 0 }]],
        ["a negative quantity", [{ item_id: "A", quantity: -2 }]],
        ["a fractional quantity", [{ item_id: "A", quantity: 1.5 }]],
        ["a non-numeric quantity", [{ item_id: "A", quantity: "abc" }]],
        ["a null entry", [null]],
      ])("returns 400 for items that are %s", async (_, items) => {
        const res = await patch({ items });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "items must be an array of { item_id, quantity > 0 } entries",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it("accepts numeric strings as quantities", async () => {
        mockPatch({ existing: [existingRow()] });

        const res = await patch({
          items: [{ id: "mi-1", item_id: "ITEM-A", quantity: "8" }],
        });

        expect(res.status).toBe(200);
        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith({
          where: { id: "mi-1" },
          data: { quantity: 8, notes: null },
        });
      });
    });

    describe("items sync", () => {
      it("makes no item writes when the list is unchanged", async () => {
        mockPatch({ existing: [existingRow()] });

        const res = await patch({
          items: [{ id: "mi-1", item_id: "ITEM-A", quantity: 5 }],
        });

        expect(res.status).toBe(200);
        expect(
          prismaMock.materials_to_order_item.update,
        ).not.toHaveBeenCalled();
        expect(
          prismaMock.materials_to_order_item.createMany,
        ).not.toHaveBeenCalled();
        expect(
          prismaMock.materials_to_order_item.deleteMany,
        ).not.toHaveBeenCalled();
      });

      it("updates a changed quantity or note", async () => {
        mockPatch({ existing: [existingRow()] });

        await patch({
          items: [{ id: "mi-1", item_id: "ITEM-A", quantity: 9, notes: "x" }],
        });

        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith({
          where: { id: "mi-1" },
          data: { quantity: 9, notes: "x" },
        });
      });

      it("creates rows for new items", async () => {
        mockPatch({ existing: [existingRow()] });

        await patch({
          items: [
            { id: "mi-1", item_id: "ITEM-A", quantity: 5 },
            { item_id: "ITEM-B", quantity: 2, notes: "new" },
          ],
        });

        expect(
          prismaMock.materials_to_order_item.createMany,
        ).toHaveBeenCalledWith({
          data: [{ mto_id: ID, item_id: "ITEM-B", quantity: 2, notes: "new" }],
        });
      });

      it("matches a row sent without an id by its item_id", async () => {
        mockPatch({ existing: [existingRow()] });

        await patch({ items: [{ item_id: "ITEM-A", quantity: 7 }] });

        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith({
          where: { id: "mi-1" },
          data: { quantity: 7, notes: null },
        });
        expect(
          prismaMock.materials_to_order_item.createMany,
        ).not.toHaveBeenCalled();
        expect(
          prismaMock.materials_to_order_item.deleteMany,
        ).not.toHaveBeenCalled();
      });

      it("treats a swapped item as a removal plus a new row", async () => {
        mockPatch({ existing: [existingRow()] });

        await patch({
          items: [{ id: "mi-1", item_id: "ITEM-B", quantity: 5 }],
        });

        expect(
          prismaMock.materials_to_order_item.deleteMany,
        ).toHaveBeenCalledWith({
          where: { id: { in: ["mi-1"] } },
        });
        expect(
          prismaMock.materials_to_order_item.createMany,
        ).toHaveBeenCalledWith({
          data: [{ mto_id: ID, item_id: "ITEM-B", quantity: 5, notes: null }],
        });
      });

      it("removes rows that were left out and returns their unused reserved stock", async () => {
        mockPatch({ existing: [existingRow()] });
        prismaMock.reserve_item_stock.findMany.mockResolvedValue([
          { id: "res-1" },
        ]);
        prismaMock.reserve_item_stock.delete.mockResolvedValue({
          quantity: 10,
          used_quantity: 3,
          item_id: "ITEM-A",
        });

        const res = await patch({ items: [] });

        expect(res.status).toBe(200);
        expect(prismaMock.reserve_item_stock.findMany).toHaveBeenCalledWith({
          where: { mto_id: { in: ["mi-1"] } },
          select: { id: true },
        });
        expect(prismaMock.reserve_item_stock.delete).toHaveBeenCalledWith({
          where: { id: "res-1" },
        });
        expect(prismaMock.item.update).toHaveBeenCalledWith({
          where: { item_id: "ITEM-A" },
          data: { quantity: { increment: 7 } },
        });
        expect(
          prismaMock.materials_to_order_item.deleteMany,
        ).toHaveBeenCalledWith({
          where: { id: { in: ["mi-1"] } },
        });
      });

      it("does not touch stock when a released reservation was fully used", async () => {
        mockPatch({ existing: [existingRow()] });
        prismaMock.reserve_item_stock.findMany.mockResolvedValue([
          { id: "res-1" },
        ]);
        prismaMock.reserve_item_stock.delete.mockResolvedValue({
          quantity: 4,
          used_quantity: 4,
          item_id: "ITEM-A",
        });

        await patch({ items: [] });

        expect(prismaMock.item.update).not.toHaveBeenCalled();
      });

      it.each([
        [
          "has already been used",
          { quantity_used: 2 },
          "Item ITEM-A cannot be removed because it has already been used or added to a purchase order",
        ],
        [
          "is on a purchase order",
          { _count: { ordered_items: 1 } },
          "Item ITEM-A cannot be removed because it has already been used or added to a purchase order",
        ],
      ])(
        "returns 400 when a removed item %s",
        async (_, rowOverrides, message) => {
          mockPatch({ existing: [existingRow(rowOverrides)] });

          const res = await patch({ items: [] });

          expect(res.status).toBe(400);
          expect(await res.json()).toEqual({ status: false, message });
          expect(
            prismaMock.materials_to_order_item.deleteMany,
          ).not.toHaveBeenCalled();
          expect(prismaMock.materials_to_order.update).not.toHaveBeenCalled();
        },
      );

      it("returns 400 when the new quantity is below the used quantity", async () => {
        mockPatch({
          existing: [existingRow({ quantity: 10, quantity_used: 6 })],
        });

        const res = await patch({
          items: [{ id: "mi-1", item_id: "ITEM-A", quantity: 5 }],
        });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Quantity for item ITEM-A cannot be less than the already used quantity (6)",
        });
        expect(
          prismaMock.materials_to_order_item.update,
        ).not.toHaveBeenCalled();
      });

      describe("after used material was completed", () => {
        beforeEach(() => {
          mockPatch({
            prev: { used_material_completed: true },
            existing: [existingRow()],
          });
        });

        it("accepts an unchanged item list (autosave)", async () => {
          const res = await patch({
            items: [{ id: "mi-1", item_id: "ITEM-A", quantity: 5 }],
          });

          expect(res.status).toBe(200);
        });

        it.each([
          [
            "a changed quantity",
            [{ id: "mi-1", item_id: "ITEM-A", quantity: 6 }],
          ],
          [
            "an added item",
            [
              { id: "mi-1", item_id: "ITEM-A", quantity: 5 },
              { item_id: "ITEM-B", quantity: 1 },
            ],
          ],
          ["a removed item", []],
        ])("rejects %s", async (_, items) => {
          const res = await patch({ items });

          expect(res.status).toBe(400);
          expect(await res.json()).toEqual({
            status: false,
            message:
              "Items cannot be edited after used material has been completed for this MTO.",
          });
          expect(prismaMock.materials_to_order.update).not.toHaveBeenCalled();
        });
      });

      it("re-checks the MTO status after items are sent", async () => {
        mockPatch({ existing: [existingRow()] });

        await patch({
          items: [{ id: "mi-1", item_id: "ITEM-A", quantity: 5 }],
        });

        expect(checkAndUpdateMTOStatus).toHaveBeenCalledWith("mi-1");
      });

      it("re-fetches the MTO when the status check changed it", async () => {
        mockPatch({ existing: [existingRow()] });
        checkAndUpdateMTOStatus.mockResolvedValue(true);

        await patch({
          items: [{ id: "mi-1", item_id: "ITEM-A", quantity: 5 }],
        });

        const refetches =
          prismaMock.materials_to_order.findUnique.mock.calls.filter(
            ([args]) => !args?.select,
          );
        expect(refetches).toHaveLength(1);
      });

      it("skips the status check when the MTO has no items left", async () => {
        mockPatch({ existing: [existingRow()], mto: storedMto({ items: [] }) });

        await patch({ items: [] });

        expect(checkAndUpdateMTOStatus).not.toHaveBeenCalled();
      });
    });

    describe("marking used material completed", () => {
      const mtoItems = () => [
        { id: "mi-1", item_id: "ITEM-A", quantity: 5, quantity_used: 2 },
        { id: "mi-2", item_id: "ITEM-B", quantity: 3, quantity_used: 3 },
      ];

      beforeEach(() => {
        prismaMock.materials_to_order_item.findMany.mockResolvedValue(
          mtoItems(),
        );
      });

      it("consumes the remaining quantity and records USED stock transactions", async () => {
        const res = await patch({ used_material_completed: true });

        expect(res.status).toBe(200);
        expect(
          prismaMock.materials_to_order.update.mock.calls[0][0].data,
        ).toEqual({ used_material_completed: true });
        expect(prismaMock.item.updateMany).toHaveBeenCalledTimes(1);
        expect(prismaMock.item.updateMany).toHaveBeenCalledWith({
          where: { item_id: "ITEM-A", quantity: { gte: 3 } },
          data: { quantity: { decrement: 3 } },
        });
        expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith({
          where: { id: "mi-1" },
          data: { quantity_used: 5 },
        });
        expect(prismaMock.stock_transaction.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.stock_transaction.create).toHaveBeenCalledWith({
          data: {
            item_id: "ITEM-A",
            quantity: 3,
            type: "USED",
            materials_to_order_id: ID,
            notes: `Auto USED on marking MTO completed (${ID})`,
          },
        });
      });

      it("skips items that are already fully used", async () => {
        prismaMock.materials_to_order_item.findMany.mockResolvedValue([
          { id: "mi-2", item_id: "ITEM-B", quantity: 3, quantity_used: 3 },
        ]);

        await patch({ used_material_completed: true });

        expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
      });

      it("returns the re-fetched MTO so quantity_used is current", async () => {
        await patch({ used_material_completed: true });

        const refetches =
          prismaMock.materials_to_order.findUnique.mock.calls.filter(
            ([args]) => !args?.select,
          );
        expect(refetches).toHaveLength(1);
      });

      it("does nothing extra when the MTO was already completed", async () => {
        mockPatch({ prev: { used_material_completed: true } });

        const res = await patch({ used_material_completed: true });

        expect(res.status).toBe(200);
        expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
      });

      it("returns 400 when inventory is too low", async () => {
        prismaMock.item.updateMany.mockResolvedValue({ count: 0 });
        prismaMock.item.findUnique.mockResolvedValue({ quantity: 1 });

        const res = await patch({ used_material_completed: true });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Not enough quantity in inventory. Available: 1, Requested: 3",
        });
        expect(prismaMock.stock_transaction.create).not.toHaveBeenCalled();
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("reports 0 available when the item no longer exists", async () => {
        prismaMock.item.updateMany.mockResolvedValue({ count: 0 });
        prismaMock.item.findUnique.mockResolvedValue(null);

        const res = await patch({ used_material_completed: true });

        expect(res.status).toBe(400);
        expect((await res.json()).message).toBe(
          "Not enough quantity in inventory. Available: 0, Requested: 3",
        );
      });
    });

    describe("failures", () => {
      it("returns 200 with a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await patch();

        expect(res.status).toBe(200);
        expect((await res.json()).warning).toBe(
          "Note: Update succeeded but logging failed",
        );
      });

      it("returns 500 when the update fails", async () => {
        prismaMock.materials_to_order.update.mockRejectedValue(
          new Error("DB down"),
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
        expect(prismaMock.materials_to_order.update).not.toHaveBeenCalled();
      });
    });
  });
});

describe("DELETE /api/v1/materials_to_order/[id]", () => {
  const del = (options) =>
    DELETE(buildRequest(URL, { method: "DELETE", ...options }), ctx());

  function mockDelete({ found = storedMto(), reservations = [] } = {}) {
    prismaMock.materials_to_order.findUnique.mockResolvedValue(found);
    prismaMock.reserve_item_stock.findMany.mockResolvedValue(reservations);
    prismaMock.reserve_item_stock.delete.mockResolvedValue({});
    prismaMock.item.update.mockResolvedValue({});
    prismaMock.lot.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.media.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.materials_to_order.update.mockResolvedValue(
      storedMto({ is_deleted: true }),
    );
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization(del, {
    modules: ["project_details", "materialstoorder"],
    setup: () => mockDelete(),
    untouched: () => [prismaMock.materials_to_order.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    it("soft deletes the MTO, frees its lots and media, and logs", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Materials to order deleted successfully",
        data: storedMto({ is_deleted: true }),
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.materials_to_order.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { is_deleted: true },
      });
      expect(prismaMock.materials_to_order.delete).not.toHaveBeenCalled();
      expect(prismaMock.lot.updateMany).toHaveBeenCalledWith({
        where: { materials_to_orders_id: ID },
        data: { materials_to_orders_id: null },
      });
      expect(prismaMock.media.updateMany).toHaveBeenCalledWith({
        where: { materials_to_orderId: ID },
        data: { is_deleted: true },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "materials_to_order",
          entity_id: ID,
          action: "DELETE",
          description:
            "Materials to order deleted successfully for project: Smith House",
        },
      });
    });

    it("runs the changes inside a transaction", async () => {
      await del();

      expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    });

    it("releases reservations and returns their unused stock to inventory", async () => {
      mockDelete({ reservations: [{ id: "res-1" }, { id: "res-2" }] });
      prismaMock.reserve_item_stock.delete
        .mockResolvedValueOnce({ quantity: 10, used_quantity: 4, item_id: "A" })
        .mockResolvedValueOnce({ quantity: 2, used_quantity: 2, item_id: "B" });

      await del();

      expect(prismaMock.reserve_item_stock.findMany).toHaveBeenCalledWith({
        where: { mto: { mto_id: ID } },
        select: { id: true },
      });
      expect(prismaMock.item.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { item_id: "A" },
        data: { quantity: { increment: 6 } },
      });
    });

    it("treats a missing used_quantity as zero", async () => {
      mockDelete({ reservations: [{ id: "res-1" }] });
      prismaMock.reserve_item_stock.delete.mockResolvedValue({
        quantity: 3,
        used_quantity: null,
        item_id: "A",
      });

      await del();

      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { item_id: "A" },
        data: { quantity: { increment: 3 } },
      });
    });

    it("never returns a negative amount to stock", async () => {
      mockDelete({ reservations: [{ id: "res-1" }] });
      prismaMock.reserve_item_stock.delete.mockResolvedValue({
        quantity: 2,
        used_quantity: 5,
        item_id: "A",
      });

      await del();

      expect(prismaMock.item.update).not.toHaveBeenCalled();
    });

    it.each([
      ["does not exist", null],
      ["is already deleted", storedMto({ is_deleted: true })],
    ])("returns 404 when the MTO %s", async (_, found) => {
      mockDelete({ found });

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Materials to order not found",
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(prismaMock.materials_to_order.update).not.toHaveBeenCalled();
    });

    it('logs the project as "Unknown" when the MTO has no project', async () => {
      mockDelete({ found: storedMto({ project: null }) });

      await del();

      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description:
            "Materials to order deleted successfully for project: Unknown",
        }),
      });
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Deletion succeeded but logging failed",
      );
    });

    it("returns 500 when the transaction fails", async () => {
      prismaMock.materials_to_order.update.mockRejectedValue(
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

    it("returns 500 when the initial lookup fails", async () => {
      prismaMock.materials_to_order.findUnique.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await del();

      expect(res.status).toBe(500);
    });
  });
});
