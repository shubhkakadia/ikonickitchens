import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { prisma } from "@/lib/db";

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

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

function adelaideLocalToUTC(dateString) {
  const adelaideDate = dayjs.tz(`${dateString}T00:00:00`, "Australia/Adelaide");
  return adelaideDate.utc().toDate();
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

  if (isYearAll && !isMonthAll) {
    return null;
  }

  if (!isYearAll && isMonthAll) {
    return {
      gte: adelaideLocalToUTC(`${year}-01-01`),
      lt: adelaideLocalToUTC(`${parseInt(year) + 1}-01-01`),
    };
  }

  if (!isYearAll && !isMonthAll) {
    const monthNum = parseInt(normalizedMonth, 10);
    const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
    const nextYear = monthNum === 12 ? parseInt(year) + 1 : year;
    return {
      gte: adelaideLocalToUTC(`${year}-${normalizedMonth}-01`),
      lt: adelaideLocalToUTC(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`),
    };
  }

  return {};
}

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

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
      projectsCompletedThisMonth: 0,
      averageProjectDuration: 0,
    };

    // Build all where clauses first (no database calls yet)
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

    const activeLotsWhere = {
      status: "ACTIVE",
      ...(dateRangeFilter && Object.keys(dateRangeFilter).length > 0 && {
        OR: [
          { startDate: dateRangeFilter },
          { createdAt: dateRangeFilter },
        ],
      }),
    };

    const activeMTOsWhere = {
      status: {
        in: ["DRAFT", "PARTIALLY_ORDERED"],
      },
      ...(dateRangeFilter && Object.keys(dateRangeFilter).length > 0 && {
        createdAt: dateRangeFilter,
      }),
    };

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

    const mtosByStatusWhere = {
      ...(dateRangeFilter && Object.keys(dateRangeFilter).length > 0 && {
        createdAt: dateRangeFilter,
      }),
    };

    const posByStatusWhere = {
      ...(dateRangeFilter && Object.keys(dateRangeFilter).length > 0 && {
        OR: [
          { createdAt: dateRangeFilter },
          { ordered_at: dateRangeFilter },
        ],
      }),
    };

    const stockTransactionsWhere = {
      ...(dateRangeFilter && Object.keys(dateRangeFilter).length > 0 && {
        createdAt: dateRangeFilter,
      }),
    };

    const topstagesDueWhere = {
      status: "IN_PROGRESS",
      lot: {
        status: "ACTIVE",
      },
      ...(dateRangeFilter && Object.keys(dateRangeFilter).length > 0 && {
        endDate: dateRangeFilter,
      }),
    };

    // Projects Completed This Month - projects with at least one completed lot this month
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const currentMonthEnd = new Date();
    currentMonthEnd.setMonth(currentMonthEnd.getMonth() + 1);
    currentMonthEnd.setDate(0);
    currentMonthEnd.setHours(23, 59, 59, 999);

    const projectsCompletedThisMonthWhere = {
      lots: {
        some: {
          status: "COMPLETED",
          updatedAt: {
            gte: currentMonthStart,
            lte: currentMonthEnd,
          },
        },
      },
    };

    // Average Project Duration - calculate average duration for completed projects
    // Duration = time from first lot startDate to last lot completion
    const completedProjectsWhere = {
      lots: {
        some: {
          status: "COMPLETED",
        },
      },
    };

    // Execute all independent queries in parallel
    const [
      activeProjects,
      activeLots,
      activeMTOs,
      activePurchaseOrders,
      totalSpent,
      lotsByStage,
      MTOsByStatus,
      purchaseOrdersByStatus,
      allItemsCount,
      topstagesDue,
      projectsCompletedThisMonth,
      completedProjects,
    ] = await Promise.all([
      prisma.project.count({ where: activeProjectsWhere }),
      prisma.lot.count({ where: activeLotsWhere }),
      prisma.materials_to_order.count({ where: activeMTOsWhere }),
      prisma.purchase_order.count({ where: activePurchaseOrdersWhere }),
      prisma.supplier_statement.findMany({
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
      }),
      prisma.stage.groupBy({
        by: ["name"],
        where: lotsByStageWhere,
        _count: true,
      }),
      prisma.materials_to_order.groupBy({
        by: ["status"],
        where: mtosByStatusWhere,
        _count: true,
      }),
      prisma.purchase_order.groupBy({
        by: ["status"],
        where: posByStatusWhere,
        _count: true,
      }),
      prisma.stock_transaction.groupBy({
        by: ["item_id"],
        where: stockTransactionsWhere,
        _count: true,
      }),
      prisma.stage.findMany({
        where: topstagesDueWhere,
        include: {
          lot: {
            include: {
              project: {
                select: {
                  name: true,
                  project_id: true,
                },
              },
            },
          },
        },
        orderBy: {
          endDate: "asc",
        },
      }),
      prisma.project.count({ where: projectsCompletedThisMonthWhere }),
      prisma.project.findMany({
        where: completedProjectsWhere,
        include: {
          lots: {
            where: {
              status: "COMPLETED",
            },
            select: {
              startDate: true,
              updatedAt: true,
            },
          },
        },
      }),
    ]);

    // Assign results to dashboard data
    dashboardData.activeProjects = activeProjects;
    dashboardData.activeLots = activeLots;
    dashboardData.activeMTOs = activeMTOs;
    dashboardData.activePurchaseOrders = activePurchaseOrders;
    dashboardData.totalSpent = totalSpent;
    dashboardData.lotsByStage = lotsByStage;
    dashboardData.MTOsByStatus = MTOsByStatus;
    dashboardData.purchaseOrdersByStatus = purchaseOrdersByStatus;
    dashboardData.topstagesDue = topstagesDue;
    dashboardData.projectsCompletedThisMonth = projectsCompletedThisMonth;

    // Calculate average project duration
    if (completedProjects.length > 0) {
      const projectDurations = completedProjects
        .map((project) => {
          if (!project.lots || project.lots.length === 0) return null;

          const completedLots = project.lots.filter((lot) => lot.startDate && lot.updatedAt);
          if (completedLots.length === 0) return null;

          // Find earliest start date and latest completion date
          const startDates = completedLots
            .map((lot) => new Date(lot.startDate))
            .filter((date) => !isNaN(date.getTime()));
          const completionDates = completedLots
            .map((lot) => new Date(lot.updatedAt))
            .filter((date) => !isNaN(date.getTime()));

          if (startDates.length === 0 || completionDates.length === 0) return null;

          const earliestStart = new Date(Math.min(...startDates));
          const latestCompletion = new Date(Math.max(...completionDates));
          const durationDays = (latestCompletion - earliestStart) / (1000 * 60 * 60 * 24);

          return durationDays > 0 ? durationDays : null;
        })
        .filter((duration) => duration !== null);

      if (projectDurations.length > 0) {
        const averageDuration = projectDurations.reduce((sum, duration) => sum + duration, 0) / projectDurations.length;
        dashboardData.averageProjectDuration = Math.round(averageDuration);
      } else {
        dashboardData.averageProjectDuration = 0;
      }
    } else {
      dashboardData.averageProjectDuration = 0;
    }

    // Process top 10 items (depends on allItemsCount)
    const top10itemsCount = allItemsCount
      .sort((a, b) => b._count - a._count)
      .slice(0, 10);

    dashboardData.top10itemsCount = top10itemsCount;

    // Only fetch details for the top 10 items
    dashboardData.top10items = top10itemsCount.length > 0
      ? await prisma.item.findMany({
        where: {
          item_id: {
            in: top10itemsCount.map((item) => item.item_id),
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
      })
      : [];

    return NextResponse.json(
      {
        status: true,
        message: "Dashboard fetched successfully",
        data: dashboardData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/dashboard:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
