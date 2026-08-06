import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const transactions = await prisma.stock_transaction.findMany({
      where: { type: "USED" },
      orderBy: { createdAt: "desc" },
      include: {
        item: {
          select: {
            item_id: true,
            category: true,
            description: true,
            measurement_unit: true,
            image: { select: { url: true } },
            sheet: true,
            handle: true,
            hardware: true,
            accessory: true,
            edging_tape: true,
          },
        },
        project: { select: { project_id: true, name: true } },
        lot: { select: { lot_id: true, name: true } },
        materials_to_order: {
          select: {
            project: { select: { project_id: true, name: true } },
            lots: { select: { lot_id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json({
      status: true,
      data: transactions,
      message: "Recently used materials fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching recently used materials:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
