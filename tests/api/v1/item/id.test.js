// Tests for src/app/api/v1/item/[id]/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import {
  buildRequest,
  formBody,
  routeContext,
  testFile,
} from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

// Keep the real form-parsing helpers; stub the disk operations.
vi.mock("@/lib/fileHandler", async (importOriginal) => ({
  ...(await importOriginal()),
  uploadFile: vi.fn(),
  deleteFileByRelativePath: vi.fn(),
}));

const { GET, PATCH, DELETE } = await import("@/app/api/v1/item/[id]/route");
const { uploadFile, deleteFileByRelativePath } =
  await import("@/lib/fileHandler");

const ID = "item-1";
const URL = `/api/v1/item/${ID}`;
const ctx = () => routeContext({ id: ID });

const storedItem = (overrides = {}) => ({
  item_id: ID,
  category: "SHEET",
  description: "18mm white board",
  measurement_unit: "sheet",
  image_id: null,
  image: null,
  is_deleted: false,
  sheet: { brand: "Polytec", color: "White" },
  handle: null,
  edging_tape: null,
  ...overrides,
});

const withPhoto = (overrides = {}) =>
  storedItem({
    image_id: "old-media",
    image: { id: "old-media", url: "mediauploads/items/sheet/item-1-old.webp" },
    ...overrides,
  });

describe("GET /api/v1/item/[id]", () => {
  const get = (options) => GET(buildRequest(URL, options), ctx());

  function mockGet() {
    prismaMock.item.findFirst.mockResolvedValue(storedItem());
    prismaMock.stock_transaction.findMany.mockResolvedValue([]);
  }

  describeAuthorization(get, {
    modules: "item_details",
    setup: mockGet,
    untouched: () => [prismaMock.item.findFirst],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockGet();
    });

    it("returns the item with its stock transactions attached", async () => {
      const transactions = [{ id: "t1", type: "ADDED", quantity: 5 }];
      prismaMock.stock_transaction.findMany.mockResolvedValue(transactions);

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Item fetched successfully",
        data: { ...storedItem(), stock_transactions: transactions },
      });
    });

    it("only finds non-deleted items, with every relation", async () => {
      await get();

      const args = prismaMock.item.findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ item_id: ID, is_deleted: false });
      expect(Object.keys(args.include)).toEqual([
        "image",
        "sheet",
        "handle",
        "hardware",
        "accessory",
        "edging_tape",
        "itemSuppliers",
        "materials_to_order_items",
        "purchase_order_item",
        "reserve_item_stock",
      ]);
    });

    it("fetches stock transactions newest first", async () => {
      await get();

      const args = prismaMock.stock_transaction.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ item_id: ID });
      expect(args.orderBy).toEqual({ createdAt: "desc" });
    });

    it("returns 404 without loading transactions when the item is missing", async () => {
      prismaMock.item.findFirst.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Item not found",
      });
      expect(prismaMock.stock_transaction.findMany).not.toHaveBeenCalled();
    });

    it("returns 500 when a query fails", async () => {
      prismaMock.stock_transaction.findMany.mockRejectedValue(
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

describe("PATCH /api/v1/item/[id]", () => {
  const patch = (fields = {}, options = {}) =>
    PATCH(
      buildRequest(URL, {
        method: "PATCH",
        body: formBody(fields),
        ...options,
      }),
      ctx(),
    );

  const COMPLETE = { item_id: ID, category: "SHEET", complete: true };
  const UPLOAD_RESULT = {
    relativePath: "mediauploads/items/sheet/item-1.webp",
    originalFilename: "new.jpg",
    fileType: "image",
    mimeType: "image/webp",
    extension: "webp",
    size: 999,
  };

  // `links` = the item_suppliers rows the item has before the edit
  function mockPatch(existing = storedItem(), links = []) {
    // The first lookup (no hardware include) is the existence check; the
    // last one (full include) builds the response.
    prismaMock.item.findUnique.mockImplementation(async ({ include }) =>
      include.hardware ? COMPLETE : existing,
    );
    prismaMock.item.update.mockResolvedValue({});
    prismaMock.stock_transaction.findMany.mockResolvedValue([]);
    prismaMock.constants_config.findFirst.mockResolvedValue({ id: "brand" });
    for (const model of [
      "sheet",
      "handle",
      "hardware",
      "accessory",
      "edging_tape",
    ]) {
      prismaMock[model].update.mockResolvedValue({});
    }
    prismaMock.item_suppliers.findMany.mockResolvedValue(links);
    prismaMock.item_suppliers.update.mockResolvedValue({});
    prismaMock.item_suppliers.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.item_suppliers.create.mockResolvedValue({});
    prismaMock.media.create.mockResolvedValue({ id: "new-media" });
    prismaMock.media.update.mockResolvedValue({});
    prismaMock.media.delete.mockResolvedValue({});
    prismaMock.logs.create.mockResolvedValue({});
    uploadFile.mockResolvedValue(UPLOAD_RESULT);
    deleteFileByRelativePath.mockResolvedValue(true);
  }

  const itemUpdateData = () => prismaMock.item.update.mock.calls[0][0].data;

  describeAuthorization((options) => patch({ description: "x" }, options), {
    modules: "item_details",
    setup: () => mockPatch(),
    untouched: () => [prismaMock.item.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockPatch();
    });

    it("updates the item and returns it with stock transactions", async () => {
      const res = await patch({
        description: "New desc",
        measurement_unit: "m2",
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Item updated successfully",
        data: { ...COMPLETE, stock_transactions: [] },
      });
      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { item_id: ID },
        data: { description: "New desc", measurement_unit: "m2" },
      });
    });

    // Current behaviour (bug): item has no `name` column, so the log always
    // reads "Item updated successfully: undefined".
    it("logs the update with an undefined item name", async () => {
      await patch({ description: "x" });

      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "item",
          entity_id: ID,
          action: "UPDATE",
          description: "Item updated successfully: undefined",
        },
      });
    });

    it("never changes quantity (stock only moves through transactions)", async () => {
      await patch({ quantity: "999", description: "x" });

      expect(itemUpdateData()).not.toHaveProperty("quantity");
    });

    it("never changes the category", async () => {
      await patch({ category: "handle", color: "Black" });

      expect(itemUpdateData()).not.toHaveProperty("category");
      expect(prismaMock.handle.update).not.toHaveBeenCalled();
      expect(prismaMock.sheet.update).toHaveBeenCalled();
    });

    // item has no price column (price lives on item_suppliers), so a stray
    // `price` field must not reach the item update.
    it("ignores a top-level price", async () => {
      await patch({ price: "12.5", description: "x" });

      expect(itemUpdateData()).toEqual({ description: "x" });
    });

    describe("category-specific fields", () => {
      it("sheet: updates only the sheet fields that were sent", async () => {
        await patch({ color: "Black", dimensions: "3600x1800" });

        expect(prismaMock.sheet.update).toHaveBeenCalledWith({
          where: { item_id: ID },
          data: { color: "Black", dimensions: "3600x1800" },
        });
      });

      it.each([
        ["true", true],
        ["1", true],
        ["false", false],
      ])("sheet: is_sunmica %j becomes %s", async (value, expected) => {
        await patch({ is_sunmica: value });

        expect(prismaMock.sheet.update.mock.calls[0][0].data).toEqual({
          is_sunmica: expected,
        });
      });

      it("sheet: leaves is_sunmica alone when omitted", async () => {
        await patch({ color: "Black" });

        expect(
          prismaMock.sheet.update.mock.calls[0][0].data,
        ).not.toHaveProperty("is_sunmica");
      });

      it("handle: updates handle fields", async () => {
        mockPatch(
          storedItem({
            category: "HANDLE",
            sheet: null,
            handle: { brand: "Polytec" },
          }),
        );

        await patch({ color: "Black", type: "Knob", material: "Brass" });

        expect(prismaMock.handle.update).toHaveBeenCalledWith({
          where: { item_id: ID },
          data: { color: "Black", type: "Knob", material: "Brass" },
        });
      });

      // Current behaviour: create lowercases sub_category, PATCH does not.
      it("hardware: updates hardware fields without lowercasing sub_category", async () => {
        mockPatch(storedItem({ category: "HARDWARE", sheet: null }));

        await patch({ name: "Hinge", sub_category: "HINGES" });

        expect(prismaMock.hardware.update).toHaveBeenCalledWith({
          where: { item_id: ID },
          data: { name: "Hinge", sub_category: "HINGES" },
        });
      });

      it("accessory: updates the name", async () => {
        mockPatch(storedItem({ category: "ACCESSORY", sheet: null }));

        await patch({ name: "Bin" });

        expect(prismaMock.accessory.update).toHaveBeenCalledWith({
          where: { item_id: ID },
          data: { name: "Bin" },
        });
      });

      it("edging_tape: updates edging tape fields", async () => {
        mockPatch(
          storedItem({
            category: "EDGING_TAPE",
            sheet: null,
            edging_tape: { brand: "Polytec" },
          }),
        );

        await patch({ finish: "Gloss" });

        expect(prismaMock.edging_tape.update).toHaveBeenCalledWith({
          where: { item_id: ID },
          data: { finish: "Gloss" },
        });
      });

      it("skips the detail update when no detail fields are sent", async () => {
        await patch({ description: "x" });

        expect(prismaMock.sheet.update).not.toHaveBeenCalled();
      });

      it("ignores fields that belong to other categories", async () => {
        await patch({ material: "Steel", name: "Nope" });

        expect(prismaMock.sheet.update).not.toHaveBeenCalled();
      });
    });

    describe("brand validation", () => {
      it("returns 400 for a new brand that is not configured", async () => {
        prismaMock.constants_config.findFirst.mockResolvedValue(null);

        const res = await patch({ brand: "NoName", description: "x" });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Please select a brand from the configured brand list",
        });
        expect(prismaMock.item.update).not.toHaveBeenCalled();
      });

      it("accepts a new brand that is configured", async () => {
        const res = await patch({ brand: "Laminex" });

        expect(res.status).toBe(200);
        expect(prismaMock.constants_config.findFirst).toHaveBeenCalledWith({
          where: { category: "brand", value: "Laminex" },
        });
        expect(prismaMock.sheet.update.mock.calls[0][0].data).toEqual({
          brand: "Laminex",
        });
      });

      it("keeps an existing (legacy) brand without checking the list", async () => {
        prismaMock.constants_config.findFirst.mockResolvedValue(null);

        const res = await patch({ brand: "Polytec" });

        expect(res.status).toBe(200);
        expect(prismaMock.constants_config.findFirst).not.toHaveBeenCalled();
      });

      it("does not check hardware brands", async () => {
        mockPatch(storedItem({ category: "HARDWARE", sheet: null }));
        prismaMock.constants_config.findFirst.mockResolvedValue(null);

        const res = await patch({ brand: "Anything" });

        expect(res.status).toBe(200);
        expect(prismaMock.constants_config.findFirst).not.toHaveBeenCalled();
      });
    });

    describe("suppliers", () => {
      const link = (id, supplier_id, overrides = {}) => ({
        id,
        item_id: ID,
        supplier_id,
        supplier_reference: "OLD",
        supplier_product_link: null,
        price: 5,
        ...overrides,
      });

      it("leaves supplier links untouched when suppliers is omitted", async () => {
        await patch({ description: "x" });

        expect(prismaMock.item_suppliers.findMany).not.toHaveBeenCalled();
        expect(prismaMock.item_suppliers.deleteMany).not.toHaveBeenCalled();
      });

      it("creates links for new suppliers inside a transaction", async () => {
        await patch({
          suppliers: JSON.stringify([
            { supplier_id: "s1", supplier_reference: "R1", price: "9.99" },
            { supplier_id: "s2" },
          ]),
        });

        expect(prismaMock.$transaction).toHaveBeenCalled();
        expect(prismaMock.item_suppliers.deleteMany).not.toHaveBeenCalled();
        expect(prismaMock.item_suppliers.create).toHaveBeenNthCalledWith(1, {
          data: {
            item_id: ID,
            supplier_id: "s1",
            supplier_reference: "R1",
            supplier_product_link: null,
            price: 9.99,
          },
        });
        expect(prismaMock.item_suppliers.create).toHaveBeenNthCalledWith(2, {
          data: {
            item_id: ID,
            supplier_id: "s2",
            supplier_reference: null,
            supplier_product_link: null,
            price: null,
          },
        });
      });

      it("updates a link that stays in place instead of deleting and recreating it", async () => {
        mockPatch(storedItem(), [link("l1", "s1")]);

        await patch({
          suppliers: JSON.stringify([
            { supplier_id: "s1", supplier_reference: "NEW", price: "7.5" },
          ]),
        });

        expect(prismaMock.item_suppliers.update).toHaveBeenCalledWith({
          where: { id: "l1" },
          data: {
            supplier_reference: "NEW",
            supplier_product_link: null,
            price: 7.5,
          },
        });
        expect(prismaMock.item_suppliers.create).not.toHaveBeenCalled();
        expect(prismaMock.item_suppliers.deleteMany).not.toHaveBeenCalled();
      });

      it("removes only the suppliers that were taken off the item", async () => {
        mockPatch(storedItem(), [link("l1", "s1"), link("l2", "s2")]);

        await patch({ suppliers: JSON.stringify([{ supplier_id: "s1" }]) });

        expect(prismaMock.item_suppliers.update).toHaveBeenCalledTimes(1);
        expect(prismaMock.item_suppliers.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ["l2"] } },
        });
      });

      it("cleans up a duplicate link row for the same supplier", async () => {
        mockPatch(storedItem(), [link("l1", "s1"), link("l1-dup", "s1")]);

        await patch({ suppliers: JSON.stringify([{ supplier_id: "s1" }]) });

        expect(prismaMock.item_suppliers.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: "l1" } }),
        );
        expect(prismaMock.item_suppliers.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ["l1-dup"] } },
        });
      });

      it("removes every supplier link when suppliers is an empty array", async () => {
        mockPatch(storedItem(), [link("l1", "s1"), link("l2", "s2")]);

        await patch({ suppliers: "[]" });

        expect(prismaMock.item_suppliers.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ["l1", "l2"] } },
        });
        expect(prismaMock.item_suppliers.create).not.toHaveBeenCalled();
      });

      it("returns 400 for invalid suppliers JSON before changing anything", async () => {
        const res = await patch({ suppliers: "[{oops", description: "x" });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Invalid suppliers format - must be valid JSON array",
        });
        expect(prismaMock.item.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.item.update).not.toHaveBeenCalled();
      });

      it.each([
        [
          "not an array",
          JSON.stringify({ supplier_id: "s1" }),
          "Invalid suppliers format - must be valid JSON array",
        ],
        [
          "missing a supplier_id",
          JSON.stringify([{ price: "1" }]),
          "Each supplier must have a supplier_id",
        ],
        [
          "listing a supplier twice",
          JSON.stringify([{ supplier_id: "s1" }, { supplier_id: "s1" }]),
          "A supplier can only be listed once per item",
        ],
        [
          "carrying a bad price",
          JSON.stringify([{ supplier_id: "s1", price: "abc" }]),
          "Supplier price must be a non-negative amount",
        ],
        [
          "carrying a negative price",
          JSON.stringify([{ supplier_id: "s1", price: "-3" }]),
          "Supplier price must be a non-negative amount",
        ],
      ])(
        "returns 400 before changing anything when suppliers is %s",
        async (_, suppliers, message) => {
          const res = await patch({ suppliers, description: "x" });

          expect(res.status).toBe(400);
          expect((await res.json()).message).toBe(message);
          expect(prismaMock.item.update).not.toHaveBeenCalled();
          expect(prismaMock.item_suppliers.create).not.toHaveBeenCalled();
        },
      );
    });

    describe("photo", () => {
      it("soft deletes the photo when image is sent as an empty string", async () => {
        mockPatch(withPhoto());

        const res = await patch({ image: "" });

        expect(res.status).toBe(200);
        expect(prismaMock.item.update).toHaveBeenCalledWith({
          where: { item_id: ID },
          data: { image_id: null },
        });
        expect(prismaMock.media.update).toHaveBeenCalledWith({
          where: { id: "old-media" },
          data: { is_deleted: true },
        });
        // the row and the file stay for the deleted-media screen
        expect(prismaMock.media.delete).not.toHaveBeenCalled();
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
      });

      it("does nothing for an empty image when there is no photo", async () => {
        await patch({ image: "" });

        expect(prismaMock.media.update).not.toHaveBeenCalled();
        expect(prismaMock.media.delete).not.toHaveBeenCalled();
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
      });

      // Current behaviour: a failed removal is swallowed with no warning.
      it("still returns 200 (no warning) when removing the photo fails", async () => {
        mockPatch(withPhoto());
        prismaMock.media.update.mockRejectedValue(new Error("DB down"));

        const res = await patch({ image: "" });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.status).toBe(true);
        expect(json).not.toHaveProperty("imageWarning");
      });

      it("uploads the new photo first, then swaps and soft deletes the old one in one transaction", async () => {
        mockPatch(withPhoto());
        const order = [];
        uploadFile.mockImplementation(async () => {
          order.push("upload new");
          return UPLOAD_RESULT;
        });
        prismaMock.media.create.mockImplementation(async () => {
          order.push("create media");
          return { id: "new-media" };
        });
        prismaMock.media.update.mockImplementation(async () => {
          order.push("soft delete old row");
          return {};
        });

        const res = await patch({ image: testFile("new.jpg") });

        expect(res.status).toBe(200);
        expect(order).toEqual([
          "upload new",
          "create media",
          "soft delete old row",
        ]);
        expect(uploadFile).toHaveBeenCalledWith(expect.any(File), {
          uploadDir: "mediauploads",
          subDir: "items/sheet",
          filenameStrategy: "unique",
          allowedGroups: ["image"],
          maxSize: 10 * 1024 * 1024,
          idPrefix: ID,
        });
        expect(prismaMock.item.update).toHaveBeenCalledWith({
          where: { item_id: ID },
          data: { image_id: "new-media" },
        });
        expect(prismaMock.media.update).toHaveBeenCalledWith({
          where: { id: "old-media" },
          data: { is_deleted: true },
        });
        expect(prismaMock.media.delete).not.toHaveBeenCalled();
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
        expect(prismaMock.$transaction).toHaveBeenCalled();
      });

      it("does not soft delete anything when adding a first photo", async () => {
        await patch({ image: testFile() });

        expect(prismaMock.media.create).toHaveBeenCalled();
        expect(prismaMock.media.update).not.toHaveBeenCalled();
        expect(prismaMock.media.delete).not.toHaveBeenCalled();
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
      });

      it("keeps the old photo and removes the new file when linking fails", async () => {
        mockPatch(withPhoto());
        prismaMock.media.create.mockRejectedValue(new Error("DB down"));

        const res = await patch({ image: testFile() });

        expect(res.status).toBe(500);
        expect(prismaMock.media.update).not.toHaveBeenCalled();
        expect(deleteFileByRelativePath).toHaveBeenCalledWith(
          UPLOAD_RESULT.relativePath,
        );
      });

      // Current behaviour: the field and supplier changes are already saved
      // when the upload fails, but the response is a 500.
      it("returns 500 after saving the other changes when the upload fails, keeping the old photo", async () => {
        mockPatch(withPhoto());
        uploadFile.mockRejectedValue(new Error("virus detected"));

        const res = await patch({
          description: "Saved anyway",
          image: testFile(),
        });

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Failed to upload image",
          error: "virus detected",
        });
        expect(prismaMock.item.update).toHaveBeenCalledWith({
          where: { item_id: ID },
          data: { description: "Saved anyway" },
        });
        expect(prismaMock.media.update).not.toHaveBeenCalled();
        expect(prismaMock.media.delete).not.toHaveBeenCalled();
        expect(deleteFileByRelativePath).not.toHaveBeenCalled();
      });
    });

    it("returns 404 when the item does not exist", async () => {
      prismaMock.item.findUnique.mockResolvedValue(null);

      const res = await patch({ description: "x" });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Item does not exist",
      });
      expect(prismaMock.item.update).not.toHaveBeenCalled();
    });

    // Current behaviour: the lookup ignores is_deleted.
    it("updates a soft-deleted item", async () => {
      mockPatch(storedItem({ is_deleted: true }));

      const res = await patch({ description: "x" });

      expect(res.status).toBe(200);
      expect(prismaMock.item.update).toHaveBeenCalled();
    });

    it("returns 400 when the body is not form data", async () => {
      const res = await PATCH(
        buildRequest(URL, { method: "PATCH", body: { description: "x" } }),
        ctx(),
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.status).toBe(false);
      expect(json.message).toBe("Failed to parse form data");
      expect(prismaMock.item.update).not.toHaveBeenCalled();
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await patch({ description: "x" });

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Update succeeded but logging failed",
      );
    });

    it("returns 500 when the item update fails", async () => {
      prismaMock.item.update.mockRejectedValue(new Error("DB down"));

      const res = await patch({ description: "x" });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});

describe("DELETE /api/v1/item/[id]", () => {
  const del = (options) =>
    DELETE(buildRequest(URL, { method: "DELETE", ...options }), ctx());

  function mockDelete(existing = storedItem()) {
    prismaMock.item.findUnique.mockResolvedValue(existing);
    prismaMock.item.update.mockResolvedValue({ ...existing, is_deleted: true });
    prismaMock.media.update.mockResolvedValue({});
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization(del, {
    modules: "item_details",
    setup: () => mockDelete(),
    untouched: () => [prismaMock.item.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    it("soft deletes the item and logs it", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Item deleted successfully",
        data: { ...storedItem(), is_deleted: true },
      });
      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { item_id: ID },
        data: { is_deleted: true },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "item",
          entity_id: ID,
          action: "DELETE",
          description: "Item deleted successfully: 18mm white board",
        },
      });
    });

    it("logs the item id when there is no description", async () => {
      mockDelete(storedItem({ description: null }));

      await del();

      expect(prismaMock.logs.create.mock.calls[0][0].data.description).toBe(
        `Item deleted successfully: ${ID}`,
      );
    });

    it("also soft deletes the item's photo", async () => {
      mockDelete(withPhoto());

      await del();

      expect(prismaMock.media.update).toHaveBeenCalledWith({
        where: { id: "old-media" },
        data: { is_deleted: true },
      });
    });

    it("never hard deletes the item or its photo", async () => {
      mockDelete(withPhoto());

      await del();

      expect(prismaMock.item.delete).not.toHaveBeenCalled();
      expect(prismaMock.media.delete).not.toHaveBeenCalled();
    });

    it("still deletes the item when the photo update fails", async () => {
      mockDelete(withPhoto());
      prismaMock.media.update.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect(prismaMock.item.update).toHaveBeenCalled();
    });

    it("returns 404 when the item does not exist", async () => {
      prismaMock.item.findUnique.mockResolvedValue(null);

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Item not found",
      });
      expect(prismaMock.item.update).not.toHaveBeenCalled();
    });

    it("returns 400 when the item is already deleted", async () => {
      mockDelete(storedItem({ is_deleted: true }));

      const res = await del();

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Item already deleted",
      });
      expect(prismaMock.item.update).not.toHaveBeenCalled();
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Deletion succeeded but logging failed",
      );
    });

    it("returns 500 when the update fails", async () => {
      prismaMock.item.update.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });
  });
});
