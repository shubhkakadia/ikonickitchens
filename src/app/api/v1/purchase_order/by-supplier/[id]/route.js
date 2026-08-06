import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { prisma } from "@/lib/db";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const pos = await prisma.purchase_order.findMany({
      where: {
        supplier_id: id,
      },
      include: {
        supplier: {
          select: { supplier_id: true, name: true },
        },
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
          include: {
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
        createdAt: "desc",
      },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Purchase orders fetched successfully",
        data: pos,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/purchase_order/by-supplier/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
