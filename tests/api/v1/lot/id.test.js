// Tests for src/app/api/v1/lot/[id]/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin, mockAuthorizedUser } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

// sendNotification sends real WhatsApp messages; never call it in tests.
vi.mock("@/lib/notification", () => ({ sendNotification: vi.fn() }));

const { GET, PATCH, DELETE } = await import("@/app/api/v1/lot/[id]/route");
const { sendNotification } = await import("@/lib/notification");

const ALL_ROLES = ["master-admin", "admin", "manager", "employee"];
const ID = "lot-uuid";
const URL = `/api/v1/lot/${ID}`;
const ctx = () => routeContext({ id: ID });

const storedLot = (overrides = {}) => ({
  id: ID,
  lot_id: "btto-001-l1",
  name: "Kitchen",
  status: "ACTIVE",
  installer_id: null,
  installer: null,
  is_deleted: false,
  project: { project_id: "btto-001", name: "Smith House" },
  ...overrides,
});

describe("GET /api/v1/lot/[id]", () => {
  const get = (options) => GET(buildRequest(URL, options), ctx());

  beforeEach(() => {
    prismaMock.lot.findFirst.mockResolvedValue(
      storedLot({ installer_id: "employee-1" }),
    );
  });

  describeAuthorization(get, {
    roles: ALL_ROLES,
    modules: ["project_details", "site_photos"],
    untouched: () => [prismaMock.lot.findFirst],
  });

  describe("employee access", () => {
    it("lets an employee read a lot they are the installer on", async () => {
      mockAuthorizedUser({
        userType: "employee",
        modules: ["site_photos"],
        employeeId: "EMP-7",
      });
      prismaMock.lot.findFirst.mockResolvedValue(
        storedLot({ installer_id: "EMP-7" }),
      );

      const res = await get();

      expect(res.status).toBe(200);
    });

    it("hides another installer's lot from an employee (404, not 403)", async () => {
      mockAuthorizedUser({
        userType: "employee",
        modules: ["site_photos"],
        employeeId: "EMP-7",
      });
      prismaMock.lot.findFirst.mockResolvedValue(
        storedLot({ installer_id: "EMP-OTHER" }),
      );

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Lot not found",
      });
    });

    it("hides a lot with no installer from an employee", async () => {
      mockAuthorizedUser({
        userType: "employee",
        modules: ["site_photos"],
        employeeId: "EMP-7",
      });
      prismaMock.lot.findFirst.mockResolvedValue(
        storedLot({ installer_id: null }),
      );

      expect((await get()).status).toBe(404);
    });

    it("lets staff read any lot regardless of installer", async () => {
      mockAuthorizedUser({
        userType: "manager",
        modules: ["project_details"],
        employeeId: "EMP-7",
      });
      prismaMock.lot.findFirst.mockResolvedValue(
        storedLot({ installer_id: "EMP-OTHER" }),
      );

      expect((await get()).status).toBe(200);
    });
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("returns the lot with installer, project, stages and files", async () => {
      const lot = storedLot();
      prismaMock.lot.findFirst.mockResolvedValue(lot);

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Lot fetched successfully",
        data: lot,
      });
      const args = prismaMock.lot.findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ id: ID, is_deleted: false });
      expect(Object.keys(args.include)).toEqual([
        "installer",
        "project",
        "stages",
        "tabs",
      ]);
      expect(args.include.tabs.include.files.where).toEqual({
        is_deleted: false,
      });
    });

    it("returns 404 when the lot does not exist or is deleted", async () => {
      prismaMock.lot.findFirst.mockResolvedValue(null);

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Lot not found",
      });
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.lot.findFirst.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});

describe("PATCH /api/v1/lot/[id]", () => {
  const patch = (body, options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());

  // update() returns the lot with the applied data and a matching installer
  function mockPatch(base = storedLot()) {
    prismaMock.lot.update.mockImplementation(async ({ data }) => {
      const merged = { ...base, ...data };
      return {
        ...merged,
        installer: merged.installer_id
          ? {
              employee_id: merged.installer_id,
              first_name: "Ann",
              last_name: "Lee",
            }
          : null,
      };
    });
    prismaMock.employees.findUnique.mockResolvedValue({ employee_id: "EMP-7" });
    prismaMock.logs.create.mockResolvedValue({});
    sendNotification.mockResolvedValue(undefined);
  }

  const updateArgs = () => prismaMock.lot.update.mock.calls[0][0];

  describeAuthorization((options) => patch({ notes: "x" }, options), {
    modules: ["project_details", "lotatglance"],
    setup: () => mockPatch(),
    untouched: () => [prismaMock.lot.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockPatch();
    });

    it("updates the lot and logs it", async () => {
      const res = await patch({ name: "Kitchen & Pantry" });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe(true);
      expect(json.message).toBe("Lot updated successfully");
      expect(json.data.name).toBe("Kitchen & Pantry");
      expect(updateArgs()).toEqual({
        where: { id: ID },
        data: { name: "Kitchen & Pantry" },
        include: {
          project: true,
          installer: {
            select: {
              employee_id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone: true,
              role: true,
            },
          },
        },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "lot",
          entity_id: ID,
          action: "UPDATE",
          description:
            "Lot updated successfully: Kitchen & Pantry for project: Smith House",
        },
      });
    });

    it("only writes the fields that were sent", async () => {
      await patch({ notes: "Call first", installer_notes: "Gate code 1234" });

      expect(updateArgs().data).toEqual({
        notes: "Call first",
        installer_notes: "Gate code 1234",
      });
    });

    it("ignores lot_id, project_id and is_deleted", async () => {
      await patch({
        lot_id: "new",
        project_id: "other",
        is_deleted: true,
        notes: "x",
      });

      expect(updateArgs().data).toEqual({ notes: "x" });
    });

    describe("dates", () => {
      it("parses dates that are sent", async () => {
        await patch({
          startDate: "2026-03-01",
          installationDueDate: "2026-04-15",
        });

        expect(updateArgs().data).toEqual({
          startDate: new Date("2026-03-01"),
          installationDueDate: new Date("2026-04-15"),
        });
      });

      it.each([
        ["empty", ""],
        ["null", null],
      ])("clears a date sent as %s", async (_, value) => {
        await patch({ startDate: value });

        expect(updateArgs().data).toEqual({ startDate: null });
      });

      // Current behaviour: an unparseable date silently clears the column.
      it("clears the date when it cannot be parsed", async () => {
        await patch({ installationDueDate: "soon" });

        expect(updateArgs().data).toEqual({ installationDueDate: null });
      });
    });

    describe("status", () => {
      it.each(["ACTIVE", "COMPLETED", "CANCELLED"])(
        "accepts %s",
        async (status) => {
          await patch({ status });

          expect(updateArgs().data).toEqual({ status });
        },
      );

      it.each(["active", "DONE", ""])("returns 400 for %j", async (status) => {
        const res = await patch({ status });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Invalid status. Must be one of: ACTIVE, COMPLETED, CANCELLED",
        });
        expect(prismaMock.lot.update).not.toHaveBeenCalled();
      });
    });

    describe("installer", () => {
      it("assigns an existing employee as installer", async () => {
        await patch({ installer_id: "EMP-7" });

        expect(prismaMock.employees.findUnique).toHaveBeenCalledWith({
          where: { employee_id: "EMP-7" },
          select: { employee_id: true },
        });
        expect(updateArgs().data).toEqual({ installer_id: "EMP-7" });
      });

      it.each([
        ["null", null],
        ["empty", ""],
      ])(
        "unassigns the installer when installer_id is %s",
        async (_, value) => {
          await patch({ installer_id: value });

          expect(updateArgs().data).toEqual({ installer_id: null });
          expect(prismaMock.employees.findUnique).not.toHaveBeenCalled();
        },
      );

      it("returns 400 for an unknown installer", async () => {
        prismaMock.employees.findUnique.mockResolvedValue(null);

        const res = await patch({ installer_id: "EMP-GHOST" });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Invalid installer selected",
        });
        expect(prismaMock.lot.update).not.toHaveBeenCalled();
      });

      // Current behaviour: the check only confirms the employee row exists,
      // so a deleted or inactive employee can be assigned.
      it("does not check whether the installer is active or deleted", async () => {
        await patch({ installer_id: "EMP-7" });

        const { where } = prismaMock.employees.findUnique.mock.calls[0][0];
        expect(where).toEqual({ employee_id: "EMP-7" });
      });

      it("sends an assign_installer notification when an installer is set", async () => {
        await patch({ installer_id: "EMP-7" });

        expect(sendNotification).toHaveBeenCalledWith(
          {
            type: "assign_installer",
            lot_id: "btto-001-l1",
            installer_name: "Ann Lee",
            project_name: "Smith House",
            url: "https://ikonickitchens.com.au/admin/site_photos",
          },
          "assign_installer",
        );
      });

      it("does not notify when the installer is removed", async () => {
        await patch({ installer_id: null });

        expect(sendNotification).not.toHaveBeenCalled();
      });

      it("does not notify for a lot with no installer", async () => {
        await patch({ notes: "x" });

        expect(sendNotification).not.toHaveBeenCalled();
      });

      // Current behaviour (bug): the notification fires whenever the lot HAS
      // an installer, not when one is newly assigned. Every edit (including
      // drag-and-drop rescheduling in Lot at a Glance) re-sends the
      // "you've been assigned" WhatsApp message.
      it.each([
        ["a date change", { startDate: "2026-03-02" }],
        ["a notes edit", { notes: "x" }],
        ["a status change", { status: "COMPLETED" }],
        ["an empty update", {}],
      ])("re-notifies an already-assigned installer on %s", async (_, body) => {
        mockPatch(storedLot({ installer_id: "EMP-7" }));

        await patch(body);

        expect(sendNotification).toHaveBeenCalledTimes(1);
      });

      it("still returns 200 when the notification fails", async () => {
        sendNotification.mockRejectedValue(new Error("WhatsApp down"));

        const res = await patch({ installer_id: "EMP-7" });

        expect(res.status).toBe(200);
        expect((await res.json()).status).toBe(true);
      });
    });

    // Current behaviour: no existence check, so a missing lot is a 500
    // (Prisma P2025) rather than a 404.
    it("returns 500 when the lot does not exist", async () => {
      prismaMock.lot.update.mockRejectedValue(
        Object.assign(new Error("Record to update not found."), {
          code: "P2025",
        }),
      );

      const res = await patch({ notes: "x" });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(sendNotification).not.toHaveBeenCalled();
    });

    // Current behaviour: soft-deleted lots are not excluded.
    it("updates by id without filtering out deleted lots", async () => {
      await patch({ notes: "x" });

      expect(updateArgs().where).toEqual({ id: ID });
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await patch({ notes: "x" });

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Update succeeded but logging failed",
      );
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
      expect(prismaMock.lot.update).not.toHaveBeenCalled();
    });
  });
});

describe("DELETE /api/v1/lot/[id]", () => {
  const del = (options) =>
    DELETE(buildRequest(URL, { method: "DELETE", ...options }), ctx());

  function mockDelete(existing = storedLot()) {
    prismaMock.lot.findUnique.mockResolvedValue(existing);
    prismaMock.lot.update.mockResolvedValue({ ...existing, is_deleted: true });
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization(del, {
    modules: "project_details",
    setup: () => mockDelete(),
    untouched: () => [prismaMock.lot.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDelete();
    });

    it("soft deletes the lot and logs it with the project name", async () => {
      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Lot deleted successfully",
        data: { ...storedLot(), is_deleted: true },
      });
      expect(prismaMock.lot.findUnique).toHaveBeenCalledWith({
        where: { id: ID },
        include: { project: true },
      });
      expect(prismaMock.lot.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { is_deleted: true },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "lot",
          entity_id: ID,
          action: "DELETE",
          description:
            "Lot deleted successfully: Kitchen for project: Smith House",
        },
      });
    });

    it("never hard deletes the lot", async () => {
      await del();

      expect(prismaMock.lot.delete).not.toHaveBeenCalled();
    });

    it("returns 404 when the lot does not exist", async () => {
      prismaMock.lot.findUnique.mockResolvedValue(null);

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Lot not found",
      });
      expect(prismaMock.lot.update).not.toHaveBeenCalled();
    });

    it("returns 400 when the lot is already deleted", async () => {
      mockDelete(storedLot({ is_deleted: true }));

      const res = await del();

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Lot already deleted",
      });
      expect(prismaMock.lot.update).not.toHaveBeenCalled();
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Lot deleted successfully",
        data: { ...storedLot(), is_deleted: true },
        warning: "Note: Deletion succeeded but logging failed",
      });
    });

    it("returns 500 when the update fails", async () => {
      prismaMock.lot.update.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });
  });
});
