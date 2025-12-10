import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const pos = await prisma.purchase_order.findMany({
      include: {
        supplier: { select: { supplier_id: true, name: true } },
        mto: {
          select: {
            project: { select: { project_id: true, name: true } },
            status: true,
          },
        },
        items: {
          include: {
            item: {
              include: {
                sheet: true,
                handle: true,
                hardware: true,
                accessory: true,
                edging_tape: true,
                image: true,
              },
            },
          },
        },
        orderedBy: {
          select: {
            employee: {
              select: {
                employee_id: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
        invoice_url: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Purchase orders fetched successfully",
        data: pos,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/purchase_order/all:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
