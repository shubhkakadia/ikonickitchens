import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request, { params }) {
  try {
    // Verify authentication
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { id } = await params;

    // Verify item exists
    const item = await prisma.item.findUnique({
      where: { item_id: id },
    });

    if (!item) {
      return NextResponse.json(
        { status: false, message: "Item not found" },
        { status: 404 }
      );
    }

    // Get all reservations for this item
    const reservations = await prisma.reserve_item_stock.findMany({
      where: { item_id: id },
      include: {
        item: {
          include: {
            sheet: true,
            handle: true,
            hardware: true,
            accessory: true,
            edging_tape: true,
            supplier: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate total reserved quantity
    const totalReserved = reservations.reduce(
      (sum, res) => sum + res.quantity,
      0
    );

    return NextResponse.json({
      status: true,
      message: "Stock reservations retrieved successfully",
      data: {
        reservations,
        totalReserved,
        itemDetails: item,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/reserve_item_stock/item/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
