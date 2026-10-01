// Tests for src/app/api/v1/materials_to_order_item/[id]/route.js
//
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

// sendNotification sends real WhatsApp messages; never call it in tests.
vi.mock("@/lib/notification", () => ({ sendNotification: vi.fn() }));
vi.mock("@/lib/mtoStatusHelper", () => ({ checkAndUpdateMTOStatus: vi.fn() }));

const { PATCH } =
  await import("@/app/api/v1/materials_to_order_item/[id]/route");
const { sendNotification } = await import("@/lib/notification");
const { checkAndUpdateMTOStatus } = await import("@/lib/mtoStatusHelper");

const ID = "mi-1";
const URL = `/api/v1/materials_to_order_item/${ID}`;
const ctx = () => routeContext({ id: ID });
const patch = (body = { quantity_ordered: 5 }, options = {}) =>
  PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());

const SUPPLIER = { supplier_id: "SUP-1", name: "Alpha" };

const catalogItem = (overrides = {}) => ({
  item_id: "ITEM-1",
  itemSuppliers: [{ supplier: SUPPLIER }],
  ...overrides,
});

// An MTO line; `item` defaults to an item supplied by SUPPLIER
const line = (id, overrides = {}) => ({
  id,
  quantity: 5,
  quantity_ordered: 0,
  item: catalogItem(),
  ...overrides,
});

const mtoOf = (items, overrides = {}) => ({
  id: "mto-1",
  is_deleted: false,
  project_id: "proj-1",
  project: { name: "Smith House", client: { client_name: "Acme" } },
  lots: [{ lot_id: "LOT-1", name: "Lot 1" }],
  items,
  ...overrides,
});

// `before` is what findUnique sees; `after` is what update returns.
function mockPatch({
  before = [line(ID)],
  after,
  stored = {},
  updated = {},
} = {}) {
  const mto = mtoOf(before, stored.mto);
  prismaMock.materials_to_order_item.findUnique.mockResolvedValue({
    id: ID,
    mto_id: "mto-1",
    item_id: "ITEM-1",
    quantity_ordered: 0,
    item: catalogItem(),
    mto,
    ...stored,
  });
  prismaMock.materials_to_order_item.update.mockImplementation(
    async ({ data }) => ({
      id: ID,
      mto_id: "mto-1",
      item_id: "ITEM-1",
      ...data,
      item: catalogItem(),
      mto: mtoOf(after ?? before),
      ...updated,
    }),
  );
  prismaMock.logs.create.mockResolvedValue({});
  checkAndUpdateMTOStatus.mockResolvedValue(false);
}

describe("PATCH /api/v1/materials_to_order_item/[id]", () => {
  describeAuthorization((options) => patch(undefined, options), {
    modules: ["materialstoorder", "supplier_details"],
    setup: () => mockPatch(),
    untouched: () => [
      prismaMock.materials_to_order_item.findUnique,
      prismaMock.materials_to_order_item.update,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockPatch();
    });

    it("updates quantity_ordered, records who ordered it, and logs", async () => {
      const res = await patch({ quantity_ordered: 5 });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe(true);
      expect(json.message).toBe("Materials to order item updated successfully");
      expect(json.warning).toBeUndefined();
      expect(json.data).toMatchObject({
        id: ID,
        quantity_ordered: 5,
        ordered_by_id: "user-1",
      });
      expect(prismaMock.materials_to_order_item.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ID },
          data: { quantity_ordered: 5, ordered_by_id: "user-1" },
        }),
      );
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "materials_to_order_item",
          entity_id: ID,
          action: "UPDATE",
          description:
            "Updated quantity_ordered=5 for mto_item=mi-1 (mto_id=mto-1, item_id=ITEM-1)",
        },
      });
    });

    it("takes ordered_by from the session, not the request body", async () => {
      await patch({ quantity_ordered: 1, ordered_by_id: "attacker" });

      expect(
        prismaMock.materials_to_order_item.update.mock.calls[0][0].data
          .ordered_by_id,
      ).toBe("user-1");
    });

    it.each([
      ["a numeric string", "7", 7],
      ["zero", 0, 0],
      ["a fraction (rounded down)", 2.9, 2],
      ["a decimal string (rounded down)", "3.7", 3],
    ])("accepts %s", async (_, input, stored) => {
      const res = await patch({ quantity_ordered: input });

      expect(res.status).toBe(200);
      expect(
        prismaMock.materials_to_order_item.update.mock.calls[0][0].data
          .quantity_ordered,
      ).toBe(stored);
    });

    it("re-checks the MTO status after the update", async () => {
      await patch();

      expect(checkAndUpdateMTOStatus).toHaveBeenCalledWith(ID);
    });

    describe("validation", () => {
      it.each([
        ["the body is empty", {}],
        ["quantity_ordered is missing", { other: 1 }],
      ])("returns 400 when %s", async (_, body) => {
        const res = await patch(body);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "quantity_ordered is required",
        });
        expect(
          prismaMock.materials_to_order_item.findUnique,
        ).not.toHaveBeenCalled();
      });

      it.each([
        ["negative", -1],
        ["not a number", "abc"],
        ["Infinity", "Infinity"],
      ])("returns 400 when quantity_ordered is %s", async (_, value) => {
        const res = await patch({ quantity_ordered: value });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "quantity_ordered must be a number >= 0",
        });
        expect(
          prismaMock.materials_to_order_item.update,
        ).not.toHaveBeenCalled();
      });

      // Current behaviour: Number(null) is 0 and Number("") is 0, so these
      // pass validation and reset the ordered quantity to zero.
      it.each([
        ["null", null],
        ["an empty string", ""],
      ])("treats %s as 0", async (_, value) => {
        const res = await patch({ quantity_ordered: value });

        expect(res.status).toBe(200);
        expect(
          prismaMock.materials_to_order_item.update.mock.calls[0][0].data
            .quantity_ordered,
        ).toBe(0);
      });
    });

    describe("not found", () => {
      it("returns 404 when the MTO item does not exist", async () => {
        prismaMock.materials_to_order_item.findUnique.mockResolvedValue(null);

        const res = await patch();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Materials to order item not found",
        });
        expect(
          prismaMock.materials_to_order_item.update,
        ).not.toHaveBeenCalled();
      });

      it("returns 404 when the parent MTO is soft deleted", async () => {
        mockPatch({ stored: { mto: { is_deleted: true } } });

        const res = await patch();

        expect(res.status).toBe(404);
        expect(
          prismaMock.materials_to_order_item.update,
        ).not.toHaveBeenCalled();
      });
    });

    describe('"supplier fully ordered" notification', () => {
      // Two lines from the same supplier; the second is already ordered.
      const twoLines = (firstOrdered) => [
        line(ID, { quantity: 5, quantity_ordered: firstOrdered }),
        line("mi-2", { quantity: 3, quantity_ordered: 3 }),
      ];

      it("is sent when this update completes the supplier's items", async () => {
        mockPatch({ before: twoLines(0), after: twoLines(5) });

        await patch({ quantity_ordered: 5 });

        expect(sendNotification).toHaveBeenCalledWith(
          {
            type: "material_to_order",
            materials_to_order_id: "mto-1",
            project_id: "proj-1",
            project_name: "Smith House",
            client_name: "Acme",
            lot_name: "LOT-1",
            supplier_name: "Alpha",
            is_ordered: true,
            status: "Alpha Ordered",
          },
          "materials_to_order_list_update",
        );
      });

      it("is not sent while some of the supplier's items are still unordered", async () => {
        mockPatch({
          before: twoLines(0),
          after: [
            line(ID, { quantity: 5, quantity_ordered: 2 }),
            line("mi-2", { quantity: 3, quantity_ordered: 0 }),
          ],
        });

        await patch({ quantity_ordered: 2 });

        expect(sendNotification).not.toHaveBeenCalled();
      });

      it("is not sent again when everything was already ordered", async () => {
        // the previous quantity of the edited line comes from the stored row
        mockPatch({
          before: twoLines(5),
          after: twoLines(5),
          stored: { quantity_ordered: 5 },
        });

        await patch({ quantity_ordered: 5 });

        expect(sendNotification).not.toHaveBeenCalled();
      });

      it("counts over-ordering as fully ordered", async () => {
        mockPatch({ before: twoLines(0), after: twoLines(9) });

        await patch({ quantity_ordered: 9 });

        expect(sendNotification).toHaveBeenCalledTimes(1);
      });

      it("ignores other suppliers' items when deciding", async () => {
        const other = line("mi-3", {
          quantity: 10,
          quantity_ordered: 0,
          item: catalogItem({
            item_id: "ITEM-3",
            itemSuppliers: [
              { supplier: { supplier_id: "SUP-2", name: "Beta" } },
            ],
          }),
        });
        mockPatch({
          before: [...twoLines(0), other],
          after: [...twoLines(5), other],
        });

        await patch({ quantity_ordered: 5 });

        expect(sendNotification).toHaveBeenCalledTimes(1);
      });

      it("joins multiple lot ids and falls back when there are none", async () => {
        const before = twoLines(0);
        const after = twoLines(5);
        prismaMock.materials_to_order_item.findUnique.mockResolvedValue({
          id: ID,
          mto_id: "mto-1",
          item_id: "ITEM-1",
          quantity_ordered: 0,
          mto: mtoOf(before),
        });
        prismaMock.materials_to_order_item.update.mockImplementation(
          async () => ({
            id: ID,
            mto_id: "mto-1",
            item: catalogItem(),
            mto: mtoOf(after, {
              lots: [{ lot_id: "L1" }, { lot_id: "L2" }],
            }),
          }),
        );
        await patch({ quantity_ordered: 5 });
        expect(sendNotification.mock.calls[0][0].lot_name).toBe("L1, L2");

        sendNotification.mockClear();
        prismaMock.materials_to_order_item.update.mockImplementation(
          async () => ({
            id: ID,
            mto_id: "mto-1",
            item: catalogItem(),
            mto: mtoOf(after, { lots: [] }),
          }),
        );
        await patch({ quantity_ordered: 5 });
        expect(sendNotification.mock.calls[0][0].lot_name).toBe("Unknown Lot");
      });

      it("falls back to Unknown values when project and client are missing", async () => {
        mockPatch({ before: twoLines(0), after: twoLines(5) });
        prismaMock.materials_to_order_item.update.mockImplementation(
          async () => ({
            id: ID,
            mto_id: "mto-1",
            item: catalogItem(),
            mto: mtoOf(twoLines(5), { project: null }),
          }),
        );

        await patch({ quantity_ordered: 5 });

        expect(sendNotification.mock.calls[0][0]).toMatchObject({
          project_name: "Unknown Project",
          client_name: "Unknown Client",
        });
      });

      it("still returns 200 when the notification fails", async () => {
        mockPatch({ before: twoLines(0), after: twoLines(5) });
        sendNotification.mockRejectedValue(new Error("WhatsApp down"));

        const res = await patch({ quantity_ordered: 5 });

        expect(res.status).toBe(200);
        expect(checkAndUpdateMTOStatus).toHaveBeenCalledWith(ID);
      });

      it("is skipped when the item has no supplier at all", async () => {
        const noSupplier = () => [
          line(ID, {
            item: catalogItem({ itemSuppliers: [] }),
          }),
        ];
        mockPatch({ before: noSupplier(), after: noSupplier() });
        prismaMock.materials_to_order_item.update.mockImplementation(
          async () => ({
            id: ID,
            mto_id: "mto-1",
            item: catalogItem({ itemSuppliers: [] }),
            mto: mtoOf(noSupplier()),
          }),
        );

        const res = await patch({ quantity_ordered: 5 });

        expect(res.status).toBe(200);
        expect(sendNotification).not.toHaveBeenCalled();
      });

      it("fires for items supplied through itemSuppliers", async () => {
        const viaJoin = (ordered) => [
          line(ID, { quantity: 5, quantity_ordered: ordered }),
        ];
        mockPatch({ before: viaJoin(0), after: viaJoin(5) });

        const res = await patch({ quantity_ordered: 5 });

        expect(res.status).toBe(200);
        expect(sendNotification).toHaveBeenCalledTimes(1);
      });

      it("never asks Prisma for the dropped item.supplier relation", async () => {
        await patch();

        const includes = [
          prismaMock.materials_to_order_item.findUnique.mock.calls[0][0],
          prismaMock.materials_to_order_item.update.mock.calls[0][0],
        ].map((c) => JSON.stringify(c.include));
        for (const inc of includes) {
          expect(inc).not.toMatch(/"item":\{"include":\{"supplier"/);
          expect(inc).toContain("itemSuppliers");
        }
      });
    });

    describe("failures", () => {
      it("returns 401 when the session cannot be re-read", async () => {
        const session = mockMasterAdmin();
        prismaMock.sessions.findUnique
          .mockReset()
          .mockResolvedValueOnce(session)
          .mockResolvedValueOnce(null);

        const res = await patch();

        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({
          status: false,
          message: "Unauthorized",
        });
        expect(
          prismaMock.materials_to_order_item.update,
        ).not.toHaveBeenCalled();
      });

      it("returns 200 with a warning when the log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await patch();

        expect(res.status).toBe(200);
        expect((await res.json()).warning).toBe(
          "Note: Update succeeded but logging failed",
        );
        expect(checkAndUpdateMTOStatus).toHaveBeenCalledWith(ID);
      });

      it("returns 500 when the lookup fails", async () => {
        prismaMock.materials_to_order_item.findUnique.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await patch();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
      });

      it("returns 500 when the update fails", async () => {
        prismaMock.materials_to_order_item.update.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await patch();

        expect(res.status).toBe(500);
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
        expect(checkAndUpdateMTOStatus).not.toHaveBeenCalled();
      });

      it("returns 500 when the status check fails", async () => {
        checkAndUpdateMTOStatus.mockRejectedValue(new Error("DB down"));

        const res = await patch();

        expect(res.status).toBe(500);
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
        expect(
          prismaMock.materials_to_order_item.update,
        ).not.toHaveBeenCalled();
      });
    });
  });
});
