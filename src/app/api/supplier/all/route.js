import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";

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
    // include total statements amount for each supplier and number of purchase orders
    const suppliers = await prisma.supplier.findMany({
      include: {
        // 1. Only pending statements
        statements: {
          where: {
            payment_status: "PENDING",
          },
          select: {
            amount: true,
          },
        },
    
        // 2. Only NOT fully_received or cancelled POs
        purchase_order: {
          where: {
            NOT: {
              status: {
                in: ["FULLY_RECEIVED", "CANCELLED"],
              },
            },
          },
          select: {
            id: true, // any minimal field to avoid loading everything
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
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
