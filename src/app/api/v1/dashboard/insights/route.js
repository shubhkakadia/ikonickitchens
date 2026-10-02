import { NextResponse } from "next/server";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { prisma } from "@/lib/db";
import { authorizeRequest, hasModule } from "@/lib/validators/authFromToken";
import {
  TZ,
  employeeName,
  ITEM_SUBTYPES,
  itemLabel,
  normaliseStage,
  num,
  stageRank,
} from "@/lib/dashboard";

dayjs.extend(utc);
dayjs.extend(timezone);

// Trend data for the dashboard's Insights tabs. Split out of /api/v1/dashboard
// so the first paint only waits for the headline numbers; each tab loads its
// own charts on demand.
const SECTIONS = {
  production: (auth) => hasModule(auth, "all_projects"),
  procurement: (auth) =>
    ["purchaseorder", "statements", "materialstoorder"].some((key) =>
      hasModule(auth, key),
    ),
  inventory: (auth) => hasModule(auth, "all_items"),
};

const FORECAST_WEEKS = 8;
const TREND_WEEKS = 12;

export async function GET(request) {
  try {
    const { auth, error } = await authorizeRequest(request, {
      modules: ["dashboard"],
    });
    if (error) return error;

    const section = request.nextUrl.searchParams.get("section");
    if (!SECTIONS[section]) {
      return NextResponse.json(
        { status: false, message: "Unknown insights section" },
        { status: 400 },
      );
    }
    if (!SECTIONS[section](auth)) {
      return NextResponse.json(
        { status: false, message: "Insufficient permissions" },
        { status: 403 },
      );
    }

    const nowAdl = dayjs().tz(TZ);
    const data =
      section === "production"
        ? await buildProduction(nowAdl)
        : section === "procurement"
          ? await buildProcurement(nowAdl, auth)
          : await buildInventory(nowAdl);

    return NextResponse.json(
      {
        status: true,
        message: "Insights fetched successfully",
        data: { section, generatedAt: new Date().toISOString(), ...data },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/v1/dashboard/insights:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

// Monday 00:00 Adelaide of the week containing `d`.
const weekStart = (d) => d.subtract((d.day() + 6) % 7, "day").startOf("day");

const monthKeys = (nowAdl, count = 12) =>
  Array.from({ length: count }, (_, i) =>
    nowAdl.subtract(count - 1 - i, "month").format("YYYY-MM"),
  );

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
};

const round1 = (value) => Math.round(num(value) * 10) / 10;

async function buildProduction(nowAdl) {
  const activeLot = { status: "ACTIVE", is_deleted: false };
  const today = nowAdl.startOf("day");
  const todayStart = today.utc().toDate();
  const thisWeek = weekStart(nowAdl);
  const forecastEnd = thisWeek.add(FORECAST_WEEKS, "week");
  const overdueFloor = today.subtract(60, "day").utc().toDate();
  const months = monthKeys(nowAdl);
  const months12Ago = nowAdl
    .subtract(11, "month")
    .startOf("month")
    .utc()
    .toDate();
  const months6Ago = nowAdl.subtract(6, "month").startOf("day").utc().toDate();

  const [dueLots, createdLots, completedLots, activeLots, stageDurations] =
    await Promise.all([
      prisma.lot.findMany({
        where: {
          ...activeLot,
          installationDueDate: {
            gte: overdueFloor,
            lt: forecastEnd.utc().toDate(),
          },
        },
        select: {
          installationDueDate: true,
          installer: { select: { first_name: true, last_name: true } },
        },
      }),
      prisma.lot.findMany({
        where: { is_deleted: false, createdAt: { gte: months12Ago } },
        select: { createdAt: true },
      }),
      // updatedAt is the closest thing to a completion timestamp the schema
      // keeps; the existing "completed this month" KPI uses the same column.
      prisma.lot.findMany({
        where: {
          is_deleted: false,
          status: "COMPLETED",
          updatedAt: { gte: months12Ago },
        },
        select: { createdAt: true, startDate: true, updatedAt: true },
      }),
      prisma.lot.findMany({
        where: activeLot,
        select: {
          stages: { select: { name: true, status: true, endDate: true } },
        },
        take: 2000,
      }),
      prisma.$queryRaw`
        SELECT LOWER(TRIM(name)) AS name,
               AVG(DATEDIFF(endDate, startDate)) AS avg_days,
               COUNT(*) AS samples
        FROM stage
        WHERE status = 'DONE'
          AND startDate IS NOT NULL
          AND endDate IS NOT NULL
          AND endDate >= startDate
          AND endDate >= ${months6Ago}
        GROUP BY LOWER(TRIM(name))
      `,
    ]);

  // Installation forecast: everything already late in one bar, then one bar
  // per week so the team can see capacity crunches coming.
  const weeks = Array.from({ length: FORECAST_WEEKS }, (_, i) => {
    const start = thisWeek.add(i, "week");
    return { start, week: start.format("YYYY-MM-DD"), count: 0 };
  });
  let overdue = 0;
  const installerLoad = new Map();
  const loadEnd = today.add(28, "day");
  for (const lot of dueLots) {
    const due = dayjs(lot.installationDueDate).tz(TZ);
    if (due.isBefore(today)) {
      overdue += 1;
    } else {
      const index = Math.floor(due.diff(thisWeek, "day") / 7);
      if (weeks[index]) weeks[index].count += 1;
    }
    if (due.isBefore(loadEnd)) {
      const name = employeeName(lot.installer) || "Unassigned";
      installerLoad.set(name, (installerLoad.get(name) ?? 0) + 1);
    }
  }

  // Throughput: lots opened vs lots completed per month.
  const throughput = new Map(
    months.map((m) => [m, { month: m, created: 0, completed: 0, cycle: [] }]),
  );
  for (const lot of createdLots) {
    const row = throughput.get(dayjs(lot.createdAt).tz(TZ).format("YYYY-MM"));
    if (row) row.created += 1;
  }
  const cycleDays = [];
  for (const lot of completedLots) {
    const done = dayjs(lot.updatedAt).tz(TZ);
    const row = throughput.get(done.format("YYYY-MM"));
    if (row) row.completed += 1;
    const days = done.diff(dayjs(lot.startDate ?? lot.createdAt), "day");
    if (days >= 0) {
      cycleDays.push(days);
      row?.cycle.push(days);
    }
  }

  // Where each active lot actually sits: its first unfinished stage in
  // workflow order, split by whether that stage is past its end date.
  const current = new Map();
  let allDone = 0;
  for (const lot of activeLots) {
    const open = lot.stages
      .filter((s) => s.status === "NOT_STARTED" || s.status === "IN_PROGRESS")
      .sort((a, b) => stageRank(a.name) - stageRank(b.name));
    if (open.length === 0) {
      if (lot.stages.length > 0) allDone += 1;
      continue;
    }
    const stage = open[0];
    const key = normaliseStage(stage.name);
    const row = current.get(key) ?? {
      name: stage.name.trim(),
      order: stageRank(stage.name),
      onTrack: 0,
      overdue: 0,
    };
    if (stage.endDate && stage.endDate < todayStart) row.overdue += 1;
    else row.onTrack += 1;
    current.set(key, row);
  }

  return {
    forecast: {
      overdue,
      weeks: weeks.map(({ week, count }) => ({ week, count })),
    },
    installerLoad: [...installerLoad.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    throughput: [...throughput.values()].map(({ cycle, ...row }) => ({
      ...row,
      medianCycleDays: median(cycle),
    })),
    cycleTime: { medianDays: median(cycleDays), samples: cycleDays.length },
    currentStage: [...current.values()].sort(
      (a, b) => a.order - b.order || a.name.localeCompare(b.name),
    ),
    readyToClose: allDone,
    stageDurations: stageDurations
      .map((row) => ({
        name: row.name,
        avgDays: round1(row.avg_days),
        samples: num(row.samples),
        order: stageRank(row.name),
      }))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
  };
}

async function buildProcurement(nowAdl, auth) {
  if (!hasModule(auth, "purchaseorder")) {
    return { spendByCategory: [], leadTimes: [] };
  }
  const months12Ago = nowAdl
    .subtract(11, "month")
    .startOf("month")
    .utc()
    .toDate();

  const [byCategory, leadTimes] = await Promise.all([
    prisma.$queryRaw`
      SELECT i.category AS category,
             SUM(COALESCE(poi.total_amount, poi.unit_price * poi.quantity, 0)) AS total
      FROM purchase_order_item poi
      JOIN purchase_order po ON po.id = poi.order_id
      JOIN item i ON i.item_id = poi.item_id
      WHERE po.status <> 'CANCELLED'
        AND po.ordered_at >= ${months12Ago}
      GROUP BY i.category
    `,
    // Lead time = order date to the first stock receipt against the PO.
    prisma.$queryRaw`
      SELECT t.supplier_id AS supplier_id,
             s.name AS name,
             AVG(t.lead_days) AS avg_days,
             COUNT(*) AS orders
      FROM (
        SELECT po.supplier_id,
               DATEDIFF(MIN(st.createdAt), po.ordered_at) AS lead_days
        FROM purchase_order po
        JOIN stock_transaction st
          ON st.purchase_order_id = po.id AND st.type = 'ADDED'
        WHERE po.status <> 'CANCELLED'
          AND po.ordered_at >= ${months12Ago}
        GROUP BY po.id, po.supplier_id, po.ordered_at
      ) t
      JOIN supplier s ON s.supplier_id = t.supplier_id
      WHERE t.lead_days >= 0
      GROUP BY t.supplier_id, s.name
      ORDER BY orders DESC
      LIMIT 8
    `,
  ]);

  return {
    spendByCategory: byCategory
      .map((row) => ({ category: row.category, total: num(row.total) }))
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total),
    leadTimes: leadTimes
      .map((row) => ({
        supplier_id: row.supplier_id,
        name: row.name,
        avgDays: round1(row.avg_days),
        orders: num(row.orders),
      }))
      .sort((a, b) => b.avgDays - a.avgDays),
  };
}

async function buildInventory(nowAdl) {
  const firstWeek = weekStart(nowAdl).subtract(TREND_WEEKS - 1, "week");
  const days90Ago = nowAdl.subtract(90, "day").startOf("day").utc().toDate();
  // Group by Adelaide calendar day in SQL; MySQL time zone tables are not
  // guaranteed to be loaded, so shift by the current offset instead.
  const offset = nowAdl.utcOffset();

  const [daily, consumed, byCategory] = await Promise.all([
    prisma.$queryRaw`
      SELECT DATE_FORMAT(DATE_ADD(createdAt, INTERVAL ${offset} MINUTE), '%Y-%m-%d') AS day,
             type,
             SUM(quantity) AS qty
      FROM stock_transaction
      WHERE createdAt >= ${firstWeek.utc().toDate()}
      GROUP BY day, type
    `,
    prisma.stock_transaction.groupBy({
      by: ["item_id"],
      where: { type: "USED", createdAt: { gte: days90Ago } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
    prisma.$queryRaw`
      SELECT i.category AS category, st.type AS type, SUM(st.quantity) AS qty
      FROM stock_transaction st
      JOIN item i ON i.item_id = st.item_id
      WHERE st.createdAt >= ${days90Ago}
        AND st.type IN ('USED', 'WASTED')
      GROUP BY i.category, st.type
    `,
  ]);

  const weeks = Array.from({ length: TREND_WEEKS }, (_, i) => ({
    week: firstWeek.add(i, "week").format("YYYY-MM-DD"),
    ADDED: 0,
    USED: 0,
    WASTED: 0,
  }));
  for (const row of daily) {
    const index = Math.floor(dayjs.tz(row.day, TZ).diff(firstWeek, "day") / 7);
    if (weeks[index] && row.type in weeks[index]) {
      weeks[index][row.type] += num(row.qty);
    }
  }

  const items = consumed.length
    ? await prisma.item.findMany({
        where: { item_id: { in: consumed.map((r) => r.item_id) } },
        select: {
          item_id: true,
          category: true,
          measurement_unit: true,
          description: true,
          ...ITEM_SUBTYPES,
        },
      })
    : [];
  const itemById = new Map(items.map((i) => [i.item_id, i]));

  const categories = new Map();
  for (const row of byCategory) {
    const entry = categories.get(row.category) ?? {
      category: row.category,
      used: 0,
      wasted: 0,
    };
    if (row.type === "USED") entry.used += num(row.qty);
    else entry.wasted += num(row.qty);
    categories.set(row.category, entry);
  }

  return {
    movementWeekly: weeks,
    topConsumed: consumed
      .filter((r) => itemById.has(r.item_id))
      .map((r) => {
        const item = itemById.get(r.item_id);
        return {
          item_id: r.item_id,
          label: itemLabel(item),
          category: item.category,
          used: num(r._sum.quantity),
          measurement_unit: item.measurement_unit,
        };
      }),
    wasteByCategory: [...categories.values()]
      .map((row) => {
        const total = row.used + row.wasted;
        return {
          ...row,
          wastePct:
            total > 0 ? Math.round((row.wasted / total) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.wastePct - a.wastePct),
  };
}
