import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/lot/sitemeasurements/route");

const get = (options) =>
  GET(buildRequest("/api/v1/lot/sitemeasurements", options));

// Build a lot whose stages have the given statuses, e.g.
// lot("l1", { "Site Measurements": "DONE" })
const lot = (id, stages = {}) => ({
  id,
  stages: Object.entries(stages).map(([name, status]) => ({ name, status })),
});

async function bucketsFor(...lots) {
  prismaMock.lot.findMany.mockResolvedValue(lots);
  const { data } = await (await get()).json();
  return {
    pending: data.pending.map((l) => l.id),
    done: data.done.map((l) => l.id),
  };
}

const SM = "Site Measurements";
const FDA = "Final Design Approval";
const FAP = "Final Approval for production";

describe("GET /api/v1/lot/sitemeasurements", () => {
  describeAuthorization(get, {
    modules: "site_measurements",
    setup: () => prismaMock.lot.findMany.mockResolvedValue([]),
    untouched: () => [prismaMock.lot.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
    });

    it("returns empty pending and done lists when there are no lots", async () => {
      prismaMock.lot.findMany.mockResolvedValue([]);

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: true,
        message: "Site measurements fetched successfully",
        data: { pending: [], done: [] },
      });
    });

    it("only looks at active, non-deleted lots", async () => {
      prismaMock.lot.findMany.mockResolvedValue([]);

      await get();

      const args = prismaMock.lot.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ status: "ACTIVE", is_deleted: false });
      expect(args.orderBy).toEqual({
        project: { client: { client_name: "asc" } },
      });
    });

    it("returns the full lot objects in each bucket", async () => {
      const pendingLot = { ...lot("l1", { [FDA]: "DONE" }), name: "Kitchen" };
      prismaMock.lot.findMany.mockResolvedValue([pendingLot]);

      const { data } = await (await get()).json();

      expect(data.pending).toEqual([pendingLot]);
    });

    describe("pending: design approved, measurements not finished", () => {
      it.each(["NOT_STARTED", "IN_PROGRESS"])(
        "includes a lot whose site measurement is %s",
        async (status) => {
          const buckets = await bucketsFor(
            lot("l1", { [SM]: status, [FDA]: "DONE" }),
          );

          expect(buckets).toEqual({ pending: ["l1"], done: [] });
        },
      );

      it("treats a missing site-measurements stage as NOT_STARTED", async () => {
        const buckets = await bucketsFor(lot("l1", { [FDA]: "DONE" }));

        expect(buckets.pending).toEqual(["l1"]);
      });

      it.each(["NOT_STARTED", "IN_PROGRESS", "NA"])(
        "excludes a lot whose design approval is %s",
        async (status) => {
          const buckets = await bucketsFor(
            lot("l1", { [SM]: "NOT_STARTED", [FDA]: status }),
          );

          expect(buckets.pending).toEqual([]);
        },
      );

      it("excludes a lot with no design-approval stage", async () => {
        const buckets = await bucketsFor(lot("l1", { [SM]: "NOT_STARTED" }));

        expect(buckets.pending).toEqual([]);
      });

      // Current behaviour: a site-measurement stage marked NA is in neither
      // bucket.
      it("excludes a lot whose site measurement is NA", async () => {
        const buckets = await bucketsFor(
          lot("l1", { [SM]: "NA", [FDA]: "DONE" }),
        );

        expect(buckets).toEqual({ pending: [], done: [] });
      });
    });

    describe("done: measured, not yet approved for production", () => {
      it.each([
        ["NOT_STARTED", "NOT_STARTED"],
        ["IN_PROGRESS", "IN_PROGRESS"],
        ["NA", "NA"],
      ])(
        "includes a lot whose production approval is %s",
        async (_, status) => {
          const buckets = await bucketsFor(
            lot("l1", { [SM]: "DONE", [FAP]: status }),
          );

          expect(buckets).toEqual({ pending: [], done: ["l1"] });
        },
      );

      it("includes a measured lot with no production-approval stage", async () => {
        const buckets = await bucketsFor(lot("l1", { [SM]: "DONE" }));

        expect(buckets.done).toEqual(["l1"]);
      });

      it("excludes a lot already approved for production", async () => {
        const buckets = await bucketsFor(
          lot("l1", { [SM]: "DONE", [FAP]: "DONE" }),
        );

        expect(buckets).toEqual({ pending: [], done: [] });
      });

      it("does not require design approval", async () => {
        const buckets = await bucketsFor(
          lot("l1", { [SM]: "DONE", [FDA]: "NOT_STARTED" }),
        );

        expect(buckets.done).toEqual(["l1"]);
      });
    });

    it("matches stage names case-insensitively", async () => {
      const buckets = await bucketsFor(
        lot("l1", {
          "SITE MEASUREMENTS": "IN_PROGRESS",
          "final design approval": "DONE",
        }),
      );

      expect(buckets.pending).toEqual(["l1"]);
    });

    it("does not match stage names with different spacing or wording", async () => {
      const buckets = await bucketsFor(
        lot("l1", { "Site Measurement": "DONE", FinalDesignApproval: "DONE" }),
      );

      // Both stages count as missing -> NOT_STARTED, and design not DONE
      expect(buckets).toEqual({ pending: [], done: [] });
    });

    it("sorts a mix of lots into the right buckets, keeping query order", async () => {
      const buckets = await bucketsFor(
        lot("pending-1", { [FDA]: "DONE" }),
        lot("done-1", { [SM]: "DONE" }),
        lot("neither", {}),
        lot("pending-2", { [SM]: "IN_PROGRESS", [FDA]: "DONE" }),
        lot("finished", { [SM]: "DONE", [FAP]: "DONE" }),
      );

      expect(buckets).toEqual({
        pending: ["pending-1", "pending-2"],
        done: ["done-1"],
      });
    });

    it("handles a lot with no stages array", async () => {
      const buckets = await bucketsFor({ id: "l1" });

      expect(buckets).toEqual({ pending: [], done: [] });
    });

    it("returns 500 when the query fails", async () => {
      prismaMock.lot.findMany.mockRejectedValue(new Error("DB down"));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal server error",
      });
    });
  });
});
