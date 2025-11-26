import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../lib/validators/authFromToken";

// following tables need to be fetched for the dashboard:
//  1. project
//  2. lot

export async function GET(request) {
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

    dashboardData.activeProjects = await prisma.project.count({
      where: {
        lots: {
          some: {
            status: "ACTIVE",
          },
        },
      },
    });

    dashboardData.activeLots = await prisma.lot.count({
      where: {
        status: "ACTIVE",
      },
    });

    dashboardData.activeMTOs = await prisma.materials_to_order.count({
      where: {
        status: {
          in: ["DRAFT", "PARTIALLY_ORDERED"],
        },
      },
    });

    dashboardData.activePurchaseOrders = await prisma.purchase_order.count({
      where: {
        status: {
          in: ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"],
        },
      },
    });

    // current year supplier statements
    const currentYear = new Date().getFullYear();
    dashboardData.totalSpent = await prisma.supplier_statement.findMany({
      where: {
        month_year: {
          in: [
            `${currentYear}-01`,
            `${currentYear}-02`,
            `${currentYear}-03`,
            `${currentYear}-04`,
            `${currentYear}-05`,
            `${currentYear}-06`,
            `${currentYear}-07`,
            `${currentYear}-08`,
            `${currentYear}-09`,
            `${currentYear}-10`,
            `${currentYear}-11`,
            `${currentYear}-12`,
          ],
        },
      },
      select: {
        month_year: true,
        supplier: {
          select: {
            name: true,
          },
        },
        amount: true,
      },
      // _sum: { amount: true },
    });

    // lot count by stages
    dashboardData.lotsByStage = await prisma.stage.groupBy({
      by: ["name"],
      where: {
        lot: {
          status: "ACTIVE",
        },
      },
      _count: true,
    });

    dashboardData.MTOsByStatus = await prisma.materials_to_order.groupBy({
      by: ["status"],
      _count: true,
    });

    dashboardData.purchaseOrdersByStatus = await prisma.purchase_order.groupBy({
      by: ["status"],
      _count: true,
    });

    // most amount of stock transactions
    dashboardData.top10itemsCount = await prisma.stock_transaction.groupBy({
      by: ["item_id"],
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

    dashboardData.topstagesDue = await prisma.stage.findMany({
      where: {
        status: "IN_PROGRESS",
        lot: {
          status: "ACTIVE",
        },
      },
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
