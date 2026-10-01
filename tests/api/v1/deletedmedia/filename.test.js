// Tests for src/app/api/v1/deletedmedia/[filename]/route.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { DELETE } = await import("@/app/api/v1/deletedmedia/[filename]/route");

const FILENAME = "kitchen.jpg";
const del = (filename = FILENAME, options = {}) =>
  DELETE(
    buildRequest(`/api/v1/deletedmedia/${encodeURIComponent(filename ?? "")}`, {
      method: "DELETE",
      ...options,
    }),
    routeContext({ filename }),
  );

const record = (overrides = {}) => ({
  id: "file-1",
  filename: FILENAME,
  url: "mediauploads/lots/LOT-1/kitchen.jpg",
  is_deleted: true,
  ...overrides,
});

const TABLES = ["lot_file", "media", "supplier_file"];

// Place the record in one table; the others return nothing.
function mockFoundIn(table, rec = record()) {
  for (const t of TABLES) {
    prismaMock[t].findFirst.mockResolvedValue(t === table ? rec : null);
    prismaMock[t].delete.mockResolvedValue(rec);
  }
}

let unlink;

describe("DELETE /api/v1/deletedmedia/[filename]", () => {
  beforeEach(() => {
    unlink = vi.spyOn(fs.promises, "unlink").mockResolvedValue(undefined);
    prismaMock.logs.create.mockResolvedValue({});
  });

  describeAuthorization((options) => del(FILENAME, options), {
    modules: "delete_media",
    setup: () => mockFoundIn("lot_file"),
    untouched: () => [unlink, prismaMock.lot_file.delete],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    describe.each(TABLES)("when the file is a deleted %s", (table) => {
      beforeEach(() => mockFoundIn(table));

      it("removes the file from disk, deletes the row and logs it", async () => {
        const res = await del();

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "Media permanently deleted",
          filename: FILENAME,
          fileDeletedFromDisk: true,
        });
        expect(unlink).toHaveBeenCalledWith(
          path.join(process.cwd(), "mediauploads/lots/LOT-1/kitchen.jpg"),
        );
        expect(prismaMock[table].delete).toHaveBeenCalledWith({
          where: { id: "file-1" },
        });
        for (const other of TABLES.filter((t) => t !== table)) {
          expect(prismaMock[other].delete).not.toHaveBeenCalled();
        }
        expect(prismaMock.logs.create).toHaveBeenCalledWith({
          data: {
            user_id: "user-1",
            entity_type: table,
            entity_id: "file-1",
            action: "DELETE",
            description: `${table} deleted successfully: ${FILENAME}`,
          },
        });
      });
    });

    it("only matches records that are already soft deleted", async () => {
      mockFoundIn("supplier_file");

      await del();

      for (const t of TABLES) {
        expect(prismaMock[t].findFirst).toHaveBeenCalledWith({
          where: { filename: FILENAME, is_deleted: true },
        });
      }
    });

    it("searches lot_file, then media, then supplier_file, stopping at the first match", async () => {
      mockFoundIn("lot_file");

      await del();

      expect(prismaMock.lot_file.findFirst).toHaveBeenCalled();
      expect(prismaMock.media.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.supplier_file.findFirst).not.toHaveBeenCalled();
    });

    it("prefers lot_file when the same filename is deleted in several tables", async () => {
      for (const t of TABLES) {
        prismaMock[t].findFirst.mockResolvedValue(record({ id: `${t}-id` }));
      }

      await del();

      expect(prismaMock.lot_file.delete).toHaveBeenCalledWith({
        where: { id: "lot_file-id" },
      });
      expect(prismaMock.media.delete).not.toHaveBeenCalled();
    });

    it("URL-decodes the filename before looking it up", async () => {
      mockFoundIn("media", record({ filename: "my kitchen.jpg" }));

      await DELETE(
        buildRequest("/api/v1/deletedmedia/x", { method: "DELETE" }),
        routeContext({ filename: "my%20kitchen.jpg" }),
      );

      expect(prismaMock.lot_file.findFirst).toHaveBeenCalledWith({
        where: { filename: "my kitchen.jpg", is_deleted: true },
      });
    });

    it("returns 404 when no deleted record has that filename", async () => {
      for (const t of TABLES) prismaMock[t].findFirst.mockResolvedValue(null);

      const res = await del();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: false,
        message: "Deleted media not found",
      });
      expect(unlink).not.toHaveBeenCalled();
      for (const t of TABLES)
        expect(prismaMock[t].delete).not.toHaveBeenCalled();
    });

    it("returns 400 when the filename is empty", async () => {
      const res = await del("");

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Filename is required",
      });
      expect(prismaMock.lot_file.findFirst).not.toHaveBeenCalled();
    });

    it("still deletes the row when the file is already missing from disk", async () => {
      mockFoundIn("lot_file");
      unlink.mockRejectedValue(
        Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }),
      );

      const res = await del();

      expect(res.status).toBe(200);
      expect((await res.json()).fileDeletedFromDisk).toBe(false);
      expect(prismaMock.lot_file.delete).toHaveBeenCalled();
    });

    it("removes the file from disk before deleting the row", async () => {
      mockFoundIn("lot_file");
      const order = [];
      unlink.mockImplementation(async () => order.push("unlink"));
      prismaMock.lot_file.delete.mockImplementation(async () => {
        order.push("db");
        return record();
      });

      await del();

      expect(order).toEqual(["unlink", "db"]);
    });

    // Current behaviour (risk): the stored url is joined onto the project
    // root with no check that it stays inside the upload folders.
    it("does not restrict the unlink path to the upload directories", async () => {
      mockFoundIn("media", record({ url: "../../outside/secret.txt" }));

      await del();

      const target = unlink.mock.calls[0][0];
      expect(target).toBe(path.join(process.cwd(), "../../outside/secret.txt"));
      expect(target.startsWith(process.cwd())).toBe(false);
    });

    // Current behaviour: the file is gone from disk but the row survives,
    // leaving a record that points at a missing file.
    it("returns 500 after removing the file when the row delete fails", async () => {
      mockFoundIn("lot_file");
      prismaMock.lot_file.delete.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
      expect(unlink).toHaveBeenCalled();
      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    it("returns 200 with a warning when the log cannot be written", async () => {
      mockFoundIn("lot_file");
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del();

      expect(res.status).toBe(200);
      expect((await res.json()).warning).toBe(
        "Note: Deletion succeeded but logging failed",
      );
    });

    it("returns 500 when the lookup fails", async () => {
      prismaMock.lot_file.findFirst.mockRejectedValue(new Error("DB down"));

      const res = await del();

      expect(res.status).toBe(500);
      expect(unlink).not.toHaveBeenCalled();
    });

    // Current behaviour: decodeURIComponent throws on a stray "%".
    it("returns 500 for a filename that is not valid URL encoding", async () => {
      const res = await DELETE(
        buildRequest("/api/v1/deletedmedia/x", { method: "DELETE" }),
        routeContext({ filename: "100%.jpg" }),
      );

      expect(res.status).toBe(500);
      expect(prismaMock.lot_file.findFirst).not.toHaveBeenCalled();
    });
  });
});
