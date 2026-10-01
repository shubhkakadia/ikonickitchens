// Tests for src/app/api/v1/lot_file/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthorizedUser, mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { PATCH } = await import("@/app/api/v1/lot_file/[id]/route");

const ID = "lot-file-1";
const URL = `/api/v1/lot_file/${ID}`;
const ctx = () => routeContext({ id: ID });

const storedLotFile = (overrides = {}) => ({
  id: ID,
  tab_id: "tab-1",
  filename: "photo.jpg",
  notes: "Old note",
  ...overrides,
});

describe("PATCH /api/v1/lot_file/[id]", () => {
  const patch = (body = { notes: "New note" }, options = {}) =>
    PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());

  function mockUpdate() {
    prismaMock.lot_file.update.mockImplementation(async ({ data }) =>
      storedLotFile(data),
    );
    prismaMock.logs.create.mockResolvedValue({});
  }

  describeAuthorization((options) => patch(undefined, options), {
    roles: ["master-admin", "admin", "manager", "employee"],
    modules: ["project_details", "site_photos"],
    setup: mockUpdate,
    untouched: () => [prismaMock.lot_file.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    it("updates the notes and logs the update", async () => {
      const res = await patch({ notes: "Cabinet door scratched" });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: true,
        message: "Lot file updated successfully",
        data: storedLotFile({ notes: "Cabinet door scratched" }),
      });
      expect(json.warning).toBeUndefined();
      expect(prismaMock.lot_file.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { notes: "Cabinet door scratched" },
      });
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "lot_file",
          entity_id: ID,
          action: "UPDATE",
          description: "Lot file updated successfully: Cabinet door scratched",
        },
      });
    });

    it("ignores fields other than notes", async () => {
      await patch({ notes: "Hi", filename: "evil.jpg", id: "other-id" });

      expect(prismaMock.lot_file.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { notes: "Hi" },
      });
    });

    it("allows clearing the notes with an empty string", async () => {
      const res = await patch({ notes: "" });

      expect(res.status).toBe(200);
      expect(prismaMock.lot_file.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { notes: "" },
      });
    });

    it("allows clearing the notes with null", async () => {
      const res = await patch({ notes: null });

      expect(res.status).toBe(200);
      expect(prismaMock.lot_file.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { notes: null },
      });
    });

    // Current behaviour: there is no validation; an omitted notes field is
    // passed to Prisma as undefined, which updates nothing.
    it("calls update with undefined notes when the body is empty", async () => {
      const res = await patch({});

      expect(res.status).toBe(200);
      expect(prismaMock.lot_file.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { notes: undefined },
      });
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await patch();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Lot file updated successfully",
        data: storedLotFile({ notes: "New note" }),
        warning: "Note: Update succeeded but logging failed",
      });
    });

    it("returns 500 when the update fails", async () => {
      prismaMock.lot_file.update.mockRejectedValue(
        Object.assign(new Error("Record to update not found."), {
          code: "P2025",
        }),
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
      expect(prismaMock.lot_file.update).not.toHaveBeenCalled();
    });
  });

  describe("employee access (installer-only)", () => {
    const asEmployee = () =>
      mockAuthorizedUser({
        userType: "employee",
        modules: ["site_photos"],
        employeeId: "EMP-7",
      });
    const lotFileWithInstaller = (installer_id) => ({
      tab: { lot: { installer_id } },
    });

    beforeEach(mockUpdate);

    it("lets an employee edit a file on a lot where they are the installer", async () => {
      asEmployee();
      prismaMock.lot_file.findUnique.mockResolvedValue(
        lotFileWithInstaller("EMP-7"),
      );

      const res = await patch();

      expect(res.status).toBe(200);
      expect(prismaMock.lot_file.findUnique).toHaveBeenCalledWith({
        where: { id: ID },
        select: {
          tab: { select: { lot: { select: { installer_id: true } } } },
        },
      });
      expect(prismaMock.lot_file.update).toHaveBeenCalledOnce();
    });

    it.each([
      ["another employee is the installer", lotFileWithInstaller("EMP-9")],
      ["the lot has no installer", lotFileWithInstaller(null)],
      ["the lot file does not exist", null],
    ])("returns 404 for an employee when %s", async (_, found) => {
      asEmployee();
      prismaMock.lot_file.findUnique.mockResolvedValue(found);

      const res = await patch();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Lot file not found",
      });
      expect(prismaMock.lot_file.update).not.toHaveBeenCalled();
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 404 for an employee without an employee record", async () => {
      mockAuthorizedUser({
        userType: "employee",
        modules: ["site_photos"],
        employeeId: null,
      });
      prismaMock.lot_file.findUnique.mockResolvedValue(
        lotFileWithInstaller(null),
      );

      const res = await patch();

      expect(res.status).toBe(404);
      expect(prismaMock.lot_file.update).not.toHaveBeenCalled();
    });

    it.each(["admin", "manager"])(
      "does not look up the installer for a %s",
      async (userType) => {
        mockAuthorizedUser({ userType, modules: ["project_details"] });

        const res = await patch();

        expect(res.status).toBe(200);
        expect(prismaMock.lot_file.findUnique).not.toHaveBeenCalled();
      },
    );

    it("returns 500 when the installer lookup fails", async () => {
      asEmployee();
      prismaMock.lot_file.findUnique.mockRejectedValue(new Error("DB down"));

      const res = await patch();

      expect(res.status).toBe(500);
      expect(prismaMock.lot_file.update).not.toHaveBeenCalled();
    });
  });
});
