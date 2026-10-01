// Tests for src/app/api/v1/materials_to_order/create/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

// sendNotification sends real WhatsApp messages; never call it in tests.
vi.mock("@/lib/notification", () => ({ sendNotification: vi.fn() }));

const { POST } = await import("@/app/api/v1/materials_to_order/create/route");
const { sendNotification } = await import("@/lib/notification");

const URL = "/api/v1/materials_to_order/create";
const validBody = () => ({
  project_id: "proj-1",
  notes: "Rush order",
  lot_ids: ["LOT-1"],
  items: [
    { item_id: "item-1", quantity: 4, notes: "matte" },
    { item_id: "item-2", quantity: 10 },
  ],
});

const post = (body = validBody(), options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

const completeMto = (overrides = {}) => ({
  id: "mto-1",
  project_id: "proj-1",
  project: { name: "Smith House", client: { client_name: "Acme" } },
  lots: [{ lot_id: "LOT-1" }],
  items: [],
  ...overrides,
});

function mockCreate({ complete = completeMto(), media = [] } = {}) {
  prismaMock.materials_to_order.create.mockResolvedValue({ id: "mto-1" });
  prismaMock.lot.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.materials_to_order.findUnique.mockResolvedValue(complete);
  prismaMock.media.findMany.mockResolvedValue(media);
  prismaMock.logs.create.mockResolvedValue({});
}

describe("POST /api/v1/materials_to_order/create", () => {
  describeAuthorization((options) => post(undefined, options), {
    modules: ["project_details", "materialstoorder"],
    setup: () => mockCreate(),
    untouched: () => [prismaMock.materials_to_order.create],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockCreate();
    });

    it("creates the MTO with nested items, attaches media and logs", async () => {
      mockCreate({ media: [{ id: "media-1" }] });

      const res = await post();

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Materials to order created successfully",
        data: { ...completeMto(), media: [{ id: "media-1" }] },
      });
      expect(prismaMock.materials_to_order.create).toHaveBeenCalledWith({
        data: {
          project_id: "proj-1",
          notes: "Rush order",
          createdBy_id: "user-1",
          items: {
            create: [
              { item_id: "item-1", quantity: 4, notes: "matte" },
              { item_id: "item-2", quantity: 10, notes: undefined },
            ],
          },
        },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "materials_to_order",
          entity_id: "mto-1",
          action: "CREATE",
          description:
            "Materials to order created successfully for project: Smith House",
        },
      });
    });

    it("takes createdBy from the session, not the request body", async () => {
      await post({ ...validBody(), createdBy_id: "attacker" });

      expect(
        prismaMock.materials_to_order.create.mock.calls[0][0].data.createdBy_id,
      ).toBe("user-1");
    });

    it("runs the create and lot assignment in one transaction", async () => {
      await post();

      expect(prismaMock.$transaction).toHaveBeenCalledOnce();
      expect(prismaMock.lot.updateMany).toHaveBeenCalledWith({
        where: { lot_id: { in: ["LOT-1"] } },
        data: { materials_to_orders_id: "mto-1" },
      });
    });

    it("omits project_id and items when they are not provided", async () => {
      await post({ notes: "bare" });

      const { data } = prismaMock.materials_to_order.create.mock.calls[0][0];
      expect(data).not.toHaveProperty("project_id");
      expect(data.items).toBeUndefined();
      expect(prismaMock.lot.updateMany).not.toHaveBeenCalled();
    });

    it("treats empty items and lot_ids like missing ones", async () => {
      await post({ project_id: "proj-1", items: [], lot_ids: [] });

      const { data } = prismaMock.materials_to_order.create.mock.calls[0][0];
      expect(data.items).toBeUndefined();
      expect(prismaMock.lot.updateMany).not.toHaveBeenCalled();
    });

    it("fetches only non-deleted media for the new MTO", async () => {
      await post();

      expect(prismaMock.media.findMany).toHaveBeenCalledWith({
        where: { materials_to_orderId: "mto-1", is_deleted: false },
      });
    });

    it("drops the project suffix from the log description when there is no project", async () => {
      mockCreate({ complete: completeMto({ project: null }) });

      await post({ notes: "x" });

      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: "Materials to order created successfully",
        }),
      });
    });

    describe("notification", () => {
      it("notifies with the project, client and lot", async () => {
        await post();

        expect(sendNotification).toHaveBeenCalledWith(
          {
            type: "material_to_order",
            materials_to_order_id: "mto-1",
            project_id: "proj-1",
            project_name: "Smith House",
            client_name: "Acme",
            lot_name: "LOT-1",
            is_new: true,
          },
          "materials_to_order_list_update",
        );
      });

      it("joins multiple lot ids", async () => {
        mockCreate({
          complete: completeMto({
            lots: [{ lot_id: "LOT-1" }, { lot_id: "LOT-2" }],
          }),
        });

        await post();

        expect(sendNotification.mock.calls[0][0].lot_name).toBe("LOT-1, LOT-2");
      });

      it("falls back to Unknown values when there is no project or lot", async () => {
        mockCreate({
          complete: completeMto({ project: null, lots: [], project_id: null }),
        });

        await post({ notes: "x" });

        expect(sendNotification.mock.calls[0][0]).toMatchObject({
          project_name: "Unknown Project",
          client_name: "Unknown Client",
          lot_name: "Unknown Lot",
        });
      });

      it("still returns 201 when the notification fails", async () => {
        sendNotification.mockRejectedValue(new Error("WhatsApp down"));

        const res = await post();

        expect(res.status).toBe(201);
        expect((await res.json()).status).toBe(true);
      });
    });

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
      expect(prismaMock.materials_to_order.create).not.toHaveBeenCalled();
    });

    it("returns 201 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await post();

      expect(res.status).toBe(201);
      expect((await res.json()).warning).toBe(
        "Note: Creation succeeded but logging failed",
      );
    });

    it("returns 500 when the transaction fails", async () => {
      prismaMock.materials_to_order.create.mockRejectedValue(
        new Error("FK violation"),
      );

      const res = await post();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
      expect(sendNotification).not.toHaveBeenCalled();
    });

    it("returns 500 when the lot assignment fails", async () => {
      prismaMock.lot.updateMany.mockRejectedValue(new Error("DB down"));

      const res = await post();

      expect(res.status).toBe(500);
      expect(prismaMock.materials_to_order.findUnique).not.toHaveBeenCalled();
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
      expect(prismaMock.materials_to_order.create).not.toHaveBeenCalled();
    });
  });
});
