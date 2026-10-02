import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthorizedUser } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/dashboard/insights/route");

const get = (section = "production", options = {}) =>
  GET(
    buildRequest(
      section == null
        ? "/api/v1/dashboard/insights"
        : `/api/v1/dashboard/insights?section=${section}`,
      { method: "GET", ...options },
    ),
  );

// Wednesday 15 July 2026, 11:30 in Adelaide (UTC+9:30). The week starts on
// Monday 13 July.
const NOW = new Date("2026-07-15T02:00:00.000Z");

function mockInsightQueries() {
  prismaMock.lot.findMany.mockResolvedValue([]);
  prismaMock.$queryRaw.mockResolvedValue([]);
  prismaMock.stock_transaction.groupBy.mockResolvedValue([]);
  prismaMock.item.findMany.mockResolvedValue([]);
}

const fetchData = async (section) => {
  const res = await get(section);
  expect(res.status).toBe(200);
  return (await res.json()).data;
};

describe("GET /api/v1/dashboard/insights", () => {
  // Access needs the dashboard module AND the section's own module, which
  // the generic matrix cannot express; the role/module cases are below.
  describeAuthorization((options) => get("production", options), {
    authOnly: true,
    setup: mockInsightQueries,
    untouched: () => [prismaMock.lot.findMany, prismaMock.$queryRaw],
  });

  describe("handler", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      mockAuthorizedUser({ userType: "master-admin" });
      mockInsightQueries();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe("validation", () => {
      it.each([null, "", "finance"])("400 for section %s", async (section) => {
        const res = await get(section);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          status: false,
          message: "Unknown insights section",
        });
        expect(prismaMock.lot.findMany).not.toHaveBeenCalled();
      });

      it("403 for employee accounts", async () => {
        mockAuthorizedUser({
          userType: "employee",
          modules: ["dashboard", "all_projects"],
        });

        const res = await get("production");

        expect(res.status).toBe(403);
      });

      it("403 without the dashboard module", async () => {
        mockAuthorizedUser({ modules: ["all_projects"] });

        const res = await get("production");

        expect(res.status).toBe(403);
        expect(prismaMock.lot.findMany).not.toHaveBeenCalled();
      });

      it("allows a manager holding the dashboard and section modules", async () => {
        mockAuthorizedUser({ modules: ["dashboard", "all_items"] });

        const res = await get("inventory");

        expect(res.status).toBe(200);
      });

      it.each([
        ["production", ["purchaseorder", "all_items"]],
        ["procurement", ["all_projects", "all_items"]],
        ["inventory", ["all_projects", "purchaseorder"]],
      ])("403 for %s without its module", async (section, modules) => {
        mockAuthorizedUser({ modules: ["dashboard", ...modules] });

        const res = await get(section);

        expect(res.status).toBe(403);
        expect(prismaMock.lot.findMany).not.toHaveBeenCalled();
        expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
      });

      it("returns 500 when a query fails", async () => {
        prismaMock.lot.findMany.mockRejectedValue(new Error("DB down"));

        const res = await get("production");

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
      });
    });

    describe("production", () => {
      // lot.findMany order: due lots, created lots, completed lots, active lots.
      const primeLots = ({
        due = [],
        created = [],
        completed = [],
        active = [],
      }) =>
        prismaMock.lot.findMany
          .mockResolvedValueOnce(due)
          .mockResolvedValueOnce(created)
          .mockResolvedValueOnce(completed)
          .mockResolvedValueOnce(active);

      it("returns empty series when there is no data", async () => {
        const data = await fetchData("production");

        expect(data.section).toBe("production");
        expect(data.forecast.overdue).toBe(0);
        expect(data.forecast.weeks).toHaveLength(8);
        expect(data.forecast.weeks[0]).toEqual({
          week: "2026-07-13",
          count: 0,
        });
        expect(data.throughput).toHaveLength(12);
        expect(data.throughput[0].month).toBe("2025-08");
        expect(data.throughput[11].month).toBe("2026-07");
        expect(data.cycleTime).toEqual({ medianDays: null, samples: 0 });
        expect(data.currentStage).toEqual([]);
        expect(data.installerLoad).toEqual([]);
        expect(data.stageDurations).toEqual([]);
      });

      it("only forecasts active lots from 60 days overdue to the end of week 8", async () => {
        await get("production");

        expect(prismaMock.lot.findMany).toHaveBeenNthCalledWith(1, {
          where: {
            status: "ACTIVE",
            is_deleted: false,
            installationDueDate: {
              gte: new Date("2026-05-15T14:30:00.000Z"),
              // Monday 7 September 00:00 Adelaide.
              lt: new Date("2026-09-06T14:30:00.000Z"),
            },
          },
          select: {
            installationDueDate: true,
            installer: { select: { first_name: true, last_name: true } },
          },
        });
      });

      it("buckets installations by week and installer", async () => {
        const sam = { first_name: "Sam", last_name: "Fitter" };
        primeLots({
          due: [
            {
              installationDueDate: new Date("2026-07-10T00:00:00.000Z"),
              installer: sam,
            },
            {
              installationDueDate: new Date("2026-07-15T00:00:00.000Z"),
              installer: sam,
            },
            {
              installationDueDate: new Date("2026-07-21T00:00:00.000Z"),
              installer: null,
            },
            {
              installationDueDate: new Date("2026-09-01T00:00:00.000Z"),
              installer: sam,
            },
          ],
        });

        const { forecast, installerLoad } = await fetchData("production");

        expect(forecast.overdue).toBe(1);
        expect(forecast.weeks.map((w) => w.count)).toEqual([
          1, 1, 0, 0, 0, 0, 0, 1,
        ]);
        // The 1 September install is beyond the 4-week workload window.
        expect(installerLoad).toEqual([
          { name: "Sam Fitter", count: 2 },
          { name: "Unassigned", count: 1 },
        ]);
      });

      it("counts throughput per month and the median cycle time", async () => {
        primeLots({
          created: [
            { createdAt: new Date("2026-07-01T00:00:00.000Z") },
            { createdAt: new Date("2026-07-02T00:00:00.000Z") },
            { createdAt: new Date("2026-06-02T00:00:00.000Z") },
          ],
          completed: [
            {
              createdAt: new Date("2026-05-01T00:00:00.000Z"),
              startDate: null,
              updatedAt: new Date("2026-07-11T00:00:00.000Z"),
            },
            {
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              startDate: new Date("2026-06-01T00:00:00.000Z"),
              updatedAt: new Date("2026-07-01T00:00:00.000Z"),
            },
          ],
        });

        const { throughput, cycleTime } = await fetchData("production");

        const byMonth = Object.fromEntries(throughput.map((r) => [r.month, r]));
        expect(byMonth["2026-07"]).toEqual({
          month: "2026-07",
          created: 2,
          completed: 2,
          medianCycleDays: 50.5,
        });
        expect(byMonth["2026-06"]).toMatchObject({ created: 1, completed: 0 });
        expect(cycleTime).toEqual({ medianDays: 50.5, samples: 2 });
      });

      it("places each active lot at its first unfinished stage in workflow order", async () => {
        const past = new Date("2026-07-01T00:00:00.000Z");
        const future = new Date("2026-08-01T00:00:00.000Z");
        primeLots({
          active: [
            {
              stages: [
                { name: "CNC", status: "NOT_STARTED", endDate: future },
                { name: "Drafting", status: "IN_PROGRESS", endDate: past },
                { name: "Quote approve", status: "DONE", endDate: past },
              ],
            },
            {
              stages: [
                { name: " drafting ", status: "NOT_STARTED", endDate: future },
              ],
            },
            {
              stages: [{ name: "CNC", status: "IN_PROGRESS", endDate: null }],
            },
            { stages: [{ name: "Delivery", status: "DONE", endDate: past }] },
            { stages: [{ name: "Delivery", status: "NA", endDate: past }] },
            { stages: [] },
          ],
        });

        const { currentStage, readyToClose } = await fetchData("production");

        expect(currentStage).toEqual([
          { name: "Drafting", order: 2, onTrack: 1, overdue: 1 },
          { name: "CNC", order: 9, onTrack: 1, overdue: 0 },
        ]);
        expect(readyToClose).toBe(2);
      });

      it("maps average stage durations in workflow order", async () => {
        prismaMock.$queryRaw.mockResolvedValueOnce([
          { name: "cnc", avg_days: "2.3333", samples: 3n },
          { name: "drafting", avg_days: "5.0000", samples: 1n },
        ]);

        const { stageDurations } = await fetchData("production");

        expect(stageDurations).toEqual([
          { name: "drafting", avgDays: 5, samples: 1, order: 2 },
          { name: "cnc", avgDays: 2.3, samples: 3, order: 9 },
        ]);
      });
    });

    describe("procurement", () => {
      it("skips the PO queries for users without purchase order access", async () => {
        mockAuthorizedUser({ modules: ["dashboard", "statements"] });

        const data = await fetchData("procurement");

        expect(data.spendByCategory).toEqual([]);
        expect(data.leadTimes).toEqual([]);
        expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
      });

      it("maps spend by category and supplier lead times", async () => {
        prismaMock.$queryRaw
          .mockResolvedValueOnce([
            { category: "HARDWARE", total: "300.50" },
            { category: "SHEET", total: "1200" },
            { category: "HANDLE", total: "0" },
          ])
          .mockResolvedValueOnce([
            { supplier_id: "s1", name: "Acme", avg_days: "4.25", orders: 4n },
            { supplier_id: "s2", name: "Slowco", avg_days: "30", orders: 2n },
          ]);

        const data = await fetchData("procurement");

        expect(data.spendByCategory).toEqual([
          { category: "SHEET", total: 1200 },
          { category: "HARDWARE", total: 300.5 },
        ]);
        expect(data.leadTimes).toEqual([
          { supplier_id: "s2", name: "Slowco", avgDays: 30, orders: 2 },
          { supplier_id: "s1", name: "Acme", avgDays: 4.3, orders: 4 },
        ]);
      });
    });

    describe("inventory", () => {
      it("buckets stock movement into 12 weeks ending this week", async () => {
        prismaMock.$queryRaw
          .mockResolvedValueOnce([
            { day: "2026-04-27", type: "USED", qty: "5" },
            { day: "2026-07-14", type: "USED", qty: "3" },
            { day: "2026-07-15", type: "WASTED", qty: "1" },
            { day: "2026-07-13", type: "ADDED", qty: "20" },
          ])
          .mockResolvedValueOnce([]);

        const { movementWeekly } = await fetchData("inventory");

        expect(movementWeekly).toHaveLength(12);
        expect(movementWeekly[0]).toEqual({
          week: "2026-04-27",
          ADDED: 0,
          USED: 5,
          WASTED: 0,
        });
        expect(movementWeekly[11]).toEqual({
          week: "2026-07-13",
          ADDED: 20,
          USED: 3,
          WASTED: 1,
        });
      });

      it("labels the most used items and skips deleted ones", async () => {
        prismaMock.stock_transaction.groupBy.mockResolvedValue([
          { item_id: "i1", _sum: { quantity: 40 } },
          { item_id: "gone", _sum: { quantity: 10 } },
        ]);
        prismaMock.item.findMany.mockResolvedValue([
          {
            item_id: "i1",
            category: "SHEET",
            measurement_unit: "SHEET",
            description: null,
            sheet: { brand: "Egger", color: "Oak", finish: null },
          },
        ]);

        const { topConsumed } = await fetchData("inventory");

        expect(topConsumed).toEqual([
          {
            item_id: "i1",
            label: "Egger Oak",
            category: "SHEET",
            used: 40,
            measurement_unit: "SHEET",
          },
        ]);
        expect(prismaMock.stock_transaction.groupBy).toHaveBeenCalledWith(
          expect.objectContaining({
            by: ["item_id"],
            where: {
              type: "USED",
              createdAt: { gte: new Date("2026-04-15T14:30:00.000Z") },
            },
            take: 8,
          }),
        );
      });

      it("computes the waste rate per category, worst first", async () => {
        prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
          { category: "SHEET", type: "USED", qty: "90" },
          { category: "SHEET", type: "WASTED", qty: "10" },
          { category: "HANDLE", type: "USED", qty: "2" },
          { category: "HANDLE", type: "WASTED", qty: "1" },
        ]);

        const { wasteByCategory } = await fetchData("inventory");

        expect(wasteByCategory).toEqual([
          { category: "HANDLE", used: 2, wasted: 1, wastePct: 33.3 },
          { category: "SHEET", used: 90, wasted: 10, wastePct: 10 },
        ]);
      });
    });
  });
});
