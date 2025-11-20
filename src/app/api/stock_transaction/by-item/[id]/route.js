import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../../lib/validators/authFromToken";

export async function GET(request, { params }) {
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

    const { id } = await params;
    const stockTransactions = await prisma.stock_transaction.findMany({
      where: { item_id: id },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Stock transactions fetched successfully",
        data: stockTransactions,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching stock transactions by item:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
