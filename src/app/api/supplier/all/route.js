import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    // include total statements amount for each supplier and number of purchase orders
    const suppliers = await prisma.supplier.findMany({
      where: {
        is_deleted: false,
      },
      select: {
        // Select all supplier fields
        supplier_id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        website: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        // 1. Only pending statements (for amount calculation)
        statements: {
          where: {
            payment_status: "PENDING",
          },
          select: {
            amount: true,
          },
        },
        // 2. Count of NOT fully_received or cancelled POs (using _count for efficiency)
        _count: {
          select: {
            purchase_order: {
              where: {
                NOT: {
                  status: {
                    in: ["FULLY_RECEIVED", "CANCELLED"],
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Suppliers fetched successfully",
        data: suppliers,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/supplier/all:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
