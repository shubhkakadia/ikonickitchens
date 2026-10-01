import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/deletedrecords/all/route");

const get = (options) =>
  GET(buildRequest("/api/v1/deletedrecords/all", options));

const MODELS = ["employees", "client", "project", "lot", "item", "supplier"];

function mockEmpty() {
  for (const m of MODELS) prismaMock[m].findMany.mockResolvedValue([]);
}

const T1 = "2026-01-01T00:00:00.000Z";
const T2 = "2026-02-01T00:00:00.000Z";
const T3 = "2026-03-01T00:00:00.000Z";

// Fetch the one record the route produces for a single mocked row.
async function recordFor(model, row) {
  prismaMock[model].findMany.mockResolvedValue([{ updatedAt: T1, ...row }]);
  const { data } = await (await get()).json();
  expect(data).toHaveLength(1);
  return data[0];
}

const item = (overrides = {}) => ({
  item_id: "item-1",
  category: "SHEET",
  description: null,
  sheet: null,
  handle: null,
  hardware: null,
  accessory: null,
  edging_tape: null,
  ...overrides,
});

describe("GET /api/v1/deletedrecords/all", () => {
  describeAuthorization(get, {
    modules: "delete_media",
    setup: mockEmpty,
    untouched: () => MODELS.map((m) => prismaMock[m].findMany),
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockEmpty();
    });

    it("returns an empty list when nothing is deleted", async () => {
      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Deleted records fetched successfully",
        data: [],
      });
    });

    it("queries only soft-deleted rows from every table", async () => {
      await get();

      for (const m of MODELS) {
        expect(prismaMock[m].findMany.mock.calls[0][0].where).toEqual({
          is_deleted: true,
        });
      }
    });

    it("lists a deleted project's remaining (non-deleted) lots", async () => {
      await get();

      expect(prismaMock.project.findMany.mock.calls[0][0].select.lots).toEqual({
        where: { is_deleted: false },
        select: { name: true, lot_id: true },
      });
    });

    it("combines all tables, most recently updated first", async () => {
      prismaMock.client.findMany.mockResolvedValue([
        { client_id: "c1", client_name: "Old Client", updatedAt: T1 },
      ]);
      prismaMock.supplier.findMany.mockResolvedValue([
        { supplier_id: "s1", name: "New Supplier", updatedAt: T3 },
      ]);
      prismaMock.lot.findMany.mockResolvedValue([
        { id: "l1", lot_id: "LOT-1", name: "Kitchen", updatedAt: T2 },
      ]);

      const { data } = await (await get()).json();

      expect(data.map((r) => r.entity_type)).toEqual([
        "supplier",
        "lot",
        "client",
      ]);
    });

    describe("record shape per entity type", () => {
      it("employee: id, employee_id, and name + role", async () => {
        const r = await recordFor("employees", {
          id: "e-uuid",
          employee_id: "EMP-7",
          first_name: "Ann",
          last_name: "Lee",
          role: "Installer",
        });

        expect(r).toEqual({
          id: "e-uuid",
          entity_id: "EMP-7",
          entity_type: "employee",
          slug: "Ann Lee Installer",
          updatedAt: T1,
        });
      });

      // Current behaviour: only the ends are trimmed, so a missing last
      // name leaves a double space, and a missing role prints "null".
      it("employee: leaves a double space when last_name is missing", async () => {
        const r = await recordFor("employees", {
          id: "e",
          employee_id: "E",
          first_name: "Ann",
          last_name: null,
          role: "Installer",
        });

        expect(r.slug).toBe("Ann  Installer");
      });

      it("employee: prints 'null' when role is missing", async () => {
        const r = await recordFor("employees", {
          id: "e",
          employee_id: "E",
          first_name: "Ann",
          last_name: "Lee",
          role: null,
        });

        expect(r.slug).toBe("Ann Lee null");
      });

      it("client: client_id for both ids, name as slug", async () => {
        const r = await recordFor("client", {
          client_id: "c-uuid",
          client_name: "Bettio Construction",
        });

        expect(r).toEqual({
          id: "c-uuid",
          entity_id: "c-uuid",
          entity_type: "client",
          slug: "Bettio Construction",
          updatedAt: T1,
        });
      });

      it("project with lots: lot count and lot names", async () => {
        const r = await recordFor("project", {
          id: "p-uuid",
          project_id: "PRJ-1",
          name: "Smith House",
          lots: [
            { name: "Kitchen", lot_id: "L1" },
            { name: "Laundry", lot_id: "L2" },
          ],
        });

        expect(r).toEqual({
          id: "p-uuid",
          entity_id: "PRJ-1",
          entity_type: "project",
          slug: "2 lot(s): Kitchen, Laundry",
          updatedAt: T1,
        });
      });

      // The project name only appears when there are no lots.
      it("project without lots: falls back to the project name", async () => {
        const r = await recordFor("project", {
          id: "p",
          project_id: "PRJ-1",
          name: "Smith House",
          lots: [],
        });

        expect(r.slug).toBe("0 lot(s): Smith House");
      });

      it("lot: name with lot_id", async () => {
        const r = await recordFor("lot", {
          id: "l-uuid",
          lot_id: "LOT-9",
          name: "Kitchen",
        });

        expect(r).toEqual({
          id: "l-uuid",
          entity_id: "LOT-9",
          entity_type: "lot",
          slug: "Kitchen (LOT-9)",
          updatedAt: T1,
        });
      });

      it("supplier: supplier_id for both ids, name as slug", async () => {
        const r = await recordFor("supplier", {
          supplier_id: "s-uuid",
          name: "Blum",
        });

        expect(r).toEqual({
          id: "s-uuid",
          entity_id: "s-uuid",
          entity_type: "supplier",
          slug: "Blum",
          updatedAt: T1,
        });
      });

      it.each([
        [
          "sheet",
          { sheet: { brand: "Polytec", color: "White", finish: "Matt" } },
          "SHEET, Polytec, White, Matt",
        ],
        [
          "handle",
          {
            category: "HANDLE",
            handle: { brand: "Kethy", color: "Black", type: "Bar" },
          },
          "HANDLE, Kethy, Black, Bar",
        ],
        [
          "hardware",
          {
            category: "HARDWARE",
            hardware: { brand: "Blum", name: "Hinge", type: "Soft" },
          },
          "HARDWARE, Blum, Hinge, Soft",
        ],
        [
          "accessory",
          { category: "ACCESSORY", accessory: { name: "Bin" } },
          "ACCESSORY, Bin",
        ],
        [
          "edging tape",
          {
            category: "EDGING_TAPE",
            edging_tape: { brand: "Rehau", color: "Oak", finish: "Satin" },
          },
          "EDGING_TAPE, Rehau, Oak, Satin",
        ],
      ])(
        "item (%s): category plus its detail fields",
        async (_, overrides, slug) => {
          const r = await recordFor("item", item(overrides));

          expect(r).toEqual({
            id: "item-1",
            entity_id: "item-1",
            entity_type: "item",
            slug,
            updatedAt: T1,
          });
        },
      );

      it("item: skips empty detail fields and appends the description", async () => {
        const r = await recordFor(
          "item",
          item({
            sheet: { brand: "Polytec", color: null, finish: "" },
            description: "18mm board",
          }),
        );

        expect(r.slug).toBe("SHEET, Polytec, 18mm board");
      });

      it("item: just the category when there are no details", async () => {
        const r = await recordFor("item", item());

        expect(r.slug).toBe("SHEET");
      });
    });

    it.each(MODELS)("returns 500 when the %s query fails", async (model) => {
      prismaMock[model].findMany.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
