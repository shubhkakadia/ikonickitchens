import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "../../../../../../lib/validators/authFromToken";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const stockTransactions = await prisma.stock_transaction.findMany({
      where: { item_id: id },
      orderBy: {
        createdAt: "desc",
      },
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
