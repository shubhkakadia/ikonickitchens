// Tests for src/app/api/v1/search/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { POST } = await import("@/app/api/v1/search/route");

const URL = "/api/v1/search";
const post = (body = { search: "oak" }, options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

const SEARCH_MODELS = ["client", "employees", "supplier", "project", "item"];

function mockSearch(results = {}) {
  prismaMock.client.findMany.mockResolvedValue(results.clients ?? []);
  prismaMock.employees.findMany.mockResolvedValue(results.employees ?? []);
  prismaMock.supplier.findMany.mockResolvedValue(results.suppliers ?? []);
  prismaMock.project.findMany.mockResolvedValue(results.projects ?? []);
  prismaMock.item.findMany.mockResolvedValue(results.items ?? []);
}

const where = (model) => prismaMock[model].findMany.mock.calls[0][0].where;
const contains = (value) => ({ contains: value });

// An inventory item as the query returns it: only one detail record is set
const item = (overrides = {}) => ({
  item_id: "ITEM-1",
  category: "SHEET",
  quantity: 12,
  measurement_unit: "SHEET",
  image: null,
  sheet: null,
  handle: null,
  hardware: null,
  accessory: null,
  edging_tape: null,
  ...overrides,
});

describe("POST /api/v1/search", () => {
  describeAuthorization((options) => post(undefined, options), {
    setup: () => mockSearch(),
    untouched: () => SEARCH_MODELS.map((m) => prismaMock[m].findMany),
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockSearch();
    });

    describe("validation", () => {
      it.each([
        ["missing", {}],
        ["empty", { search: "" }],
        ["whitespace only", { search: "   " }],
        ["null", { search: null }],
        ["a number", { search: 123 }],
        ["an array", { search: ["oak"] }],
      ])("returns 400 when the search term is %s", async (_, body) => {
        const res = await post(body);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Search term is required",
        });
        for (const model of SEARCH_MODELS) {
          expect(prismaMock[model].findMany).not.toHaveBeenCalled();
        }
      });
    });

    it("returns empty groups when nothing matches", async () => {
      const res = await post();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        data: {
          clients: [],
          employees: [],
          items: [],
          suppliers: [],
          projects: [],
        },
      });
    });

    it("searches every entity type with the trimmed term", async () => {
      await post({ search: "  oak  " });

      for (const model of SEARCH_MODELS) {
        expect(prismaMock[model].findMany).toHaveBeenCalledOnce();
      }
      expect(where("client")).toEqual({
        OR: [
          { client_name: contains("oak") },
          { client_type: contains("oak") },
        ],
      });
      expect(where("supplier")).toEqual({ name: contains("oak") });
      expect(where("project")).toEqual({ name: contains("oak") });
    });

    describe("clients", () => {
      it("returns id, type and name only", async () => {
        mockSearch({
          clients: [
            {
              client_id: "c1",
              client_type: "RESIDENTIAL",
              client_name: "Acme",
              secret: "x",
            },
          ],
        });

        const json = await (await post()).json();

        expect(json.data.clients).toEqual([
          { client_id: "c1", client_type: "RESIDENTIAL", client_name: "Acme" },
        ]);
        expect(prismaMock.client.findMany.mock.calls[0][0].select).toEqual({
          client_id: true,
          client_type: true,
          client_name: true,
        });
      });
    });

    describe("employees", () => {
      it("matches first name, last name or role, active employees only", async () => {
        await post();

        expect(where("employees")).toEqual({
          OR: [
            { first_name: contains("oak") },
            { last_name: contains("oak") },
            { role: contains("oak") },
          ],
          is_active: { not: false },
        });
      });

      it("flattens the image to a url, or null", async () => {
        mockSearch({
          employees: [
            {
              employee_id: "e1",
              first_name: "Ann",
              last_name: "Lee",
              role: "Installer",
              image: { url: "/img/a.jpg" },
            },
            {
              employee_id: "e2",
              first_name: "Bob",
              last_name: "Ray",
              role: "Drafter",
              image: null,
            },
          ],
        });

        const json = await (await post()).json();

        expect(json.data.employees).toEqual([
          {
            employee_id: "e1",
            image: "/img/a.jpg",
            first_name: "Ann",
            last_name: "Lee",
            role: "Installer",
          },
          {
            employee_id: "e2",
            image: null,
            first_name: "Bob",
            last_name: "Ray",
            role: "Drafter",
          },
        ]);
      });
    });

    describe("suppliers", () => {
      it("renames name to supplier_name", async () => {
        mockSearch({ suppliers: [{ supplier_id: "s1", name: "Timber Co" }] });

        const json = await (await post()).json();

        expect(json.data.suppliers).toEqual([
          { supplier_id: "s1", supplier_name: "Timber Co" },
        ]);
      });
    });

    describe("projects", () => {
      it("returns the name and the number of lots", async () => {
        mockSearch({
          projects: [
            {
              project_id: "p1",
              name: "Smith House",
              lots: [{ lot_id: "a" }, { lot_id: "b" }],
            },
            { project_id: "p2", name: "Empty", lots: [] },
          ],
        });

        const json = await (await post()).json();

        expect(json.data.projects).toEqual([
          { project_id: "p1", project_name: "Smith House", number_of_lots: 2 },
          { project_id: "p2", project_name: "Empty", number_of_lots: 0 },
        ]);
      });
    });

    describe("items", () => {
      it("matches the unit, description and every category's detail fields", async () => {
        await post();

        expect(where("item").OR).toEqual([
          { measurement_unit: contains("oak") },
          { description: contains("oak") },
          {
            sheet: {
              OR: [
                { brand: contains("oak") },
                { color: contains("oak") },
                { finish: contains("oak") },
              ],
            },
          },
          {
            handle: {
              OR: [
                { brand: contains("oak") },
                { color: contains("oak") },
                { type: contains("oak") },
              ],
            },
          },
          {
            hardware: {
              OR: [
                { brand: contains("oak") },
                { name: contains("oak") },
                { type: contains("oak") },
                { sub_category: contains("oak") },
              ],
            },
          },
          { accessory: { name: contains("oak") } },
          {
            edging_tape: {
              OR: [
                { brand: contains("oak") },
                { color: contains("oak") },
                { finish: contains("oak") },
              ],
            },
          },
        ]);
      });

      it.each([
        ["SHEET", "sheet"],
        ["handle", "handle"],
        ["Hardware", "hardware"],
        ["ACCESSORY", "accessory"],
        ["edging_tape", "edging_tape"],
      ])(
        "also matches the %s category when the term is its name",
        async (term) => {
          await post({ search: term });

          const clauses = where("item").OR;
          expect(clauses).toHaveLength(8);
          expect(clauses[7]).toEqual({ category: term.toUpperCase() });
        },
      );

      it.each(["sheets", "edging tape", "she", "other"])(
        "does not add a category match for %j",
        async (term) => {
          await post({ search: term });

          expect(where("item").OR).toHaveLength(7);
        },
      );

      it("trims the term before comparing it with category names", async () => {
        await post({ search: "  sheet " });

        expect(where("item").OR[7]).toEqual({ category: "SHEET" });
      });

      it("selects only the fields it returns", async () => {
        await post();

        const { select } = prismaMock.item.findMany.mock.calls[0][0];
        expect(Object.keys(select).sort()).toEqual(
          [
            "accessory",
            "category",
            "edging_tape",
            "handle",
            "hardware",
            "image",
            "item_id",
            "measurement_unit",
            "quantity",
            "sheet",
          ].sort(),
        );
      });

      it("flattens a sheet", async () => {
        mockSearch({
          items: [
            item({
              image: { url: "/img/s.jpg" },
              sheet: { brand: "Polytec", color: "White", finish: "Matte" },
            }),
          ],
        });

        const [row] = (await (await post()).json()).data.items;

        expect(row).toEqual({
          item_id: "ITEM-1",
          category: "SHEET",
          image: "/img/s.jpg",
          quantity: 12,
          measurement_unit: "SHEET",
          brand: "Polytec",
          color: "White",
          finish: "Matte",
          type: null,
          name: null,
          sub_category: null,
        });
      });

      it("flattens a handle", async () => {
        mockSearch({
          items: [
            item({
              category: "HANDLE",
              handle: { brand: "Hafele", color: "Black", type: "Bar" },
            }),
          ],
        });

        const [row] = (await (await post()).json()).data.items;

        expect(row).toMatchObject({
          brand: "Hafele",
          color: "Black",
          type: "Bar",
          finish: null,
          name: null,
        });
      });

      it("flattens hardware", async () => {
        mockSearch({
          items: [
            item({
              category: "HARDWARE",
              hardware: {
                brand: "Blum",
                type: "Soft",
                name: "Hinge",
                sub_category: "Doors",
              },
            }),
          ],
        });

        const [row] = (await (await post()).json()).data.items;

        expect(row).toMatchObject({
          brand: "Blum",
          type: "Soft",
          name: "Hinge",
          sub_category: "Doors",
          color: null,
          finish: null,
        });
      });

      it("flattens an accessory", async () => {
        mockSearch({
          items: [item({ category: "ACCESSORY", accessory: { name: "Bin" } })],
        });

        const [row] = (await (await post()).json()).data.items;

        expect(row).toMatchObject({ name: "Bin", brand: null, color: null });
      });

      it("flattens edging tape", async () => {
        mockSearch({
          items: [
            item({
              category: "EDGING_TAPE",
              edging_tape: { brand: "Rehau", color: "Oak", finish: "Gloss" },
            }),
          ],
        });

        const [row] = (await (await post()).json()).data.items;

        expect(row).toMatchObject({
          brand: "Rehau",
          color: "Oak",
          finish: "Gloss",
        });
      });

      it("leaves the detail fields null when no detail record exists", async () => {
        mockSearch({ items: [item()] });

        const [row] = (await (await post()).json()).data.items;

        expect(row).toMatchObject({
          brand: null,
          color: null,
          finish: null,
          type: null,
          name: null,
          sub_category: null,
          image: null,
        });
      });
    });

    // Current behaviour: no is_deleted filter on clients, suppliers, projects
    // or items, so soft-deleted records can show up in results.
    it("does not filter out soft-deleted records", async () => {
      await post();

      for (const model of ["client", "supplier", "project", "item"]) {
        expect(JSON.stringify(where(model))).not.toContain("is_deleted");
      }
    });

    describe("failures", () => {
      it.each(SEARCH_MODELS)(
        "returns 500 when the %s query fails",
        async (model) => {
          prismaMock[model].findMany.mockRejectedValue(new Error("DB down"));

          const res = await post();

          expect(res.status).toBe(500);
          expect(await res.json()).toEqual({
            status: false,
            message: "Internal server error",
          });
        },
      );

      it("returns 500 for a malformed JSON body", async () => {
        const res = await POST(
          buildRequest(URL, {
            method: "POST",
            rawBody: "{not json",
            headers: { "content-type": "application/json" },
          }),
        );

        expect(res.status).toBe(500);
        expect(prismaMock.client.findMany).not.toHaveBeenCalled();
      });
    });
  });
});
