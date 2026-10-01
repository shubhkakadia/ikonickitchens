import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET, DELETE } = await import("@/app/api/v1/deletedmedia/all/route");

const URL = "/api/v1/deletedmedia/all";
const TABLES = ["lot_file", "media", "supplier_file"];

describe("GET /api/v1/deletedmedia/all", () => {
  const get = (options) => GET(buildRequest(URL, options));

  function mockEmpty() {
    for (const t of TABLES) prismaMock[t].findMany.mockResolvedValue([]);
  }

  describeAuthorization(get, {
    modules: "delete_media",
    setup: mockEmpty,
    untouched: () => TABLES.map((t) => prismaMock[t].findMany),
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockEmpty();
    });

    it("returns soft-deleted lot files, media and supplier files in one list", async () => {
      const lotFile = {
        id: "lf1",
        filename: "a.pdf",
        tab: { lot: { lot_id: "L1" } },
      };
      const media = { id: "m1", filename: "b.jpg" };
      const supplierFile = { id: "sf1", filename: "c.pdf" };
      prismaMock.lot_file.findMany.mockResolvedValue([lotFile]);
      prismaMock.media.findMany.mockResolvedValue([media]);
      prismaMock.supplier_file.findMany.mockResolvedValue([supplierFile]);

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Deleted media fetched successfully",
        data: [lotFile, media, supplierFile],
      });
    });

    it("queries only soft-deleted rows, including the lot for lot files", async () => {
      await get();

      expect(prismaMock.lot_file.findMany).toHaveBeenCalledWith({
        where: { is_deleted: true },
        include: { tab: { include: { lot: true } } },
      });
      expect(prismaMock.media.findMany).toHaveBeenCalledWith({
        where: { is_deleted: true },
      });
      expect(prismaMock.supplier_file.findMany).toHaveBeenCalledWith({
        where: { is_deleted: true },
      });
    });

    it("returns an empty list when nothing is deleted", async () => {
      const res = await get();

      expect((await res.json()).data).toEqual([]);
    });

    it.each(TABLES)("returns 500 when the %s query fails", async (table) => {
      prismaMock[table].findMany.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});

describe("DELETE /api/v1/deletedmedia/all (batch)", () => {
  const del = (body = { filenames: ["a.pdf"] }, options = {}) =>
    DELETE(buildRequest(URL, { method: "DELETE", body, ...options }));

  // name -> { table, rec } for files that exist as soft-deleted rows
  let stored;
  let unlink;

  const rec = (id, filename) => ({
    id,
    filename,
    url: `mediauploads/${filename}`,
    is_deleted: true,
  });

  function store(table, id, filename) {
    stored[filename] = { table, rec: rec(id, filename) };
  }

  beforeEach(() => {
    stored = {};
    unlink = vi.spyOn(fs.promises, "unlink").mockResolvedValue(undefined);
    for (const t of TABLES) {
      prismaMock[t].findFirst.mockImplementation(async ({ where }) => {
        const hit = stored[where.filename];
        return hit && hit.table === t ? hit.rec : null;
      });
      prismaMock[t].delete.mockImplementation(async ({ where }) => ({
        id: where.id,
      }));
    }
    prismaMock.logs.create.mockResolvedValue({});
    store("lot_file", "lf1", "a.pdf");
  });

  describeAuthorization((options) => del(undefined, options), {
    modules: "delete_media",
    untouched: () => [unlink, ...TABLES.map((t) => prismaMock[t].delete)],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      store("media", "m1", "b.jpg");
      store("supplier_file", "sf1", "c.pdf");
    });

    it("deletes files from each table and reports every success", async () => {
      const res = await del({ filenames: ["a.pdf", "b.jpg", "c.pdf"] });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Successfully deleted 3 file(s)",
        data: {
          successful: [
            { success: true, filename: "a.pdf", fileDeletedFromDisk: true },
            { success: true, filename: "b.jpg", fileDeletedFromDisk: true },
            { success: true, filename: "c.pdf", fileDeletedFromDisk: true },
          ],
          failed: [],
          total: 3,
          successfulCount: 3,
          failedCount: 0,
        },
      });
      expect(prismaMock.lot_file.delete).toHaveBeenCalledWith({
        where: { id: "lf1" },
      });
      expect(prismaMock.media.delete).toHaveBeenCalledWith({
        where: { id: "m1" },
      });
      expect(prismaMock.supplier_file.delete).toHaveBeenCalledWith({
        where: { id: "sf1" },
      });
      for (const name of ["a.pdf", "b.jpg", "c.pdf"]) {
        expect(unlink).toHaveBeenCalledWith(
          path.join(process.cwd(), `mediauploads/${name}`),
        );
      }
    });

    it("writes one log per deleted file with the right entity type", async () => {
      await del({ filenames: ["a.pdf", "b.jpg", "c.pdf"] });

      expect(prismaMock.logs.create).toHaveBeenCalledTimes(3);
      const entries = prismaMock.logs.create.mock.calls.map(([{ data }]) => [
        data.entity_type,
        data.entity_id,
        data.action,
        data.description,
      ]);
      expect(entries).toEqual(
        expect.arrayContaining([
          ["lot_file", "lf1", "DELETE", "lot_file deleted successfully: a.pdf"],
          ["media", "m1", "DELETE", "media deleted successfully: b.jpg"],
          [
            "supplier_file",
            "sf1",
            "DELETE",
            "supplier_file deleted successfully: c.pdf",
          ],
        ]),
      );
    });

    it("reports a mix of successes and failures with status 200", async () => {
      const res = await del({ filenames: ["a.pdf", "missing.pdf"] });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Deleted 1 file(s), 1 failed",
        data: {
          successful: [
            { success: true, filename: "a.pdf", fileDeletedFromDisk: true },
          ],
          failed: [
            {
              success: false,
              filename: "missing.pdf",
              error: "Deleted media not found",
            },
          ],
          total: 2,
          successfulCount: 1,
          failedCount: 1,
        },
      });
    });

    // Current behaviour (bug): the status-code logic is inverted. The comment
    // says 207 is for partial success, but partial success returns 200 and a
    // total failure returns 207.
    it("returns 207 with status false when every file fails", async () => {
      const res = await del({ filenames: ["missing-1.pdf", "missing-2.pdf"] });

      expect(res.status).toBe(207);
      const json = await res.json();
      expect(json.status).toBe(false);
      expect(json.message).toBe("Deleted 0 file(s), 2 failed");
      expect(json.data.failedCount).toBe(2);
      expect(unlink).not.toHaveBeenCalled();
    });

    it("URL-decodes each filename", async () => {
      store("media", "m2", "my kitchen.jpg");

      const res = await del({ filenames: ["my%20kitchen.jpg"] });

      expect((await res.json()).data.successful[0].filename).toBe(
        "my kitchen.jpg",
      );
      expect(prismaMock.media.delete).toHaveBeenCalledWith({
        where: { id: "m2" },
      });
    });

    it("fails only the badly encoded filename and continues with the rest", async () => {
      const res = await del({ filenames: ["100%.jpg", "a.pdf"] });

      const { data } = await res.json();
      expect(data.successfulCount).toBe(1);
      expect(data.failed).toEqual([
        { success: false, filename: "100%.jpg", error: "URI malformed" },
      ]);
    });

    it("marks a file successful but not removed from disk when unlink fails", async () => {
      unlink.mockRejectedValue(new Error("ENOENT"));

      const res = await del({ filenames: ["a.pdf"] });

      expect(res.status).toBe(200);
      expect((await res.json()).data.successful).toEqual([
        { success: true, filename: "a.pdf", fileDeletedFromDisk: false },
      ]);
      expect(prismaMock.lot_file.delete).toHaveBeenCalled();
    });

    it("fails a file whose row delete throws, without affecting the others", async () => {
      prismaMock.media.delete.mockRejectedValue(new Error("DB down"));

      const res = await del({ filenames: ["a.pdf", "b.jpg"] });

      const { data } = await res.json();
      expect(data.successful.map((r) => r.filename)).toEqual(["a.pdf"]);
      expect(data.failed).toEqual([
        { success: false, filename: "b.jpg", error: "DB down" },
      ]);
    });

    it("adds a warning to a file whose log cannot be written", async () => {
      prismaMock.logs.create.mockRejectedValue(new Error("log table down"));

      const res = await del({ filenames: ["a.pdf"] });

      expect(res.status).toBe(200);
      expect((await res.json()).data.successful[0]).toEqual({
        success: true,
        filename: "a.pdf",
        fileDeletedFromDisk: true,
        warning: "Note: Deletion succeeded but logging failed",
      });
    });

    // Current behaviour: files are processed in parallel, so a repeated
    // filename is looked up twice and deleted twice. Against a real database
    // the second delete would fail.
    it("processes a duplicated filename twice", async () => {
      await del({ filenames: ["a.pdf", "a.pdf"] });

      expect(prismaMock.lot_file.delete).toHaveBeenCalledTimes(2);
      expect(unlink).toHaveBeenCalledTimes(2);
    });

    it("does not restrict the unlink path to the upload directories", async () => {
      stored["evil.txt"] = {
        table: "media",
        rec: { id: "m9", filename: "evil.txt", url: "../../outside/evil.txt" },
      };

      await del({ filenames: ["evil.txt"] });

      expect(unlink.mock.calls[0][0].startsWith(process.cwd())).toBe(false);
    });

    it.each([
      ["missing", {}],
      ["empty", { filenames: [] }],
      ["not an array", { filenames: "a.pdf" }],
      ["null", { filenames: null }],
    ])("returns 400 when filenames is %s", async (_, body) => {
      const res = await del(body);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: false,
        message: "Filenames array is required",
      });
      expect(prismaMock.lot_file.findFirst).not.toHaveBeenCalled();
    });

    it("returns 500 for a malformed JSON body", async () => {
      const res = await DELETE(
        buildRequest(URL, {
          method: "DELETE",
          rawBody: "{not json",
          headers: { "content-type": "application/json" },
        }),
      );

      expect(res.status).toBe(500);
      expect(unlink).not.toHaveBeenCalled();
    });
  });
});
