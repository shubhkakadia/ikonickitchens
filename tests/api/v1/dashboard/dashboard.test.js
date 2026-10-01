import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { POST } = await import("@/app/api/v1/dashboard/route");

const URL = "/api/v1/dashboard";
const post = (body = {}, options = {}) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

// Every query the dashboard runs, primed with empty results.
function mockDashboardQueries() {
  prismaMock.project.count.mockResolvedValue(0);
  prismaMock.lot.count.mockResolvedValue(0);
  prismaMock.materials_to_order.count.mockResolvedValue(0);
  prismaMock.purchase_order.count.mockResolvedValue(0);
  prismaMock.supplier_statement.findMany.mockResolvedValue([]);
  prismaMock.stage.groupBy.mockResolvedValue([]);
  prismaMock.materials_to_order.groupBy.mockResolvedValue([]);
  prismaMock.purchase_order.groupBy.mockResolvedValue([]);
  prismaMock.stock_transaction.groupBy.mockResolvedValue([]);
  prismaMock.stage.findMany.mockResolvedValue([]);
  prismaMock.project.findMany.mockResolvedValue([]);
  prismaMock.meeting.findMany.mockResolvedValue([]);
  prismaMock.logs.findMany.mockResolvedValue([]);
  prismaMock.item.findMany.mockResolvedValue([]);
}

const whereOf = (fn, call = 0) => fn.mock.calls[call][0].where;
const utc = (iso) => new Date(iso);

// Adelaide midnight in UTC: +10:30 during daylight saving, +9:30 otherwise
const RANGE_2026 = {
  gte: utc("2025-12-31T13:30:00.000Z"),
  lt: utc("2026-12-31T13:30:00.000Z"),
};
const RANGE_JULY_2026 = {
  gte: utc("2026-06-30T14:30:00.000Z"),
  lt: utc("2026-07-31T14:30:00.000Z"),
};
const RANGE_DEC_2026 = {
  gte: utc("2026-11-30T13:30:00.000Z"),
  lt: utc("2026-12-31T13:30:00.000Z"),
};

describe("POST /api/v1/dashboard", () => {
  describeAuthorization((options) => post({}, options), {
    modules: "dashboard",
    setup: mockDashboardQueries,
    untouched: () => [prismaMock.project.count, prismaMock.logs.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockDashboardQueries();
    });

    describe("response", () => {
      it("returns zeroed/empty stats when there is no data", async () => {
        const res = await post();

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "Dashboard fetched successfully",
          data: {
            activeProjects: 0,
            activeLots: 0,
            activeMTOs: 0,
            activePurchaseOrders: 0,
            totalSpent: [],
            lotsByStage: [],
            MTOsByStatus: [],
            purchaseOrdersByStatus: [],
            top10items: [],
            top10itemsCount: [],
            topstagesDue: [],
            projectsCompletedThisMonth: 0,
            averageProjectDuration: 0,
            upcomingMeetings: [],
            recentLogs: [],
          },
        });
      });

      it("maps each query result onto the matching field", async () => {
        prismaMock.project.count
          .mockResolvedValueOnce(4) // active projects
          .mockResolvedValueOnce(2); // completed this month
        prismaMock.lot.count.mockResolvedValue(9);
        prismaMock.materials_to_order.count.mockResolvedValue(3);
        prismaMock.purchase_order.count.mockResolvedValue(5);
        const statements = [
          { month_year: "2026-07", amount: 100, supplier: { name: "Blum" } },
        ];
        prismaMock.supplier_statement.findMany.mockResolvedValue(statements);
        prismaMock.stage.groupBy.mockResolvedValue([
          { name: "cnc", _count: 3 },
        ]);
        prismaMock.materials_to_order.groupBy.mockResolvedValue([
          { status: "DRAFT", _count: 1 },
        ]);
        prismaMock.purchase_order.groupBy.mockResolvedValue([
          { status: "ORDERED", _count: 2 },
        ]);
        prismaMock.stage.findMany.mockResolvedValue([{ stage_id: "s1" }]);
        prismaMock.meeting.findMany.mockResolvedValue([{ id: "m1" }]);
        prismaMock.logs.findMany.mockResolvedValue([{ id: "log1" }]);

        const { data } = await (await post()).json();

        expect(data).toMatchObject({
          activeProjects: 4,
          projectsCompletedThisMonth: 2,
          activeLots: 9,
          activeMTOs: 3,
          activePurchaseOrders: 5,
          totalSpent: statements,
          lotsByStage: [{ name: "cnc", _count: 3 }],
          MTOsByStatus: [{ status: "DRAFT", _count: 1 }],
          purchaseOrdersByStatus: [{ status: "ORDERED", _count: 2 }],
          topstagesDue: [{ stage_id: "s1" }],
          upcomingMeetings: [{ id: "m1" }],
          recentLogs: [{ id: "log1" }],
        });
      });
    });

    describe("with no date filter (empty body or 'all')", () => {
      it.each([
        ["an empty body", {}],
        ["year and month 'all'", { year: "all", month: "all" }],
        ["upper-case 'ALL'", { year: "ALL", month: "ALL" }],
        ["null values", { year: null, month: null }],
      ])("applies no date filter for %s", async (_, body) => {
        await post(body);

        expect(whereOf(prismaMock.lot.count)).toEqual({ status: "ACTIVE" });
        expect(whereOf(prismaMock.project.count, 0)).toEqual({
          lots: { some: { status: "ACTIVE" } },
        });
        expect(whereOf(prismaMock.materials_to_order.count)).toEqual({
          is_deleted: false,
          status: { in: ["DRAFT", "PARTIALLY_ORDERED"] },
        });
        expect(whereOf(prismaMock.purchase_order.count)).toEqual({
          status: { in: ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"] },
        });
        expect(whereOf(prismaMock.supplier_statement.findMany)).toEqual({});
        expect(whereOf(prismaMock.stage.groupBy)).toEqual({
          lot: { status: "ACTIVE" },
        });
        expect(whereOf(prismaMock.materials_to_order.groupBy)).toEqual({
          is_deleted: false,
        });
        expect(whereOf(prismaMock.purchase_order.groupBy)).toEqual({});
        expect(whereOf(prismaMock.stock_transaction.groupBy)).toEqual({});
        expect(whereOf(prismaMock.stage.findMany)).toEqual({
          status: "IN_PROGRESS",
          lot: { status: "ACTIVE" },
        });
      });
    });

    describe("with a year only", () => {
      it("filters every date field to the Adelaide calendar year", async () => {
        await post({ year: "2026", month: "all" });

        const or = [{ startDate: RANGE_2026 }, { createdAt: RANGE_2026 }];
        expect(whereOf(prismaMock.lot.count)).toEqual({
          status: "ACTIVE",
          OR: or,
        });
        expect(whereOf(prismaMock.project.count, 0)).toEqual({
          lots: { some: { status: "ACTIVE", OR: or } },
        });
        expect(whereOf(prismaMock.materials_to_order.count)).toEqual({
          is_deleted: false,
          status: { in: ["DRAFT", "PARTIALLY_ORDERED"] },
          createdAt: RANGE_2026,
        });
        expect(whereOf(prismaMock.purchase_order.count)).toEqual({
          status: { in: ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"] },
          OR: [{ createdAt: RANGE_2026 }, { ordered_at: RANGE_2026 }],
        });
        expect(whereOf(prismaMock.stage.groupBy)).toEqual({
          lot: { status: "ACTIVE" },
          OR: [{ startDate: RANGE_2026 }, { endDate: RANGE_2026 }],
        });
        expect(whereOf(prismaMock.materials_to_order.groupBy)).toEqual({
          is_deleted: false,
          createdAt: RANGE_2026,
        });
        expect(whereOf(prismaMock.purchase_order.groupBy)).toEqual({
          OR: [{ createdAt: RANGE_2026 }, { ordered_at: RANGE_2026 }],
        });
        expect(whereOf(prismaMock.stock_transaction.groupBy)).toEqual({
          createdAt: RANGE_2026,
        });
        expect(whereOf(prismaMock.stage.findMany)).toEqual({
          status: "IN_PROGRESS",
          lot: { status: "ACTIVE" },
          endDate: RANGE_2026,
        });
      });

      it("filters supplier statements to all 12 months of the year", async () => {
        await post({ year: "2026" });

        expect(whereOf(prismaMock.supplier_statement.findMany)).toEqual({
          month_year: {
            in: [
              "2026-01",
              "2026-02",
              "2026-03",
              "2026-04",
              "2026-05",
              "2026-06",
              "2026-07",
              "2026-08",
              "2026-09",
              "2026-10",
              "2026-11",
              "2026-12",
            ],
          },
        });
      });

      it("accepts the year as a number", async () => {
        await post({ year: 2026 });

        expect(whereOf(prismaMock.stock_transaction.groupBy)).toEqual({
          createdAt: RANGE_2026,
        });
      });
    });

    describe("with a year and month", () => {
      it("filters to that month in Adelaide time", async () => {
        await post({ year: "2026", month: "7" });

        expect(whereOf(prismaMock.stock_transaction.groupBy)).toEqual({
          createdAt: RANGE_JULY_2026,
        });
        expect(whereOf(prismaMock.supplier_statement.findMany)).toEqual({
          month_year: { in: ["2026-07"] },
        });
      });

      it("rolls December over into January of the next year", async () => {
        await post({ year: "2026", month: "12" });

        expect(whereOf(prismaMock.stock_transaction.groupBy)).toEqual({
          createdAt: RANGE_DEC_2026,
        });
      });

      it("handles the daylight-saving change inside the month (April)", async () => {
        await post({ year: "2026", month: "april" });

        expect(whereOf(prismaMock.stock_transaction.groupBy)).toEqual({
          createdAt: {
            gte: utc("2026-03-31T13:30:00.000Z"),
            lt: utc("2026-04-30T14:30:00.000Z"),
          },
        });
      });

      it.each([
        ["full name", "July"],
        ["lower-case name", "july"],
        ["name with spaces", "  JULY "],
        ["number string", "7"],
        ["zero-padded", "07"],
        ["number", 7],
      ])("accepts the month as a %s", async (_, month) => {
        await post({ year: "2026", month });

        expect(whereOf(prismaMock.supplier_statement.findMany)).toEqual({
          month_year: { in: ["2026-07"] },
        });
      });

      it.each([
        ["0", "0"],
        ["13", "13"],
        ["an unknown name", "julember"],
        ["an abbreviation", "jul"],
      ])("treats month %s as 'all'", async (_, month) => {
        await post({ year: "2026", month });

        expect(whereOf(prismaMock.stock_transaction.groupBy)).toEqual({
          createdAt: RANGE_2026,
        });
        expect(
          whereOf(prismaMock.supplier_statement.findMany).month_year.in,
        ).toHaveLength(12);
      });
    });

    // Current behaviour: with year "all" and a specific month, only supplier
    // statements are filtered (by month across all years). Every other
    // statistic ignores the month entirely.
    describe("with a month only (year 'all')", () => {
      it("filters supplier statements by month across all years", async () => {
        await post({ year: "all", month: "march" });

        expect(whereOf(prismaMock.supplier_statement.findMany)).toEqual({
          month_year: { endsWith: "-03" },
        });
      });

      it("applies no month filter to the other statistics", async () => {
        await post({ year: "all", month: "march" });

        expect(whereOf(prismaMock.lot.count)).toEqual({ status: "ACTIVE" });
        expect(whereOf(prismaMock.stock_transaction.groupBy)).toEqual({});
        expect(whereOf(prismaMock.stage.findMany)).toEqual({
          status: "IN_PROGRESS",
          lot: { status: "ACTIVE" },
        });
      });
    });

    describe("filters that ignore the selected period", () => {
      afterEach(() => {
        vi.useRealTimers();
      });

      // Uses server-local time, not Adelaide time like the other filters.
      it("counts projects completed in the current calendar month", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 1, 14, 10, 0, 0)); // 14 Feb, local

        await post({ year: "2020", month: "1" });

        const { gte, lte } = whereOf(prismaMock.project.count, 1).lots.some
          .updatedAt;
        expect(whereOf(prismaMock.project.count, 1).lots.some.status).toBe(
          "COMPLETED",
        );
        expect(gte).toEqual(new Date(2026, 1, 1, 0, 0, 0, 0));
        expect(lte).toEqual(new Date(2026, 1, 28, 23, 59, 59, 999));
      });

      it("returns only future meetings the current user takes part in", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const now = new Date("2026-05-01T00:00:00.000Z");
        vi.setSystemTime(now);

        await post({ year: "2020" });

        expect(prismaMock.meeting.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              date_time: { gte: now },
              participants: { some: { id: "user-1" } },
            },
            orderBy: { date_time: "asc" },
            take: 5,
          }),
        );
      });

      // Recent activity is company-wide: not filtered by user or period.
      it("returns the 10 most recent logs from all users", async () => {
        await post({ year: "2020" });

        const args = prismaMock.logs.findMany.mock.calls[0][0];
        expect(args.where).toBeUndefined();
        expect(args).toMatchObject({
          take: 10,
          orderBy: { createdAt: "desc" },
        });
      });

      it("lists due stages ordered by end date, soonest first", async () => {
        await post();

        expect(prismaMock.stage.findMany.mock.calls[0][0].orderBy).toEqual({
          endDate: "asc",
        });
      });
    });

    describe("average project duration", () => {
      const project = (...lots) => ({ id: "p", lots });
      const lot = (startDate, updatedAt) => ({ startDate, updatedAt });

      it("averages first-start to last-completion across projects, in days", async () => {
        prismaMock.project.findMany.mockResolvedValue([
          // 10 days: earliest start 1 Jan, latest completion 11 Jan
          project(
            lot("2026-01-05T00:00:00Z", "2026-01-08T00:00:00Z"),
            lot("2026-01-01T00:00:00Z", "2026-01-11T00:00:00Z"),
          ),
          // 20 days
          project(lot("2026-02-01T00:00:00Z", "2026-02-21T00:00:00Z")),
        ]);

        const { data } = await (await post()).json();

        expect(data.averageProjectDuration).toBe(15);
      });

      it("rounds to the nearest whole day", async () => {
        prismaMock.project.findMany.mockResolvedValue([
          project(lot("2026-01-01T00:00:00Z", "2026-01-02T12:00:00Z")),
        ]);

        const { data } = await (await post()).json();

        expect(data.averageProjectDuration).toBe(2);
      });

      it("skips projects with no lots, missing dates, or invalid dates", async () => {
        prismaMock.project.findMany.mockResolvedValue([
          project(),
          { id: "p-no-lots" },
          project(lot(null, "2026-01-11T00:00:00Z")),
          project(lot("not a date", "also not")),
          project(lot("2026-01-01T00:00:00Z", "2026-01-05T00:00:00Z")), // 4 days
        ]);

        const { data } = await (await post()).json();

        expect(data.averageProjectDuration).toBe(4);
      });

      it("skips projects whose completion is not after the start", async () => {
        prismaMock.project.findMany.mockResolvedValue([
          project(lot("2026-01-10T00:00:00Z", "2026-01-10T00:00:00Z")),
          project(lot("2026-01-10T00:00:00Z", "2026-01-01T00:00:00Z")),
          project(lot("2026-01-01T00:00:00Z", "2026-01-07T00:00:00Z")), // 6 days
        ]);

        const { data } = await (await post()).json();

        expect(data.averageProjectDuration).toBe(6);
      });

      it("is 0 when no project has a usable duration", async () => {
        prismaMock.project.findMany.mockResolvedValue([
          project(lot(null, null)),
        ]);

        const { data } = await (await post()).json();

        expect(data.averageProjectDuration).toBe(0);
      });

      it("queries projects with completed lots, selecting only their dates", async () => {
        await post();

        expect(prismaMock.project.findMany).toHaveBeenCalledWith({
          where: { lots: { some: { status: "COMPLETED" } } },
          include: {
            lots: {
              where: { status: "COMPLETED" },
              select: { startDate: true, updatedAt: true },
            },
          },
        });
      });
    });

    describe("top 10 items", () => {
      const counts = (n) =>
        Array.from({ length: n }, (_, i) => ({
          item_id: `item-${i}`,
          _count: i,
        }));

      it("returns the 10 most-used items, highest count first, with details", async () => {
        prismaMock.stock_transaction.groupBy.mockResolvedValue(counts(12));
        const details = [{ item_id: "item-11" }];
        prismaMock.item.findMany.mockResolvedValue(details);

        const { data } = await (await post()).json();

        expect(data.top10itemsCount.map((i) => i._count)).toEqual([
          11, 10, 9, 8, 7, 6, 5, 4, 3, 2,
        ]);
        expect(data.top10items).toEqual(details);
        expect(prismaMock.item.findMany).toHaveBeenCalledWith({
          where: {
            item_id: {
              in: [
                "item-11",
                "item-10",
                "item-9",
                "item-8",
                "item-7",
                "item-6",
                "item-5",
                "item-4",
                "item-3",
                "item-2",
              ],
            },
          },
          include: {
            image: true,
            sheet: true,
            handle: true,
            hardware: true,
            accessory: true,
            edging_tape: true,
          },
        });
      });

      it("returns fewer than 10 when there are fewer items", async () => {
        prismaMock.stock_transaction.groupBy.mockResolvedValue(counts(3));

        const { data } = await (await post()).json();

        expect(data.top10itemsCount).toHaveLength(3);
      });

      it("skips the item lookup when there are no transactions", async () => {
        const { data } = await (await post()).json();

        expect(data.top10items).toEqual([]);
        expect(prismaMock.item.findMany).not.toHaveBeenCalled();
      });
    });

    describe("errors", () => {
      it.each([
        ["project.count", () => prismaMock.project.count],
        [
          "supplier_statement.findMany",
          () => prismaMock.supplier_statement.findMany,
        ],
        ["logs.findMany", () => prismaMock.logs.findMany],
        ["meeting.findMany", () => prismaMock.meeting.findMany],
      ])("returns 500 when %s fails", async (_, fn) => {
        fn().mockRejectedValue(new Error("DB down"));

        const res = await post();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
      });

      it("returns 500 when the top-item detail lookup fails", async () => {
        prismaMock.stock_transaction.groupBy.mockResolvedValue([
          { item_id: "item-1", _count: 1 },
        ]);
        prismaMock.item.findMany.mockRejectedValue(new Error("DB down"));

        const res = await post();

        expect(res.status).toBe(500);
      });

      // Current behaviour: an unparseable year makes dayjs throw, so the
      // route answers 500 rather than 400.
      it("returns 500 for a non-numeric year", async () => {
        const res = await post({ year: "twenty", month: "all" });

        expect(res.status).toBe(500);
        expect(prismaMock.project.count).not.toHaveBeenCalled();
      });

      // Current behaviour: the body is required. A POST with no body (or
      // malformed JSON) is a 500, not a default "all periods" dashboard.
      it("returns 500 when the request has no body", async () => {
        const res = await POST(buildRequest(URL, { method: "POST" }));

        expect(res.status).toBe(500);
        expect(prismaMock.project.count).not.toHaveBeenCalled();
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
      });
    });
  });
});
