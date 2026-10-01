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

const { POST } = await import("@/app/api/v1/item/create/route");
const { uploadFile } = await import("@/lib/fileHandler");

const URL = "/api/v1/item/create";
const sheetFields = (overrides = {}) => ({
  category: "sheet",
  description: "18mm white board",
  quantity: "10",
  measurement_unit: "sheet",
  brand: "Polytec",
  color: "White",
  finish: "Matt",
  face: "double side",
  dimensions: "2400x1200",
  ...overrides,
});
const post = (fields = sheetFields(), options = {}) =>
  POST(
    buildRequest(URL, { method: "POST", body: formBody(fields), ...options }),
    routeContext(),
  );

const UPLOAD_RESULT = {
  relativePath: "mediauploads/items/sheet/item-1.webp",
  originalFilename: "board.jpg",
  fileType: "image",
  mimeType: "image/webp",
  extension: "webp",
  size: 4321,
};

function mockCreate() {
  prismaMock.constants_config.findFirst.mockResolvedValue({ id: "brand-1" });
  prismaMock.item.create.mockImplementation(async ({ data }) => ({
    item_id: "item-1",
    ...data,
  }));
  prismaMock.item.findUnique.mockResolvedValue({
    item_id: "item-1",
    refreshed: true,
  });
  prismaMock.item.update.mockResolvedValue({});
  prismaMock.media.create.mockResolvedValue({ id: "media-1" });
  prismaMock.logs.create.mockResolvedValue({});
  uploadFile.mockResolvedValue(UPLOAD_RESULT);
}

const createArgs = () => prismaMock.item.create.mock.calls[0][0];

describe("POST /api/v1/item/create", () => {
  describeAuthorization((options) => post(sheetFields(), options), {
    modules: [
      "add_items",
      "purchaseorder",
      "supplier_details",
      "materialstoorder",
      "project_details",
    ],
    setup: mockCreate,
    untouched: () => [prismaMock.item.create],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockCreate();
    });

    it("creates the item in a transaction, returns it and logs it", async () => {
      const res = await post();

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Item created successfully",
        data: { item_id: "item-1", refreshed: true },
      });
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.item.findUnique).toHaveBeenCalledWith({
        where: { item_id: "item-1" },
        include: {
          image: true,
          sheet: true,
          handle: true,
          hardware: true,
          accessory: true,
          edging_tape: true,
          itemSuppliers: { include: { supplier: true } },
        },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "item",
          entity_id: "item-1",
          action: "CREATE",
          description: "Item created successfully: 18mm white board",
        },
      });
    });

    describe("category-specific details", () => {
      it("sheet: stores sheet fields and defaults is_sunmica to false", async () => {
        await post();

        expect(createArgs().data).toEqual({
          description: "18mm white board",
          quantity: 10,
          category: "SHEET",
          measurement_unit: "sheet",
          sheet: {
            create: {
              brand: "Polytec",
              color: "White",
              finish: "Matt",
              face: "double side",
              dimensions: "2400x1200",
              is_sunmica: false,
            },
          },
        });
      });

      it.each([
        ["true", true],
        ["1", true],
        ["false", false],
        ["yes", false],
      ])("sheet: is_sunmica %j is stored as %s", async (value, expected) => {
        await post(sheetFields({ is_sunmica: value }));

        expect(createArgs().data.sheet.create.is_sunmica).toBe(expected);
      });

      it("handle: stores handle fields", async () => {
        await post({
          category: "handle",
          brand: "Polytec",
          color: "Black",
          type: "Bar",
          dimensions: "128mm",
          material: "Steel",
        });

        expect(createArgs().data).toMatchObject({
          category: "HANDLE",
          handle: {
            create: {
              brand: "Polytec",
              color: "Black",
              type: "Bar",
              dimensions: "128mm",
              material: "Steel",
            },
          },
        });
      });

      it("hardware: stores hardware fields and lowercases sub_category", async () => {
        await post({
          category: "hardware",
          brand: "Blum",
          name: "Hinge",
          type: "Soft close",
          dimensions: "110deg",
          sub_category: "HINGES",
        });

        expect(createArgs().data).toMatchObject({
          category: "HARDWARE",
          hardware: {
            create: {
              brand: "Blum",
              name: "Hinge",
              type: "Soft close",
              dimensions: "110deg",
              sub_category: "hinges",
            },
          },
        });
      });

      it("hardware: stores an empty sub_category when omitted", async () => {
        await post({ category: "hardware", name: "Hinge" });

        expect(createArgs().data.hardware.create.sub_category).toBe("");
      });

      it("accessory: stores only the name", async () => {
        await post({ category: "accessory", name: "Pull-out bin" });

        expect(createArgs().data).toMatchObject({
          category: "ACCESSORY",
          accessory: { create: { name: "Pull-out bin" } },
        });
      });

      it("edging_tape: stores edging tape fields", async () => {
        await post({
          category: "edging_tape",
          brand: "Polytec",
          color: "Oak",
          finish: "Satin",
          dimensions: "22x1",
        });

        expect(createArgs().data).toMatchObject({
          category: "EDGING_TAPE",
          edging_tape: {
            create: {
              brand: "Polytec",
              color: "Oak",
              finish: "Satin",
              dimensions: "22x1",
            },
          },
        });
      });

      it("accepts the category in any letter case", async () => {
        const res = await post(sheetFields({ category: "SHEET" }));

        expect(res.status).toBe(201);
        expect(createArgs().data.category).toBe("SHEET");
      });
    });

    describe("quantity and measurement unit", () => {
      it("stores null quantity and unit when omitted", async () => {
        await post(
          sheetFields({ quantity: undefined, measurement_unit: undefined }),
        );

        expect(createArgs().data.quantity).toBeNull();
        expect(createArgs().data.measurement_unit).toBeNull();
      });

      it("parses a decimal quantity", async () => {
        await post(sheetFields({ quantity: "2.5" }));

        expect(createArgs().data.quantity).toBe(2.5);
      });

      // Current behaviour: the price field is read but never stored (item
      // has no price column; prices live on item_suppliers).
      it("ignores a top-level price", async () => {
        await post(sheetFields({ price: "99.50" }));

        expect(createArgs().data).not.toHaveProperty("price");
      });
    });

    describe("brand validation", () => {
      it.each(["sheet", "handle", "edging_tape"])(
        "checks the %s brand against the configured brand list",
        async (category) => {
          await post({ category, brand: "Polytec" });

          expect(prismaMock.constants_config.findFirst).toHaveBeenCalledWith({
            where: { category: "brand", value: "Polytec" },
          });
        },
      );

      it("returns 400 when the brand is not configured", async () => {
        prismaMock.constants_config.findFirst.mockResolvedValue(null);

        const res = await post(sheetFields({ brand: "NoName" }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Please select a brand from the configured brand list",
        });
        expect(prismaMock.item.create).not.toHaveBeenCalled();
      });

      it("does not check hardware brands", async () => {
        prismaMock.constants_config.findFirst.mockResolvedValue(null);

        const res = await post({ category: "hardware", brand: "AnyBrand" });

        expect(res.status).toBe(201);
        expect(prismaMock.constants_config.findFirst).not.toHaveBeenCalled();
      });

      it("skips the check when no brand is sent", async () => {
        await post(sheetFields({ brand: undefined }));

        expect(prismaMock.constants_config.findFirst).not.toHaveBeenCalled();
      });
    });

    describe("suppliers", () => {
      it("creates supplier links, parsing prices and nulling blanks", async () => {
        await post(
          sheetFields({
            suppliers: JSON.stringify([
              {
                supplier_id: "s1",
                supplier_reference: "REF-1",
                supplier_product_link: "https://s1.test/p",
                price: "12.50",
              },
              { supplier_id: "s2", supplier_reference: "", price: "" },
            ]),
          }),
        );

        expect(createArgs().data.itemSuppliers).toEqual({
          create: [
            {
              supplier_id: "s1",
              supplier_reference: "REF-1",
              supplier_product_link: "https://s1.test/p",
              price: 12.5,
            },
            {
              supplier_id: "s2",
              supplier_reference: null,
              supplier_product_link: null,
              price: null,
            },
          ],
        });
      });

      it.each([
        ["omitted", undefined],
        ["an empty array", "[]"],
      ])(
        "creates no supplier links when suppliers is %s",
        async (_, suppliers) => {
          await post(sheetFields({ suppliers }));

          expect(createArgs().data).not.toHaveProperty("itemSuppliers");
        },
      );

      it("returns 400 when suppliers is not valid JSON", async () => {
        const res = await post(sheetFields({ suppliers: "[{bad" }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Invalid suppliers format - must be valid JSON array",
        });
        expect(prismaMock.item.create).not.toHaveBeenCalled();
      });

      // Current behaviour: valid JSON that is not an array (a string) makes
      // .map throw, answered as a 500.
      it("returns 500 when suppliers is a JSON string rather than an array", async () => {
        const res = await post(sheetFields({ suppliers: '"s1"' }));

        expect(res.status).toBe(500);
        expect(prismaMock.item.create).not.toHaveBeenCalled();
      });
    });

    describe("photo upload", () => {
      it("uploads the photo into the category folder and links it", async () => {
        const res = await post(sheetFields({ image: testFile("board.jpg") }));

        expect(res.status).toBe(201);
        expect(uploadFile).toHaveBeenCalledWith(expect.any(File), {
          uploadDir: "mediauploads",
          subDir: "items/sheet",
          filenameStrategy: "id-based",
          allowedGroups: ["image"],
          maxSize: 10 * 1024 * 1024,
          idPrefix: "item-1",
        });
        expect(prismaMock.media.create).toHaveBeenCalledWith({
          data: {
            url: "mediauploads/items/sheet/item-1.webp",
            filename: "board.jpg",
            file_type: "image",
            mime_type: "image/webp",
            extension: "webp",
            size: 4321,
            item_id: "item-1",
          },
        });
        expect(prismaMock.item.update).toHaveBeenCalledWith({
          where: { item_id: "item-1" },
          data: { image_id: "media-1" },
        });
      });

      it("skips the upload when no photo is sent", async () => {
        await post();

        expect(uploadFile).not.toHaveBeenCalled();
      });

      // Current behaviour: the item is already committed when the upload
      // fails, but the client gets a 500, so a retry creates a duplicate.
      it("returns 500 after creating the item when the upload fails", async () => {
        uploadFile.mockRejectedValue(new Error("virus detected"));

        const res = await post(sheetFields({ image: testFile() }));

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Failed to upload image",
          error: "virus detected",
        });
        expect(prismaMock.item.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });
    });

    it("logs a fallback description when none is given", async () => {
      await post({ category: "accessory", name: "Bin" });

      expect(prismaMock.logs.create.mock.calls[0][0].data.description).toBe(
        "Item created successfully: Item (accessory)",
      );
    });

    it("returns 201 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await post();

      expect(res.status).toBe(201);
      expect((await res.json()).warning).toBe(
        "Note: Creation succeeded but logging failed",
      );
    });

    it.each(["panel", "sheets"])(
      "returns 400 for unknown category %j",
      async (category) => {
        const res = await post(sheetFields({ category }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Invalid category",
        });
        expect(prismaMock.item.create).not.toHaveBeenCalled();
      },
    );

    // Current behaviour (bug): formData.get("category") is null, and
    // null.toLowerCase() throws, so a missing category is a 500.
    it("returns 500 when the category is missing", async () => {
      const res = await post(sheetFields({ category: undefined }));

      expect(res.status).toBe(500);
      expect(prismaMock.item.create).not.toHaveBeenCalled();
    });

    it("returns 500 when the create fails", async () => {
      prismaMock.item.create.mockRejectedValue(new Error("DB down"));

      const res = await post();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(uploadFile).not.toHaveBeenCalled();
    });

    it("returns 500 for a JSON body (multipart is required)", async () => {
      const res = await POST(
        buildRequest(URL, { method: "POST", body: sheetFields() }),
        routeContext(),
      );

      expect(res.status).toBe(500);
      expect(prismaMock.item.create).not.toHaveBeenCalled();
    });
  });
});
