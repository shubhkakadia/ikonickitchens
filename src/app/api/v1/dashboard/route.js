import { NextResponse } from "next/server";
import {
  validateAdminAuth,
  getUserFromToken,
} from "@/lib/validators/authFromToken";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { prisma } from "@/lib/db";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Australia/Adelaide";

// Canonical workflow order. Stage.name is free text, so we sort the pipeline
// against this list (mirrored from the stage_* flags on notification_config)
// instead of letting groupBy return an arbitrary order.
const STAGE_ORDER = [
  "quote approve",
  "material & appliances selection",
  "drafting",
  "drafting revision",
  "final design approval",
  "site measurements",
  "final approval for production",
  "machining out",
  "material order",
  "cnc",
  "assembly",
  "delivery",
  "installation",
  "invoice sent",
  "maintenance",
  "job completion",
];

const stageRank = (name) => {
  const i = STAGE_ORDER.indexOf((name || "").trim().toLowerCase());
  return i === -1 ? STAGE_ORDER.length : i;
};

// Prisma Decimal does not survive NextResponse.json cleanly.
const dec = (value) => (value == null ? null : value.toString());
const num = (value) => (value == null ? 0 : Number(value));

// Item has no name column - the label lives on whichever subtype row exists.
const itemLabel = (item) => {
  if (!item) return "Unknown item";
  const parts =
    (item.sheet && [item.sheet.brand, item.sheet.color, item.sheet.finish]) ||
    (item.handle && [item.handle.brand, item.handle.color, item.handle.type]) ||
    (item.hardware && [item.hardware.brand, item.hardware.name]) ||
    (item.accessory && [item.accessory.name]) ||
    (item.edging_tape && [
      item.edging_tape.brand,
      item.edging_tape.color,
      item.edging_tape.finish,
    ]) ||
    [];
  const label = parts.filter(Boolean).join(" ").trim();
  return label || item.description || "Unnamed item";
};

const ITEM_SUBTYPES = {
  sheet: { select: { brand: true, color: true, finish: true } },
  handle: { select: { brand: true, color: true, type: true } },
  hardware: { select: { brand: true, name: true } },
  accessory: { select: { name: true } },
  edging_tape: { select: { brand: true, color: true, finish: true } },
};

const employeeName = (e) =>
  e ? [e.first_name, e.last_name].filter(Boolean).join(" ") : null;

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const session = await getUserFromToken(request);
    if (!session) {
      return NextResponse.json(
        { status: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = session.user_id;
    const userType = (session.user_type || "").toLowerCase();
    const isMaster = userType === "master-admin";

    const [access, viewer] = await Promise.all([
      prisma.module_access.findUnique({ where: { user_id: userId } }),
      prisma.users.findUnique({
        where: { id: userId },
        select: {
          employee_id: true,
          username: true,
          employee: { select: { first_name: true, last_name: true } },
        },
      }),
    ]);

    // master-admin bypasses module gating, matching ProtectedRoute semantics.
    const can = (...flags) =>
      isMaster || flags.some((flag) => Boolean(access?.[flag]));

    const permissions = {
      projects: can("all_projects"),
      procurement: can("purchaseorder", "statements", "materialstoorder"),
      purchaseOrders: can("purchaseorder"),
      statements: can("statements"),
      materialsToOrder: can("materialstoorder"),
      inventory: can("all_items"),
      punches: can("all_clock_punches"),
      logs: can("logs"),
    };

    const nowAdl = dayjs().tz(TZ);
    const now = nowAdl.toDate();
    const todayStart = nowAdl.startOf("day").utc().toDate();
    const in14Days = nowAdl.add(14, "day").endOf("day").utc().toDate();
    const days30Ago = nowAdl.subtract(30, "day").startOf("day").utc().toDate();
    const days21Ago = nowAdl.subtract(21, "day").startOf("day").utc().toDate();
    // Overdue lots older than this are stale enough to belong on the projects
    // page, not on a 14-day schedule.
    const overdueFloor = nowAdl.subtract(60, "day").startOf("day").utc().toDate();
    const monthStart = nowAdl.startOf("month").utc().toDate();
    const months12Ago = nowAdl
      .subtract(11, "month")
      .startOf("month")
      .utc()
      .toDate();

    const [
      projectsData,
      procurementData,
      inventoryData,
      punchesToReview,
      myDay,
      activity,
    ] = await Promise.all([
      permissions.projects
        ? buildProjects({
            todayStart,
            in14Days,
            overdueFloor,
            monthStart,
            nowAdl,
          })
        : Promise.resolve(null),
      permissions.procurement
        ? buildProcurement({
            permissions,
            todayStart,
            days21Ago,
            months12Ago,
            nowAdl,
          })
        : Promise.resolve(null),
      permissions.inventory
        ? buildInventory({ days30Ago })
        : Promise.resolve(null),
      permissions.punches
        ? prisma.clock_punch.count({ where: { review_status: "PENDING" } })
        : Promise.resolve(null),
      buildMyDay({ userId, employeeId: viewer?.employee_id, now }),
      permissions.logs
        ? prisma.logs.findMany({
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
          })
        : Promise.resolve(null),
    ]);

    // Employee name when the login is linked to one, username otherwise.
    const displayName =
      employeeName(viewer?.employee) || viewer?.username || null;

    const attention = {};
    if (projectsData) {
      attention.overdueInstalls = {
        count: projectsData.overdueInstalls,
        href: "/admin/projects/lotatglance",
      };
      attention.overdueStages = {
        count: projectsData.overdueStages,
        href: "/admin/projects",
      };
    }
    if (procurementData) {
      if (permissions.purchaseOrders) {
        attention.lateDeliveries = {
          count: procurementData.lateDeliveries.count,
          mode: procurementData.lateDeliveries.mode,
          href: "/admin/suppliers/purchaseorder",
        };
      }
      if (permissions.statements) {
        attention.overduePayables = {
          count: procurementData.overduePayables.count,
          amount: procurementData.overduePayables.amount,
          href: "/admin/suppliers/statements",
        };
      }
      if (permissions.materialsToOrder) {
        attention.unorderedMtoLines = {
          count: procurementData.unorderedMtoLines,
          href: "/admin/suppliers/materialstoorder",
        };
      }
    }
    if (inventoryData) {
      attention.lowStock = {
        count: inventoryData.lowStock.length,
        mode: inventoryData.mode,
        href: "/admin/inventory",
      };
    }
    if (punchesToReview != null) {
      attention.punchesToReview = {
        count: punchesToReview,
        href: "/admin/employees/punches",
      };
    }

    return NextResponse.json(
      {
        status: true,
        message: "Dashboard fetched successfully",
        data: {
          generatedAt: new Date().toISOString(),
          viewer: {
            name: displayName,
            username: viewer?.username ?? null,
            isEmployeeLinked: Boolean(viewer?.employee_id),
          },
          permissions,
          attention,
          kpis: {
            ...(projectsData?.kpis ?? {}),
            ...(procurementData?.kpis ?? {}),
          },
          schedule: projectsData?.schedule ?? [],
          pipeline: projectsData?.pipeline ?? null,
          myDay,
          procurement: procurementData
            ? {
                spendByMonth: procurementData.spendByMonth,
                topSuppliers: procurementData.topSuppliers,
                poByStatus: procurementData.poByStatus,
                mtoByStatus: procurementData.mtoByStatus,
                payablesAgeing: procurementData.payablesAgeing,
              }
            : null,
          inventory: inventoryData
            ? {
                mode: inventoryData.mode,
                lowStock: inventoryData.lowStock,
                movement30d: inventoryData.movement30d,
                topReserved: inventoryData.topReserved,
              }
            : null,
          activity: (activity ?? []).map((log) => ({
            id: log.id,
            action: log.action,
            entity_type: log.entity_type,
            description: log.description,
            createdAt: log.createdAt,
            user:
              employeeName(log.user?.employee) || log.user?.username || "System",
          })),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/v1/dashboard:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

async function buildProjects({
  todayStart,
  in14Days,
  overdueFloor,
  monthStart,
  nowAdl,
}) {
  const activeLot = { status: "ACTIVE", is_deleted: false };

  const [
    overdueInstalls,
    overdueStages,
    scheduleLots,
    byStage,
    lotStatus,
    activeProjects,
    completedThisMonth,
  ] = await Promise.all([
      prisma.lot.count({
        where: { ...activeLot, installationDueDate: { lt: todayStart } },
      }),
      prisma.stage.count({
        where: {
          status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
          endDate: { lt: todayStart },
          lot: activeLot,
        },
      }),
      prisma.lot.findMany({
        where: {
          ...activeLot,
          installationDueDate: { gte: overdueFloor, lte: in14Days },
        },
        select: {
          lot_id: true,
          name: true,
          installationDueDate: true,
          project: { select: { name: true, project_id: true } },
          installer: { select: { first_name: true, last_name: true } },
          stages: { select: { status: true } },
        },
        orderBy: { installationDueDate: "asc" },
        take: 40,
      }),
      prisma.stage.groupBy({
        by: ["name"],
        where: { status: "IN_PROGRESS", lot: activeLot },
        _count: { _all: true },
      }),
      prisma.lot.groupBy({
        by: ["status"],
        where: { is_deleted: false },
        _count: { _all: true },
      }),
      prisma.project.count({
        where: { is_deleted: false, lots: { some: activeLot } },
      }),
      prisma.lot.count({
        where: {
          is_deleted: false,
          status: "COMPLETED",
          updatedAt: { gte: monthStart },
        },
      }),
    ]);

  const startOfToday = nowAdl.startOf("day");
  const schedule = scheduleLots.map((lot) => {
    const countable = lot.stages.filter((s) => s.status !== "NA");
    const done = countable.filter((s) => s.status === "DONE").length;
    const due = lot.installationDueDate;
    return {
      lot_id: lot.lot_id,
      name: lot.name,
      project: lot.project?.name ?? "—",
      project_id: lot.project?.project_id ?? null,
      installationDueDate: due,
      installer: employeeName(lot.installer),
      stagesDone: done,
      stagesTotal: countable.length,
      daysLeft: dayjs(due).tz(TZ).startOf("day").diff(startOfToday, "day"),
    };
  });

  return {
    overdueInstalls,
    overdueStages,
    kpis: {
      activeProjects,
      activeLots: lotStatus.find((r) => r.status === "ACTIVE")?._count._all ?? 0,
      completedThisMonth,
    },
    schedule,
    pipeline: {
      byStage: byStage
        .map((row) => ({
          name: row.name,
          count: row._count._all,
          order: stageRank(row.name),
        }))
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
      lotStatus: lotStatus.reduce(
        (acc, row) => ({ ...acc, [row.status]: row._count._all }),
        { ACTIVE: 0, COMPLETED: 0, CANCELLED: 0 },
      ),
    },
  };
}

async function buildProcurement({
  permissions,
  todayStart,
  days21Ago,
  months12Ago,
  nowAdl,
}) {
  const openPo = { in: ["ORDERED", "PARTIALLY_RECEIVED"] };
  const monthKeys = Array.from({ length: 12 }, (_, i) =>
    nowAdl.subtract(11 - i, "month").format("YYYY-MM"),
  );

  const [
    openMtoCount,
    openPoCount,
    etaLate,
    ageingLate,
    hasEta,
    overduePayables,
    pendingStatements,
    poByStatus,
    mtoByStatus,
    openMtoItems,
    recentPos,
    statementSpend,
  ] = await Promise.all([
    prisma.materials_to_order.count({
      where: { status: { in: ["DRAFT", "PARTIALLY_ORDERED"] } },
    }),
    prisma.purchase_order.count({
      where: { status: { in: ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"] } },
    }),
    prisma.purchase_order.count({
      where: { status: openPo, expected_delivery_date: { lt: todayStart } },
    }),
    prisma.purchase_order.count({
      where: { status: openPo, ordered_at: { lt: days21Ago } },
    }),
    prisma.purchase_order.count({
      where: { status: openPo, expected_delivery_date: { not: null } },
    }),
    prisma.supplier_statement.aggregate({
      where: { payment_status: "PENDING", due_date: { lt: todayStart } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.supplier_statement.findMany({
      where: { payment_status: "PENDING" },
      select: { amount: true, due_date: true },
      take: 500,
    }),
    prisma.purchase_order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.materials_to_order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    // Prisma cannot compare two columns, so count the shortfall in JS over the
    // bounded set of lines belonging to still-open MTOs.
    prisma.materials_to_order_item.findMany({
      where: { mto: { status: { in: ["DRAFT", "PARTIALLY_ORDERED"] } } },
      select: { quantity: true, quantity_ordered: true },
    }),
    prisma.purchase_order.findMany({
      where: {
        status: { not: "CANCELLED" },
        ordered_at: { gte: months12Ago },
      },
      select: { ordered_at: true, total_amount: true, supplier_id: true },
    }),
    prisma.supplier_statement.findMany({
      where: { month_year: { in: monthKeys } },
      select: { month_year: true, amount: true },
    }),
  ]);

  // Prefer real ETAs; fall back to ageing while the column is unpopulated.
  const mode = hasEta > 0 ? "eta" : "ageing";

  const poByMonth = new Map(monthKeys.map((k) => [k, 0]));
  const stByMonth = new Map(monthKeys.map((k) => [k, 0]));
  const bySupplier = new Map();

  for (const po of recentPos) {
    const key = dayjs(po.ordered_at).tz(TZ).format("YYYY-MM");
    if (poByMonth.has(key)) poByMonth.set(key, poByMonth.get(key) + num(po.total_amount));
    bySupplier.set(
      po.supplier_id,
      (bySupplier.get(po.supplier_id) ?? 0) + num(po.total_amount),
    );
  }
  for (const st of statementSpend) {
    const key = (st.month_year || "").slice(0, 7);
    if (stByMonth.has(key)) stByMonth.set(key, stByMonth.get(key) + num(st.amount));
  }

  const topSupplierIds = [...bySupplier.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const supplierNames = topSupplierIds.length
    ? await prisma.supplier.findMany({
        where: { supplier_id: { in: topSupplierIds.map(([id]) => id) } },
        select: { supplier_id: true, name: true },
      })
    : [];
  const nameById = new Map(supplierNames.map((s) => [s.supplier_id, s.name]));

  const ageing = { current: 0, d1_30: 0, d31_60: 0, d60plus: 0 };
  const startOfToday = nowAdl.startOf("day");
  for (const st of pendingStatements) {
    const overdueDays = startOfToday.diff(
      dayjs(st.due_date).tz(TZ).startOf("day"),
      "day",
    );
    const amount = num(st.amount);
    if (overdueDays <= 0) ageing.current += amount;
    else if (overdueDays <= 30) ageing.d1_30 += amount;
    else if (overdueDays <= 60) ageing.d31_60 += amount;
    else ageing.d60plus += amount;
  }

  return {
    kpis: { openMtoCount, openPoCount },
    lateDeliveries: { count: mode === "eta" ? etaLate : ageingLate, mode },
    overduePayables: {
      count: overduePayables._count._all,
      amount: dec(overduePayables._sum.amount) ?? "0",
    },
    unorderedMtoLines: openMtoItems.filter(
      (line) => (line.quantity_ordered ?? 0) < line.quantity,
    ).length,
    poByStatus: poByStatus.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    mtoByStatus: mtoByStatus.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    spendByMonth: monthKeys.map((month) => ({
      month,
      poTotal: poByMonth.get(month) ?? 0,
      statementTotal: stByMonth.get(month) ?? 0,
    })),
    topSuppliers: topSupplierIds.map(([supplier_id, total]) => ({
      supplier_id,
      name: nameById.get(supplier_id) ?? "Unknown supplier",
      total,
    })),
    payablesAgeing: ageing,
  };
}

async function buildInventory({ days30Ago }) {
  const [tracked, movement, reserved] = await Promise.all([
    prisma.item.findMany({
      where: { is_deleted: false, minimum_stock: { not: null } },
      select: {
        item_id: true,
        category: true,
        quantity: true,
        minimum_stock: true,
        measurement_unit: true,
        description: true,
        ...ITEM_SUBTYPES,
      },
      take: 300,
    }),
    prisma.stock_transaction.groupBy({
      by: ["type"],
      where: { createdAt: { gte: days30Ago } },
      _sum: { quantity: true },
    }),
    prisma.reserve_item_stock.groupBy({
      by: ["item_id"],
      _sum: { quantity: true, used_quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 6,
    }),
  ]);

  // Real reorder points where they exist, otherwise flag anything at or below zero.
  const mode = tracked.length > 0 ? "reorder" : "zero";
  let candidates = tracked;
  if (mode === "zero") {
    candidates = await prisma.item.findMany({
      where: { is_deleted: false, quantity: { lte: 0 } },
      select: {
        item_id: true,
        category: true,
        quantity: true,
        minimum_stock: true,
        measurement_unit: true,
        description: true,
        ...ITEM_SUBTYPES,
      },
      take: 50,
    });
  }

  const lowStock = candidates
    .map((item) => {
      const qty = num(item.quantity);
      const min = num(item.minimum_stock);
      return {
        item_id: item.item_id,
        label: itemLabel(item),
        category: item.category,
        quantity: qty,
        minimum_stock: item.minimum_stock == null ? null : min,
        measurement_unit: item.measurement_unit,
        shortfall: mode === "reorder" ? Math.max(0, min - qty) : Math.abs(qty),
      };
    })
    .filter((row) => (mode === "reorder" ? row.quantity <= row.minimum_stock : true))
    .sort((a, b) => b.shortfall - a.shortfall)
    .slice(0, 8);

  const movement30d = { ADDED: 0, USED: 0, WASTED: 0, wastePct: 0 };
  for (const row of movement) {
    movement30d[row.type] = num(row._sum.quantity);
  }
  const consumed = movement30d.USED + movement30d.WASTED;
  movement30d.wastePct =
    consumed > 0 ? Math.round((movement30d.WASTED / consumed) * 1000) / 10 : 0;

  const reservedItems = reserved.length
    ? await prisma.item.findMany({
        where: { item_id: { in: reserved.map((r) => r.item_id) } },
        select: {
          item_id: true,
          quantity: true,
          measurement_unit: true,
          description: true,
          ...ITEM_SUBTYPES,
        },
      })
    : [];
  const itemById = new Map(reservedItems.map((i) => [i.item_id, i]));

  return {
    mode,
    lowStock,
    movement30d,
    topReserved: reserved
      .filter((r) => itemById.has(r.item_id))
      .map((r) => {
        const item = itemById.get(r.item_id);
        const total = num(r._sum.quantity);
        const used = num(r._sum.used_quantity);
        return {
          item_id: r.item_id,
          label: itemLabel(item),
          onHand: num(item.quantity),
          reserved: Math.max(0, total - used),
          measurement_unit: item.measurement_unit,
        };
      }),
  };
}

async function buildMyDay({ userId, employeeId, now }) {
  const [stages, meetings] = await Promise.all([
    employeeId
      ? prisma.stage.findMany({
          where: {
            assigned_to: { some: { employee_id: employeeId } },
            status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
            lot: { status: "ACTIVE", is_deleted: false },
          },
          select: {
            stage_id: true,
            name: true,
            status: true,
            endDate: true,
            lot: {
              select: {
                lot_id: true,
                name: true,
                project: { select: { name: true, project_id: true } },
              },
            },
          },
          orderBy: { endDate: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
    prisma.meeting.findMany({
      where: { date_time: { gte: now }, participants: { some: { id: userId } } },
      orderBy: { date_time: "asc" },
      take: 5,
      include: {
        participants: {
          select: {
            id: true,
            username: true,
            employee: {
              select: {
                first_name: true,
                last_name: true,
                image: { select: { url: true } },
              },
            },
          },
        },
        lots: {
          select: {
            lot_id: true,
            name: true,
            project: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return {
    stages: stages.map((s) => ({
      stage_id: s.stage_id,
      name: s.name,
      status: s.status,
      endDate: s.endDate,
      lot: s.lot?.name ?? null,
      lot_id: s.lot?.lot_id ?? null,
      project: s.lot?.project?.name ?? null,
      project_id: s.lot?.project?.project_id ?? null,
    })),
    meetings: meetings.map((m) => ({
      id: m.id,
      title: m.title,
      date_time: m.date_time,
      date_time_end: m.date_time_end,
      lots: m.lots.map((l) => ({
        lot_id: l.lot_id,
        name: l.name,
        project: l.project?.name ?? null,
      })),
      participants: m.participants.map((p) => ({
        id: p.id,
        name: employeeName(p.employee) || p.username,
        image: p.employee?.image?.url ?? null,
      })),
    })),
  };
}
