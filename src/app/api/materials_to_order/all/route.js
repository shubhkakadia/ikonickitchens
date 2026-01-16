import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const mtos = await prisma.materials_to_order.findMany({
      include: {
        project: { select: { name: true, project_id: true } },
        lots: { select: { lot_id: true, name: true } },
        createdBy: {
          select: {
            employee: {
              select: { first_name: true, last_name: true, employee_id: true },
            },
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            quantity_used: true,
            quantity_ordered: true,
            quantity_ordered_po: true,
            notes: true,
            ordered_by: {
              select: {
                id: true,
                username: true,
              },
            },
            ordered_items: {
              select: {
                quantity: true,
              },
            },
            item: {
              select: {
                item_id: true,
                category: true,
                image: true,
                description: true,
                quantity: true,
                measurement_unit: true,
                sheet: true,
                handle: true,
                hardware: true,
                accessory: true,
                edging_tape: true,
                supplier_id: true,
                supplier: { select: { supplier_id: true, name: true } },
              },
            },
            reserve_item_stock: true,
          },
        },
        media: { where: { is_deleted: false } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Materials to orders fetched successfully",
        data: mtos,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/materials_to_order/all:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

