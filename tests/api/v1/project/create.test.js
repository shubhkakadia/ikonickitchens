// Tests for src/app/api/v1/project/create/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { POST } = await import("@/app/api/v1/project/create/route");

const URL = "/api/v1/project/create";
const validBody = (overrides = {}) => ({
  name: "Smith House",
  client_id: "client-1",
  ...overrides,
});
const post = (body = validBody(), options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

function mockCreate({ slug = "btto", existingIds = [], missing = false } = {}) {
  prismaMock.client.findFirst.mockResolvedValue(
    missing ? null : { client_id: "client-1", client_slug: slug },
  );
  prismaMock.project.findMany.mockResolvedValue(
    existingIds.map((project_id) => ({ project_id })),
  );
  prismaMock.project.create.mockImplementation(async ({ data }) => ({
    id: "p-uuid",
    ...data,
  }));
  prismaMock.lot.create.mockImplementation(async ({ data }) => ({ ...data }));
  prismaMock.logs.create.mockResolvedValue({});
}

const projectData = () => prismaMock.project.create.mock.calls[0][0].data;

describe("POST /api/v1/project/create", () => {
  describeAuthorization((options) => post(undefined, options), {
    modules: ["add_projects", "client_details"],
    setup: () => mockCreate(),
    untouched: () => [prismaMock.project.create, prismaMock.$transaction],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockCreate();
    });

    describe("with a client", () => {
      it("generates the project id from the client slug, creates the project and logs", async () => {
        const res = await post();

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json).toEqual({
          status: true,
          message: "Project created successfully",
          data: {
            id: "p-uuid",
            name: "Smith House",
            project_id: "ikc-btto-0001",
            client_id: "client-1",
            sync_all_lots: false,
            lots: [],
          },
        });
        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: {
            user_id: "user-1",
            entity_type: "project",
            entity_id: "ikc-btto-0001",
            action: "CREATE",
            description: "Project created successfully: Smith House",
          },
        });
      });

      it("runs in a serializable transaction", async () => {
        await post();

        expect(prismaMock.$transaction).toHaveBeenCalledWith(
          expect.any(Function),
          { isolationLevel: "Serializable" },
        );
      });

      it("normalises the client id (trim, lowercase) for the lookup and the project", async () => {
        await post(validBody({ client_id: "  CLIENT-1 " }));

        expect(prismaMock.client.findFirst).toHaveBeenCalledWith({
          where: { client_id: "client-1", is_deleted: false },
          select: { client_id: true, client_slug: true },
        });
        expect(projectData().client_id).toBe("client-1");
      });

      it("continues after the client's highest existing sequence", async () => {
        mockCreate({ existingIds: ["ikc-btto-0001", "IKC-BTTO-0004"] });

        await post();

        expect(prismaMock.project.findMany).toHaveBeenCalledWith({
          where: { project_id: { startsWith: "IKC-btto-" } },
          select: { project_id: true },
        });
        expect(projectData().project_id).toBe("ikc-btto-0005");
      });

      it("ignores a project_id sent by the caller", async () => {
        await post(validBody({ project_id: "my-own-id" }));

        expect(projectData().project_id).toBe("ikc-btto-0001");
      });

      it("returns 404 when the client does not exist", async () => {
        mockCreate({ missing: true });

        const res = await post(validBody({ client_id: " Missing " }));

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
          status: false,
          message: "Client not found with client id:  Missing ",
        });
        expect(prismaMock.project.create).not.toHaveBeenCalled();
      });

      it("returns 409 when the sequence limit is reached", async () => {
        mockCreate({ existingIds: ["IKC-BTTO-9999"] });

        const res = await post();

        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
          status: false,
          message: "Project ID sequence limit reached for this client",
        });
        expect(prismaMock.project.create).not.toHaveBeenCalled();
      });

      it.each([
        ["too short", "ab"],
        ["contains digits", "ab12"],
        ["empty", ""],
      ])("returns 409 when the client slug is %s", async (_, slug) => {
        mockCreate({ slug });

        const res = await post();

        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Client slug must be exactly 4 letters before creating a project",
        });
        expect(prismaMock.project.create).not.toHaveBeenCalled();
      });
    });

    describe("without a client", () => {
      it("uses the supplied project_id, lowercased, with no client", async () => {
        await post({ name: "Standalone", project_id: "ABC-123" });

        expect(prismaMock.client.findFirst).not.toHaveBeenCalled();
        expect(projectData()).toEqual({
          name: "Standalone",
          project_id: "abc-123",
          client_id: null,
          sync_all_lots: false,
        });
      });

      it.each([
        [true, true],
        [false, false],
        ["true", false],
        [1, false],
        [undefined, false],
      ])("stores sync_all_lots %j as %j", async (input, stored) => {
        await post(validBody({ sync_all_lots: input }));

        expect(projectData().sync_all_lots).toBe(stored);
      });

      it.each([
        ["missing", undefined],
        ["empty", ""],
        ["blank", "   "],
        ["null", null],
      ])("treats a %s client_id as no client", async (_, client_id) => {
        await post({ name: "Standalone", project_id: "p-1", client_id });

        expect(projectData().client_id).toBeNull();
      });

      it("returns 400 when there is no client and no project_id", async () => {
        const res = await post({ name: "Orphan" });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Project ID is required when no client is selected",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });
    });

    describe("lots", () => {
      it("creates the lots under the new project with defaults", async () => {
        const res = await post(
          validBody({
            startDate: "2026-03-02",
            lots: [
              {
                lotId: "BTTO-001-L1",
                clientName: "Kitchen",
                installationDueDate: "2026-04-01",
                notes: "Island",
              },
              { lotId: "BTTO-001-L2", clientName: "Laundry" },
            ],
          }),
        );

        expect(res.status).toBe(201);
        const calls = prismaMock.lot.create.mock.calls.map(([a]) => a.data);
        expect(calls).toEqual([
          {
            lot_id: "btto-001-l1",
            name: "Kitchen",
            project_id: "ikc-btto-0001",
            startDate: new Date("2026-03-02"),
            installationDueDate: new Date("2026-04-01"),
            notes: "Island",
            status: "ACTIVE",
          },
          {
            lot_id: "btto-001-l2",
            name: "Laundry",
            project_id: "ikc-btto-0001",
            startDate: new Date("2026-03-02"),
            installationDueDate: null,
            notes: null,
            status: "ACTIVE",
          },
        ]);
        expect((await res.json()).data.lots).toHaveLength(2);
      });

      it("leaves startDate null when it is not sent", async () => {
        await post(validBody({ lots: [{ lotId: "L1", clientName: "A" }] }));

        expect(
          prismaMock.lot.create.mock.calls[0][0].data.startDate,
        ).toBeNull();
      });

      it("logs the project and then each lot", async () => {
        await post(
          validBody({
            lots: [
              { lotId: "L1", clientName: "Kitchen" },
              { lotId: "L2", clientName: "Laundry" },
            ],
          }),
        );

        const logs = prismaMock.logs.create.mock.calls.map(([a]) => a.data);
        expect(logs.map((l) => [l.entity_type, l.entity_id, l.action])).toEqual(
          [
            ["project", "ikc-btto-0001", "CREATE"],
            ["lot", "l1", "CREATE"],
            ["lot", "l2", "CREATE"],
          ],
        );
        expect(logs[1].description).toBe(
          "Lot created successfully: Kitchen for project: Smith House",
        );
      });

      it("creates no lots for an empty or non-array lots value", async () => {
        await post(validBody({ lots: [] }));
        await post(validBody({ lots: "nope" }));

        expect(prismaMock.lot.create).not.toHaveBeenCalled();
      });

      it.each([
        ["lotId", { clientName: "Kitchen" }],
        ["clientName", { lotId: "L1" }],
      ])("returns 400 when a lot has no %s", async (_, lot) => {
        const res = await post(
          validBody({ lots: [{ lotId: "ok", clientName: "ok" }, lot] }),
        );

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Lot ID and Client Name are required for all lots",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });
    });

    describe("failures", () => {
      it("returns 201 with a warning when the project log cannot be written", async () => {
        prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

        const res = await post();

        expect(res.status).toBe(201);
        expect((await res.json()).warning).toBe(
          "Note: Creation succeeded but logging failed",
        );
      });

      it.each(["P2002", "P2034"])(
        "returns 409 on Prisma error %s (concurrent id generation)",
        async (code) => {
          prismaMock.project.create.mockRejectedValue(
            Object.assign(new Error("conflict"), { code }),
          );

          const res = await post();

          expect(res.status).toBe(409);
          expect(await res.json()).toEqual({
            status: false,
            message:
              "A project ID was generated concurrently. Please try again.",
          });
        },
      );

      it("returns 500 with the error message for other failures", async () => {
        prismaMock.project.create.mockRejectedValue(new Error("DB down"));

        const res = await post();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
          error: "DB down",
        });
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      it("returns 500 when a lot fails to create", async () => {
        prismaMock.lot.create.mockRejectedValue(new Error("DB down"));

        const res = await post(
          validBody({ lots: [{ lotId: "L1", clientName: "A" }] }),
        );

        expect(res.status).toBe(500);
        expect(prismaMock.logs.create).not.toHaveBeenCalled();
      });

      // Current behaviour: client_id.trim() throws for non-strings.
      it("returns 500 when client_id is not a string", async () => {
        const res = await post(validBody({ client_id: 123 }));

        expect(res.status).toBe(500);
        expect(prismaMock.project.create).not.toHaveBeenCalled();
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
        expect(prismaMock.project.create).not.toHaveBeenCalled();
      });
    });
  });
});
