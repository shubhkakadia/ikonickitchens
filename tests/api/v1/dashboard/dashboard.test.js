import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthorizedUser } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/dashboard/route");

const URL = "/api/v1/dashboard";
const get = (options = {}) => GET(buildRequest(URL, { method: "GET", ...options }));

// 15 July 2026, 11:30 in Adelaide (UTC+9:30, no daylight saving in July).
const NOW = new Date("2026-07-15T02:00:00.000Z");

const VIEWER = {
  employee_id: "employee-1",
  username: "test.user",
  employee: { first_name: "Ann", last_name: "Lee" },
};

// Every query the dashboard can run, primed with empty results.
function mockDashboardQueries() {
  prismaMock.users.findUnique.mockResolvedValue(VIEWER);
  prismaMock.module_access.findUnique.mockResolvedValue(null);
  prismaMock.lot.count.mockResolvedValue(0);
  prismaMock.lot.findMany.mockResolvedValue([]);
  prismaMock.lot.groupBy.mockResolvedValue([]);
  prismaMock.stage.count.mockResolvedValue(0);
  prismaMock.stage.groupBy.mockResolvedValue([]);
  prismaMock.stage.findMany.mockResolvedValue([]);
  prismaMock.project.count.mockResolvedValue(0);
  prismaMock.materials_to_order.count.mockResolvedValue(0);
  prismaMock.materials_to_order.groupBy.mockResolvedValue([]);
  prismaMock.materials_to_order_item.findMany.mockResolvedValue([]);
  prismaMock.purchase_order.count.mockResolvedValue(0);
  prismaMock.purchase_order.groupBy.mockResolvedValue([]);
  prismaMock.purchase_order.findMany.mockResolvedValue([]);
  prismaMock.supplier_statement.aggregate.mockResolvedValue({
    _count: { _all: 0 },
    _sum: { amount: null },
  });
  prismaMock.supplier_statement.findMany.mockResolvedValue([]);
  prismaMock.supplier.findMany.mockResolvedValue([]);
  prismaMock.item.findMany.mockResolvedValue([]);
  prismaMock.stock_transaction.groupBy.mockResolvedValue([]);
  prismaMock.reserve_item_stock.groupBy.mockResolvedValue([]);
  prismaMock.clock_punch.count.mockResolvedValue(0);
  prismaMock.meeting.findMany.mockResolvedValue([]);
  prismaMock.logs.findMany.mockResolvedValue([]);
}

// The dashboard reads the role from the stored session row (signin copies
// user_type onto it), which the shared auth helper does not populate.
function mockSessionUser(userType) {
  const session = mockAuthorizedUser({ userType, modules: ["dashboard"] });
  session.user_type = userType;
  return session;
}

// A non-master user: the dashboard module plus the given module_access flags.
function asManager(flags = []) {
  mockSessionUser("manager");
  prismaMock.module_access.findUnique.mockResolvedValue(
    Object.fromEntries(flags.map((flag) => [flag, true])),
  );
}

const fetchData = async () => {
  const res = await get();
  expect(res.status).toBe(200);
  return (await res.json()).data;
};

describe("GET /api/v1/dashboard", () => {
  describeAuthorization((options) => get(options), {
    modules: "dashboard",
    setup: mockDashboardQueries,
    untouched: () => [prismaMock.project.count, prismaMock.logs.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      mockSessionUser("master-admin");
      mockDashboardQueries();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe("response", () => {
      it("returns an empty dashboard when there is no data", async () => {
        const res = await get();

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.status).toBe(true);
        expect(json.message).toBe("Dashboard fetched successfully");
        expect(json.data).toMatchObject({
          generatedAt: NOW.toISOString(),
          viewer: {
            name: "Ann Lee",
            username: "test.user",
            isEmployeeLinked: true,
          },
          kpis: {
            activeProjects: 0,
            activeLots: 0,
            completedThisMonth: 0,
            openMtoCount: 0,
            openPoCount: 0,
          },
          schedule: [],
          pipeline: {
            byStage: [],
            lotStatus: { ACTIVE: 0, COMPLETED: 0, CANCELLED: 0 },
          },
          myDay: { stages: [], meetings: [] },
          activity: [],
        });
        expect(json.data.attention.overdueInstalls.count).toBe(0);
        expect(json.data.inventory.lowStock).toEqual([]);
        expect(json.data.procurement.topSuppliers).toEqual([]);
      });

      it("falls back to the username when the login has no employee", async () => {
        prismaMock.users.findUnique.mockResolvedValue({
          employee_id: null,
          username: "bob",
          employee: null,
        });

        const { viewer } = await fetchData();

        expect(viewer).toEqual({
          name: "bob",
          username: "bob",
          isEmployeeLinked: false,
        });
      });

      it("looks the viewer up by the session user", async () => {
        await get();

        expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
          where: { id: "user-1" },
          select: {
            employee_id: true,
            username: true,
            employee: { select: { first_name: true, last_name: true } },
          },
        });
      });
    });

    describe("permissions", () => {
      it("grants every section to a master-admin without module flags", async () => {
        const { permissions } = await fetchData();

        expect(permissions).toEqual({
          projects: true,
          procurement: true,
          purchaseOrders: true,
          statements: true,
          materialsToOrder: true,
          inventory: true,
          punches: true,
          logs: true,
        });
        expect(prismaMock.module_access.findUnique).toHaveBeenCalledWith({
          where: { user_id: "user-1" },
        });
      });

      it("returns nothing but 'my day' for a user with no module flags", async () => {
        asManager([]);

        const data = await fetchData();

        expect(data.permissions).toEqual({
          projects: false,
          procurement: false,
          purchaseOrders: false,
          statements: false,
          materialsToOrder: false,
          inventory: false,
          punches: false,
          logs: false,
        });
        expect(data.attention).toEqual({});
        expect(data.kpis).toEqual({});
        expect(data.schedule).toEqual([]);
        expect(data.pipeline).toBeNull();
        expect(data.procurement).toBeNull();
        expect(data.inventory).toBeNull();
        expect(data.activity).toEqual([]);
        expect(data.myDay).toEqual({ stages: [], meetings: [] });
        for (const fn of [
          prismaMock.project.count,
          prismaMock.lot.count,
          prismaMock.purchase_order.count,
          prismaMock.supplier_statement.aggregate,
          prismaMock.item.findMany,
          prismaMock.clock_punch.count,
          prismaMock.logs.findMany,
        ]) {
          expect(fn).not.toHaveBeenCalled();
        }
        // "my day" is not permission-gated.
        expect(prismaMock.meeting.findMany).toHaveBeenCalled();
      });

      it("only runs the project queries for all_projects", async () => {
        asManager(["all_projects"]);

        const data = await fetchData();

        expect(Object.keys(data.attention)).toEqual([
          "overdueInstalls",
          "overdueStages",
        ]);
        expect(data.pipeline).not.toBeNull();
        expect(data.procurement).toBeNull();
        expect(data.inventory).toBeNull();
        expect(prismaMock.purchase_order.count).not.toHaveBeenCalled();
        expect(prismaMock.item.findMany).not.toHaveBeenCalled();
      });

      it.each([
        ["purchaseorder", ["lateDeliveries"], { purchaseOrders: true }],
        ["statements", ["overduePayables"], { statements: true }],
        ["materialstoorder", ["unorderedMtoLines"], { materialsToOrder: true }],
      ])(
        "limits procurement attention items to %s",
        async (flag, attentionKeys, permissions) => {
          asManager([flag]);

          const data = await fetchData();

          expect(data.permissions).toMatchObject({
            procurement: true,
            ...permissions,
          });
          expect(Object.keys(data.attention)).toEqual(attentionKeys);
          expect(data.procurement).not.toBeNull();
          expect(data.pipeline).toBeNull();
          expect(prismaMock.lot.count).not.toHaveBeenCalled();
        },
      );

      it("only runs the inventory queries for all_items", async () => {
        asManager(["all_items"]);

        const data = await fetchData();

        expect(Object.keys(data.attention)).toEqual(["lowStock"]);
        expect(data.inventory).not.toBeNull();
        expect(data.procurement).toBeNull();
        expect(prismaMock.project.count).not.toHaveBeenCalled();
      });

      it("only counts pending punches for all_clock_punches", async () => {
        asManager(["all_clock_punches"]);
        prismaMock.clock_punch.count.mockResolvedValue(4);

        const data = await fetchData();

        expect(data.attention).toEqual({
          punchesToReview: { count: 4, href: "/admin/employees/punches" },
        });
        expect(prismaMock.clock_punch.count).toHaveBeenCalledWith({
          where: { review_status: "PENDING" },
        });
      });

      it("only returns the activity feed for logs", async () => {
        asManager(["logs"]);

        await fetchData();

        expect(prismaMock.logs.findMany).toHaveBeenCalledTimes(1);
        expect(prismaMock.project.count).not.toHaveBeenCalled();
      });

      it("treats the user type case-insensitively for the master bypass", async () => {
        mockSessionUser("Master-Admin");

        const { permissions } = await fetchData();

        expect(permissions.projects).toBe(true);
        expect(permissions.logs).toBe(true);
      });
    });

    describe("projects", () => {
      it("filters the counts to active, undeleted lots in Adelaide time", async () => {
        await get();

        // Adelaide midnight on 15 July is 14:30 UTC the previous day.
        const todayStart = new Date("2026-07-14T14:30:00.000Z");
        const activeLot = { status: "ACTIVE", is_deleted: false };
        expect(prismaMock.lot.count).toHaveBeenNthCalledWith(1, {
          where: { ...activeLot, installationDueDate: { lt: todayStart } },
        });
        expect(prismaMock.stage.count).toHaveBeenCalledWith({
          where: {
            status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
            endDate: { lt: todayStart },
            lot: activeLot,
          },
        });
        expect(prismaMock.lot.count).toHaveBeenNthCalledWith(2, {
          where: {
            is_deleted: false,
            status: "COMPLETED",
            updatedAt: { gte: new Date("2026-06-30T14:30:00.000Z") },
          },
        });
      });

      it("schedules lots from 60 days overdue to the end of day 14", async () => {
        await get();

        expect(prismaMock.lot.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              status: "ACTIVE",
              is_deleted: false,
              installationDueDate: {
                gte: new Date("2026-05-15T14:30:00.000Z"),
                lte: new Date("2026-07-29T14:29:59.999Z"),
              },
            },
            orderBy: { installationDueDate: "asc" },
            take: 40,
          }),
        );
      });

      it("maps counts into the attention items and KPIs", async () => {
        prismaMock.lot.count.mockResolvedValueOnce(3).mockResolvedValueOnce(6);
        prismaMock.stage.count.mockResolvedValue(4);
        prismaMock.project.count.mockResolvedValue(9);
        prismaMock.lot.groupBy.mockResolvedValue([
          { status: "ACTIVE", _count: { _all: 7 } },
        ]);

        const data = await fetchData();

        expect(data.attention.overdueInstalls).toEqual({
          count: 3,
          href: "/admin/projects/lotatglance",
        });
        expect(data.attention.overdueStages).toEqual({
          count: 4,
          href: "/admin/projects",
        });
        expect(data.kpis).toMatchObject({
          activeProjects: 9,
          activeLots: 7,
          completedThisMonth: 6,
        });
      });

      it("builds the schedule with stage progress and days left", async () => {
        prismaMock.lot.findMany.mockResolvedValue([
          {
            lot_id: "lot-1",
            name: "Lot 1",
            installationDueDate: new Date("2026-07-17T00:00:00.000Z"),
            project: { name: "Smith Kitchen", project_id: "proj-1" },
            installer: { first_name: "Sam", last_name: "Fitter" },
            stages: [
              { status: "DONE" },
              { status: "DONE" },
              { status: "IN_PROGRESS" },
              { status: "NA" },
            ],
          },
          {
            lot_id: "lot-2",
            name: "Lot 2",
            installationDueDate: new Date("2026-07-10T00:00:00.000Z"),
            project: null,
            installer: null,
            stages: [],
          },
        ]);

        const { schedule } = await fetchData();

        expect(schedule).toEqual([
          {
            lot_id: "lot-1",
            name: "Lot 1",
            project: "Smith Kitchen",
            project_id: "proj-1",
            installationDueDate: "2026-07-17T00:00:00.000Z",
            installer: "Sam Fitter",
            stagesDone: 2,
            stagesTotal: 3,
            daysLeft: 2,
          },
          {
            lot_id: "lot-2",
            name: "Lot 2",
            project: "—",
            project_id: null,
            installationDueDate: "2026-07-10T00:00:00.000Z",
            installer: null,
            stagesDone: 0,
            stagesTotal: 0,
            daysLeft: -5,
          },
        ]);
      });

      it("orders the pipeline by workflow, then alphabetically for unknown stages", async () => {
        prismaMock.stage.groupBy.mockResolvedValue([
          { name: "Zeta custom", _count: { _all: 1 } },
          { name: "CNC", _count: { _all: 2 } },
          { name: "Alpha custom", _count: { _all: 4 } },
          { name: " Drafting ", _count: { _all: 3 } },
        ]);
        prismaMock.lot.groupBy.mockResolvedValue([
          { status: "ACTIVE", _count: { _all: 7 } },
          { status: "COMPLETED", _count: { _all: 12 } },
        ]);

        const { pipeline } = await fetchData();

        expect(pipeline.byStage).toEqual([
          { name: " Drafting ", count: 3, order: 2 },
          { name: "CNC", count: 2, order: 9 },
          { name: "Alpha custom", count: 4, order: 16 },
          { name: "Zeta custom", count: 1, order: 16 },
        ]);
        expect(pipeline.lotStatus).toEqual({
          ACTIVE: 7,
          COMPLETED: 12,
          CANCELLED: 0,
        });
      });
    });

    describe("procurement", () => {
      it("counts open MTOs and POs for the KPIs", async () => {
        prismaMock.materials_to_order.count.mockResolvedValue(5);
        prismaMock.purchase_order.count.mockResolvedValueOnce(8);

        const { kpis } = await fetchData();

        expect(prismaMock.materials_to_order.count).toHaveBeenCalledWith({
          where: { status: { in: ["DRAFT", "PARTIALLY_ORDERED"] } },
        });
        expect(prismaMock.purchase_order.count).toHaveBeenNthCalledWith(1, {
          where: { status: { in: ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"] } },
        });
        expect(kpis).toMatchObject({ openMtoCount: 5, openPoCount: 8 });
      });

      // purchase_order.count runs: open POs, ETA-late, ageing-late, has-ETA.
      it("counts late deliveries by expected delivery date when ETAs exist", async () => {
        prismaMock.purchase_order.count
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(7)
          .mockResolvedValueOnce(3);

        const { attention } = await fetchData();

        expect(attention.lateDeliveries).toEqual({
          count: 2,
          mode: "eta",
          href: "/admin/suppliers/purchaseorder",
        });
        expect(prismaMock.purchase_order.count).toHaveBeenNthCalledWith(2, {
          where: {
            status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] },
            expected_delivery_date: {
              lt: new Date("2026-07-14T14:30:00.000Z"),
            },
          },
        });
      });

      it("falls back to 21-day ageing when no PO has an ETA", async () => {
        prismaMock.purchase_order.count
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(7)
          .mockResolvedValueOnce(0);

        const { attention } = await fetchData();

        expect(attention.lateDeliveries.count).toBe(7);
        expect(attention.lateDeliveries.mode).toBe("ageing");
        expect(prismaMock.purchase_order.count).toHaveBeenNthCalledWith(3, {
          where: {
            status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] },
            ordered_at: { lt: new Date("2026-06-23T14:30:00.000Z") },
          },
        });
      });

      it("reports overdue payables as a count and a decimal-safe amount", async () => {
        prismaMock.supplier_statement.aggregate.mockResolvedValue({
          _count: { _all: 3 },
          _sum: { amount: { toString: () => "1250.50" } },
        });

        const { attention } = await fetchData();

        expect(attention.overduePayables).toEqual({
          count: 3,
          amount: "1250.50",
          href: "/admin/suppliers/statements",
        });
      });

      it("reports a zero overdue amount when nothing is summed", async () => {
        const { attention } = await fetchData();

        expect(attention.overduePayables.amount).toBe("0");
      });

      it("counts MTO lines that are not fully ordered", async () => {
        prismaMock.materials_to_order_item.findMany.mockResolvedValue([
          { quantity: 5, quantity_ordered: 5 },
          { quantity: 5, quantity_ordered: 2 },
          { quantity: 3, quantity_ordered: null },
        ]);

        const { attention } = await fetchData();

        expect(attention.unorderedMtoLines).toEqual({
          count: 2,
          href: "/admin/suppliers/materialstoorder",
        });
      });

      it("buckets pending statements by days overdue in Adelaide time", async () => {
        prismaMock.supplier_statement.findMany.mockResolvedValueOnce([
          { amount: 100, due_date: new Date("2026-07-20T12:00:00.000Z") },
          { amount: 50, due_date: new Date("2026-07-15T03:00:00.000Z") },
          { amount: 200, due_date: new Date("2026-07-14T12:00:00.000Z") },
          { amount: 300, due_date: new Date("2026-06-14T12:00:00.000Z") },
          { amount: 400, due_date: new Date("2026-05-01T12:00:00.000Z") },
        ]);

        const { procurement } = await fetchData();

        expect(procurement.payablesAgeing).toEqual({
          current: 150,
          d1_30: 200,
          d31_60: 300,
          d60plus: 400,
        });
      });

      it("maps the PO and MTO status breakdowns", async () => {
        prismaMock.purchase_order.groupBy.mockResolvedValue([
          { status: "ORDERED", _count: { _all: 4 } },
        ]);
        prismaMock.materials_to_order.groupBy.mockResolvedValue([
          { status: "DRAFT", _count: { _all: 2 } },
          { status: "CLOSED", _count: { _all: 9 } },
        ]);

        const { procurement } = await fetchData();

        expect(procurement.poByStatus).toEqual([{ status: "ORDERED", count: 4 }]);
        expect(procurement.mtoByStatus).toEqual([
          { status: "DRAFT", count: 2 },
          { status: "CLOSED", count: 9 },
        ]);
      });

      it("returns a 12-month spend series ending in the current month", async () => {
        const { procurement } = await fetchData();

        expect(procurement.spendByMonth).toHaveLength(12);
        expect(procurement.spendByMonth[0]).toEqual({
          month: "2025-08",
          poTotal: 0,
          statementTotal: 0,
        });
        expect(procurement.spendByMonth[11].month).toBe("2026-07");
        expect(prismaMock.supplier_statement.findMany).toHaveBeenCalledWith({
          where: {
            month_year: {
              in: procurement.spendByMonth.map((row) => row.month),
            },
          },
          select: { month_year: true, amount: true },
        });
      });

      it("sums PO and statement totals into their months", async () => {
        prismaMock.purchase_order.findMany.mockResolvedValue([
          { ordered_at: new Date("2026-07-10T00:00:00.000Z"), total_amount: "1000", supplier_id: "s1" },
          { ordered_at: new Date("2026-07-02T00:00:00.000Z"), total_amount: "500", supplier_id: "s1" },
          { ordered_at: new Date("2026-06-20T00:00:00.000Z"), total_amount: "300", supplier_id: "s2" },
          { ordered_at: new Date("2026-06-21T00:00:00.000Z"), total_amount: null, supplier_id: "s2" },
        ]);
        prismaMock.supplier_statement.findMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { month_year: "2026-07", amount: "40" },
            { month_year: "2026-07-01", amount: "10" },
            { month_year: "2026-06", amount: "25" },
            { month_year: "2020-01", amount: "999" },
          ]);

        const { procurement } = await fetchData();

        const byMonth = Object.fromEntries(
          procurement.spendByMonth.map((row) => [row.month, row]),
        );
        expect(byMonth["2026-07"]).toEqual({
          month: "2026-07",
          poTotal: 1500,
          statementTotal: 50,
        });
        expect(byMonth["2026-06"]).toEqual({
          month: "2026-06",
          poTotal: 300,
          statementTotal: 25,
        });
      });

      it("ranks the top suppliers by PO spend and names unknown ones", async () => {
        prismaMock.purchase_order.findMany.mockResolvedValue([
          { ordered_at: new Date("2026-07-10T00:00:00.000Z"), total_amount: "300", supplier_id: "s2" },
          { ordered_at: new Date("2026-07-10T00:00:00.000Z"), total_amount: "1000", supplier_id: "s1" },
          { ordered_at: new Date("2026-07-02T00:00:00.000Z"), total_amount: "500", supplier_id: "s1" },
        ]);
        prismaMock.supplier.findMany.mockResolvedValue([
          { supplier_id: "s1", name: "Acme Boards" },
        ]);

        const { procurement } = await fetchData();

        expect(procurement.topSuppliers).toEqual([
          { supplier_id: "s1", name: "Acme Boards", total: 1500 },
          { supplier_id: "s2", name: "Unknown supplier", total: 300 },
        ]);
        expect(prismaMock.supplier.findMany).toHaveBeenCalledWith({
          where: { supplier_id: { in: ["s1", "s2"] } },
          select: { supplier_id: true, name: true },
        });
      });

      it("keeps at most five top suppliers", async () => {
        prismaMock.purchase_order.findMany.mockResolvedValue(
          Array.from({ length: 7 }, (_, i) => ({
            ordered_at: new Date("2026-07-10T00:00:00.000Z"),
            total_amount: String((i + 1) * 100),
            supplier_id: `s${i + 1}`,
          })),
        );

        const { procurement } = await fetchData();

        expect(procurement.topSuppliers.map((s) => s.supplier_id)).toEqual([
          "s7",
          "s6",
          "s5",
          "s4",
          "s3",
        ]);
      });

      it("skips the supplier lookup when there are no POs", async () => {
        await get();

        expect(prismaMock.supplier.findMany).not.toHaveBeenCalled();
      });
    });

    describe("inventory", () => {
      const sheet = {
        item_id: "i-sheet",
        category: "SHEET",
        quantity: 2,
        minimum_stock: 10,
        measurement_unit: "SHEET",
        description: null,
        sheet: { brand: "Egger", color: "White", finish: "Matt" },
      };

      it("flags tracked items at or below their reorder point, worst first", async () => {
        prismaMock.item.findMany.mockResolvedValueOnce([
          { ...sheet, quantity: 50, item_id: "i-fine" },
          {
            item_id: "i-hinge",
            category: "HARDWARE",
            quantity: 0,
            minimum_stock: 5,
            measurement_unit: "EACH",
            description: null,
            hardware: { brand: "Blum", name: "Hinge" },
          },
          sheet,
          {
            item_id: "i-screws",
            category: "ACCESSORY",
            quantity: 1,
            minimum_stock: 4,
            measurement_unit: "EACH",
            description: "Loose screws",
          },
        ]);

        const { inventory, attention } = await fetchData();

        expect(inventory.mode).toBe("reorder");
        expect(inventory.lowStock).toEqual([
          {
            item_id: "i-sheet",
            label: "Egger White Matt",
            category: "SHEET",
            quantity: 2,
            minimum_stock: 10,
            measurement_unit: "SHEET",
            shortfall: 8,
          },
          {
            item_id: "i-hinge",
            label: "Blum Hinge",
            category: "HARDWARE",
            quantity: 0,
            minimum_stock: 5,
            measurement_unit: "EACH",
            shortfall: 5,
          },
          {
            item_id: "i-screws",
            label: "Loose screws",
            category: "ACCESSORY",
            quantity: 1,
            minimum_stock: 4,
            measurement_unit: "EACH",
            shortfall: 3,
          },
        ]);
        expect(attention.lowStock).toEqual({
          count: 3,
          mode: "reorder",
          href: "/admin/inventory",
        });
        expect(prismaMock.item.findMany).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            where: { is_deleted: false, minimum_stock: { not: null } },
            take: 300,
          }),
        );
      });

      it("limits low stock to the 8 worst items", async () => {
        prismaMock.item.findMany.mockResolvedValueOnce(
          Array.from({ length: 12 }, (_, i) => ({
            item_id: `i-${i}`,
            category: "HARDWARE",
            quantity: 0,
            minimum_stock: i + 1,
            measurement_unit: "EACH",
            description: `Item ${i}`,
          })),
        );

        const { inventory } = await fetchData();

        expect(inventory.lowStock).toHaveLength(8);
        expect(inventory.lowStock[0].item_id).toBe("i-11");
      });

      it("flags items at or below zero when no reorder points are set", async () => {
        prismaMock.item.findMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              item_id: "i-bin",
              category: "ACCESSORY",
              quantity: -3,
              minimum_stock: null,
              measurement_unit: "EACH",
              description: null,
              accessory: { name: "Bin" },
            },
          ]);

        const { inventory, attention } = await fetchData();

        expect(inventory.mode).toBe("zero");
        expect(inventory.lowStock).toEqual([
          {
            item_id: "i-bin",
            label: "Bin",
            category: "ACCESSORY",
            quantity: -3,
            minimum_stock: null,
            measurement_unit: "EACH",
            shortfall: 3,
          },
        ]);
        expect(attention.lowStock.mode).toBe("zero");
        expect(prismaMock.item.findMany).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            where: { is_deleted: false, quantity: { lte: 0 } },
            take: 50,
          }),
        );
      });

      it("labels items with no subtype or description as unnamed", async () => {
        prismaMock.item.findMany.mockResolvedValueOnce([
          {
            item_id: "i-x",
            category: "HANDLE",
            quantity: 0,
            minimum_stock: 1,
            measurement_unit: "EACH",
            description: null,
          },
        ]);

        const { inventory } = await fetchData();

        expect(inventory.lowStock[0].label).toBe("Unnamed item");
      });

      it("totals 30-day stock movement and the waste percentage", async () => {
        prismaMock.stock_transaction.groupBy.mockResolvedValue([
          { type: "ADDED", _sum: { quantity: 100 } },
          { type: "USED", _sum: { quantity: 60 } },
          { type: "WASTED", _sum: { quantity: 20 } },
        ]);

        const { inventory } = await fetchData();

        expect(inventory.movement30d).toEqual({
          ADDED: 100,
          USED: 60,
          WASTED: 20,
          wastePct: 25,
        });
        expect(prismaMock.stock_transaction.groupBy).toHaveBeenCalledWith({
          by: ["type"],
          where: { createdAt: { gte: new Date("2026-06-14T14:30:00.000Z") } },
          _sum: { quantity: true },
        });
      });

      it("rounds the waste percentage to one decimal place", async () => {
        prismaMock.stock_transaction.groupBy.mockResolvedValue([
          { type: "USED", _sum: { quantity: 2 } },
          { type: "WASTED", _sum: { quantity: 1 } },
        ]);

        const { inventory } = await fetchData();

        expect(inventory.movement30d.wastePct).toBe(33.3);
      });

      it("reports 0% waste when nothing was consumed", async () => {
        const { inventory } = await fetchData();

        expect(inventory.movement30d).toEqual({
          ADDED: 0,
          USED: 0,
          WASTED: 0,
          wastePct: 0,
        });
      });

      it("lists the most reserved items, skipping ones that no longer exist", async () => {
        prismaMock.reserve_item_stock.groupBy.mockResolvedValue([
          { item_id: "i1", _sum: { quantity: 10, used_quantity: 4 } },
          { item_id: "gone", _sum: { quantity: 8, used_quantity: 0 } },
          { item_id: "i2", _sum: { quantity: 3, used_quantity: 9 } },
        ]);
        prismaMock.item.findMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              item_id: "i1",
              quantity: 20,
              measurement_unit: "SHEET",
              description: null,
              sheet: { brand: "Egger", color: "Oak", finish: null },
            },
            {
              item_id: "i2",
              quantity: 1,
              measurement_unit: "EACH",
              description: "Edge clips",
            },
          ]);

        const { inventory } = await fetchData();

        expect(inventory.topReserved).toEqual([
          {
            item_id: "i1",
            label: "Egger Oak",
            onHand: 20,
            reserved: 6,
            measurement_unit: "SHEET",
          },
          {
            item_id: "i2",
            label: "Edge clips",
            onHand: 1,
            reserved: 0,
            measurement_unit: "EACH",
          },
        ]);
        expect(prismaMock.reserve_item_stock.groupBy).toHaveBeenCalledWith(
          expect.objectContaining({ by: ["item_id"], take: 6 }),
        );
      });
    });

    describe("punches", () => {
      it("counts punches awaiting review", async () => {
        prismaMock.clock_punch.count.mockResolvedValue(4);

        const { attention } = await fetchData();

        expect(attention.punchesToReview).toEqual({
          count: 4,
          href: "/admin/employees/punches",
        });
      });
    });

    describe("my day", () => {
      it("lists the viewer's open stages on active lots, soonest first", async () => {
        prismaMock.stage.findMany.mockResolvedValue([
          {
            stage_id: "st-1",
            name: "Assembly",
            status: "IN_PROGRESS",
            endDate: new Date("2026-07-16T00:00:00.000Z"),
            lot: {
              lot_id: "lot-1",
              name: "Lot 1",
              project: { name: "Smith Kitchen", project_id: "proj-1" },
            },
          },
          {
            stage_id: "st-2",
            name: "CNC",
            status: "NOT_STARTED",
            endDate: null,
            lot: null,
          },
        ]);

        const { myDay } = await fetchData();

        expect(myDay.stages).toEqual([
          {
            stage_id: "st-1",
            name: "Assembly",
            status: "IN_PROGRESS",
            endDate: "2026-07-16T00:00:00.000Z",
            lot: "Lot 1",
            lot_id: "lot-1",
            project: "Smith Kitchen",
            project_id: "proj-1",
          },
          {
            stage_id: "st-2",
            name: "CNC",
            status: "NOT_STARTED",
            endDate: null,
            lot: null,
            lot_id: null,
            project: null,
            project_id: null,
          },
        ]);
        expect(prismaMock.stage.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              assigned_to: { some: { employee_id: "employee-1" } },
              status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
              lot: { status: "ACTIVE", is_deleted: false },
            },
            orderBy: { endDate: "asc" },
            take: 8,
          }),
        );
      });

      it("skips the stage query when the login is not linked to an employee", async () => {
        prismaMock.users.findUnique.mockResolvedValue({
          employee_id: null,
          username: "bob",
          employee: null,
        });

        const { myDay } = await fetchData();

        expect(myDay.stages).toEqual([]);
        expect(prismaMock.stage.findMany).not.toHaveBeenCalled();
      });

      it("returns only future meetings the viewer takes part in", async () => {
        await get();

        expect(prismaMock.meeting.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              date_time: { gte: NOW },
              participants: { some: { id: "user-1" } },
            },
            orderBy: { date_time: "asc" },
            take: 5,
          }),
        );
      });

      it("maps meetings with their lots and participants", async () => {
        prismaMock.meeting.findMany.mockResolvedValue([
          {
            id: "m-1",
            title: "Site visit",
            date_time: new Date("2026-07-16T01:00:00.000Z"),
            date_time_end: new Date("2026-07-16T02:00:00.000Z"),
            lots: [
              { lot_id: "lot-1", name: "Lot 1", project: { name: "Smith Kitchen" } },
              { lot_id: "lot-2", name: "Lot 2", project: null },
            ],
            participants: [
              {
                id: "user-1",
                username: "test.user",
                employee: {
                  first_name: "Ann",
                  last_name: "Lee",
                  image: { url: "/img/ann.jpg" },
                },
              },
              { id: "user-2", username: "bob", employee: null },
            ],
          },
        ]);

        const { myDay } = await fetchData();

        expect(myDay.meetings).toEqual([
          {
            id: "m-1",
            title: "Site visit",
            date_time: "2026-07-16T01:00:00.000Z",
            date_time_end: "2026-07-16T02:00:00.000Z",
            lots: [
              { lot_id: "lot-1", name: "Lot 1", project: "Smith Kitchen" },
              { lot_id: "lot-2", name: "Lot 2", project: null },
            ],
            participants: [
              { id: "user-1", name: "Ann Lee", image: "/img/ann.jpg" },
              { id: "user-2", name: "bob", image: null },
            ],
          },
        ]);
      });
    });

    describe("activity", () => {
      it("returns the 10 most recent logs, newest first", async () => {
        await get();

        expect(prismaMock.logs.findMany).toHaveBeenCalledWith({
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                username: true,
                employee: { select: { first_name: true, last_name: true } },
              },
            },
          },
        });
      });

      it("attributes each log to an employee, a username, or the system", async () => {
        const createdAt = new Date("2026-07-15T01:00:00.000Z");
        const base = { action: "UPDATE", entity_type: "Lot", description: "d", createdAt };
        prismaMock.logs.findMany.mockResolvedValue([
          { id: "l1", ...base, user: { username: "bob", employee: { first_name: "Bob", last_name: "Ray" } } },
          { id: "l2", ...base, user: { username: "carol", employee: null } },
          { id: "l3", ...base, user: null },
        ]);

        const { activity } = await fetchData();

        expect(activity).toEqual([
          { id: "l1", ...base, createdAt: createdAt.toISOString(), user: "Bob Ray" },
          { id: "l2", ...base, createdAt: createdAt.toISOString(), user: "carol" },
          { id: "l3", ...base, createdAt: createdAt.toISOString(), user: "System" },
        ]);
      });
    });

    describe("errors", () => {
      beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it("returns 500 when a query fails", async () => {
        prismaMock.project.count.mockRejectedValue(new Error("DB down"));

        const res = await get();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal server error",
        });
      });

      it("returns 500 when the viewer lookup fails", async () => {
        prismaMock.users.findUnique.mockRejectedValue(new Error("DB down"));

        const res = await get();

        expect(res.status).toBe(500);
      });
    });
  });
});
