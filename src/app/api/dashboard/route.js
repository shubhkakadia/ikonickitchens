import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../lib/validators/authFromToken";

// Helper function to convert month name/number to two-digit format
function normalizeMonth(month) {
  if (!month || month.toString().toLowerCase() === "all") return null;

  const monthMap = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };

  const monthLower = month.toString().toLowerCase().trim();

  // Check if it's a month name
  if (monthMap[monthLower]) {
    return monthMap[monthLower];
  }

  // Check if it's a number
  const monthNum = parseInt(month, 10);
  if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
    return monthNum.toString().padStart(2, "0");
  }

  // If it's already in two-digit format (e.g., "01", "11")
  if (/^\d{2}$/.test(month.toString()) && parseInt(month, 10) >= 1 && parseInt(month, 10) <= 12) {
    return month.toString();
  }

  return null;
}

// Helper function to build month_year filter array
function buildMonthYearFilter(year, month) {
  const normalizedMonth = normalizeMonth(month);
  const isYearAll = !year || year.toString().toLowerCase() === "all";
  const isMonthAll = !normalizedMonth;

  // If both are "all", return empty array (no filter)
  if (isYearAll && isMonthAll) {
    return [];
  }

  // If year is "all" but month is specific, we need to get all years with that month
  // This requires a different query approach - we'll handle it separately
  if (isYearAll && !isMonthAll) {
    return null; // Special case - use endsWith
  }

  // If year is specific and month is "all", get all 12 months for that year
  if (!isYearAll && isMonthAll) {
    return [
      `${year}-01`,
      `${year}-02`,
      `${year}-03`,
      `${year}-04`,
      `${year}-05`,
      `${year}-06`,
      `${year}-07`,
      `${year}-08`,
      `${year}-09`,
      `${year}-10`,
      `${year}-11`,
      `${year}-12`,
    ];
  }

  // If both are specific, return single month-year combination
  if (!isYearAll && !isMonthAll) {
    return [`${year}-${normalizedMonth}`];
  }

  return [];
}

// Helper function to build date range filter for DateTime fields
function buildDateRangeFilter(year, month) {
  const isYearAll = !year || year.toString().toLowerCase() === "all";
  const normalizedMonth = normalizeMonth(month);
  const isMonthAll = !normalizedMonth;

  // If both are "all", return empty object (no filter)
  if (isYearAll && isMonthAll) {
    return {};
  }

  // If year is "all" but month is specific, we can't easily filter by date range
  // For this case, we'll return null to indicate special handling is needed
  // (This case is complex and would require raw SQL or multiple queries)
  if (isYearAll && !isMonthAll) {
    return null; // Special case - skip date filtering for this scenario
  }

  // If year is specific and month is "all", filter by entire year
  if (!isYearAll && isMonthAll) {
    return {
      gte: new Date(`${year}-01-01T00:00:00.000Z`),
      lt: new Date(`${parseInt(year) + 1}-01-01T00:00:00.000Z`),
    };
  }

  // If both are specific, filter by specific month and year
  if (!isYearAll && !isMonthAll) {
    const monthNum = parseInt(normalizedMonth, 10);
    const startDate = new Date(`${year}-${normalizedMonth}-01T00:00:00.000Z`);
    const endDate = new Date(
      monthNum === 12
        ? `${parseInt(year) + 1}-01-01T00:00:00.000Z`
        : `${year}-${String(monthNum + 1).padStart(2, "0")}-01T00:00:00.000Z`
    );
    return {
      gte: startDate,
      lt: endDate,
    };
  }

  return {};
}

export async function POST(request) {
  try {
    const admin = await isAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { status: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    if (await isSessionExpired(request)) {
      return NextResponse.json(
        { status: false, message: "Session expired" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { month, year } = body;

    // Build date range filter for DateTime fields
    const dateRangeFilter = buildDateRangeFilter(year, month);

    const dashboardData = {
      activeProjects: 0,
      activeLots: 0,
      activeMTOs: 0,
      activePurchaseOrders: 0,
      totalSpent: 0,
      lotsByStage: {},
      MTOsByStatus: {},
      purchaseOrdersByStatus: {},
      top10items: {},
      top10itemsCount: {},
      topstagesDue: {},
    };

    // Build where clause for active projects (filter by lot startDate or createdAt)
    const activeProjectsWhere = {
      lots: {
        some: {
          status: "ACTIVE",
          ...(dateRangeFilter && Object.keys(dateRangeFilter).length > 0 && {
            OR: [
              { startDate: dateRangeFilter },
              { createdAt: dateRangeFilter },
            ],
          }),
        },
      },
    };

    dashboardData.activeProjects = await prisma.project.count({
      where: activeProjectsWhere,
    });

    // Build where clause for active lots (filter by startDate or createdAt)
    const activeLotsWhere = {
      status: "ACTIVE",
      ...(dateRangeFilter && Object.keys(dateRangeFilter).length > 0 && {
        OR: [
          { startDate: dateRangeFilter },
          { createdAt: dateRangeFilter },
        ],
      }),
    };

    dashboardData.activeLots = await prisma.lot.count({
      where: activeLotsWhere,
    });

    // Build where clause for active MTOs (filter by createdAt)
    const activeMTOsWhere = {
      status: {
        in: ["DRAFT", "PARTIALLY_ORDERED"],
      },
      ...(dateRangeFilter && Object.keys(dateRangeFilter).length > 0 && {
        createdAt: dateRangeFilter,
      }),
    };

    dashboardData.activeMTOs = await prisma.materials_to_order.count({
      where: activeMTOsWhere,
    });

    // Build where clause for active purchase orders (filter by createdAt or ordered_at)
    const activePurchaseOrdersWhere = {
      status: {
        in: ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"],
      },
      ...(dateRangeFilter && Object.keys(dateRangeFilter).length > 0 && {
        OR: [
          { createdAt: dateRangeFilter },
          { ordered_at: dateRangeFilter },
        ],
      }),
    };

    dashboardData.activePurchaseOrders = await prisma.purchase_order.count({
      where: activePurchaseOrdersWhere,
    });

    // Filter supplier statements based on month and year
    const monthYearFilter = buildMonthYearFilter(year, month);
    const isYearAll = !year || year.toString().toLowerCase() === "all";
    const normalizedMonth = normalizeMonth(month);
    const isMonthAll = !normalizedMonth;

    let totalSpentWhere = {};

    // Special case: year is "all" but month is specific
    if (isYearAll && !isMonthAll) {
      // Use endsWith to match all years with the specific month
      totalSpentWhere = {
        month_year: {
          endsWith: `-${normalizedMonth}`,
        },
      };
    } else if (monthYearFilter && monthYearFilter.length > 0) {
      // Use "in" operator for specific month-year combinations
      totalSpentWhere = {
        month_year: {
          in: monthYearFilter,
        },
      };
    }
    // If both are "all", totalSpentWhere remains empty object (no filter)

    dashboardData.totalSpent = await prisma.supplier_statement.findMany({
      where: totalSpentWhere,
      select: {
        month_year: true,
        supplier: {
          select: {
            name: true,
          },
        },
        amount: true,
      },
    });

    // Build where clause for lots by stage (filter by stage startDate or endDate)
    const lotsByStageWhere = {
      lot: {
        status: "ACTIVE",
      },
      ...(dateRangeFilter && Object.keys(dateRangeFilter).length > 0 && {
        OR: [
          { startDate: dateRangeFilter },
          { endDate: dateRangeFilter },
        ],
      }),
    };

    // lot count by stages
    dashboardData.lotsByStage = await prisma.stage.groupBy({
      by: ["name"],
      where: lotsByStageWhere,
      _count: true,
    });

    // Build where clause for MTOs by status (filter by createdAt)
    const mtosByStatusWhere = {
      ...(dateRangeFilter && Object.keys(dateRangeFilter).length > 0 && {
        createdAt: dateRangeFilter,
      }),
    };

    dashboardData.MTOsByStatus = await prisma.materials_to_order.groupBy({
      by: ["status"],
      where: mtosByStatusWhere,
      _count: true,
    });

    // Build where clause for purchase orders by status (filter by createdAt or ordered_at)
    const posByStatusWhere = {
      ...(dateRangeFilter && Object.keys(dateRangeFilter).length > 0 && {
        OR: [
          { createdAt: dateRangeFilter },
          { ordered_at: dateRangeFilter },
        ],
      }),
    };

    dashboardData.purchaseOrdersByStatus = await prisma.purchase_order.groupBy({
      by: ["status"],
      where: posByStatusWhere,
      _count: true,
    });

    // Build where clause for stock transactions (filter by createdAt)
    const stockTransactionsWhere = {
      ...(dateRangeFilter && Object.keys(dateRangeFilter).length > 0 && {
        createdAt: dateRangeFilter,
      }),
    };

    // most amount of stock transactions
    dashboardData.top10itemsCount = await prisma.stock_transaction.groupBy({
      by: ["item_id"],
      where: stockTransactionsWhere,
      _count: true,
    });

    dashboardData.top10items = await prisma.item.findMany({
      where: {
        item_id: {
          in: dashboardData.top10itemsCount.map((item) => item.item_id),
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

    // Build where clause for stages due (filter by endDate)
    const topstagesDueWhere = {
      status: "IN_PROGRESS",
      lot: {
        status: "ACTIVE",
      },
      ...(dateRangeFilter && Object.keys(dateRangeFilter).length > 0 && {
        endDate: dateRangeFilter,
      }),
    };

    dashboardData.topstagesDue = await prisma.stage.findMany({
      where: topstagesDueWhere,
      orderBy: {
        endDate: "asc",
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Dashboard fetched successfully",
        data: dashboardData,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
