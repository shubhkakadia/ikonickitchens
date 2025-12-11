import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { id } = await params;

    // Fetch all materials_to_order that contain items linked to this supplier
    const mtos = await prisma.materials_to_order.findMany({
      where: {
        items: {
          some: {
            item: {
              supplier_id: id, // Match supplier via item relation
            },
          },
        },
      },
      include: {
        // Fetch related project but only selected fields
        project: { select: { name: true, project_id: true } },

        // Include lots information
        lots: {
          select: {
            lot_id: true,
            name: true,
          },
        },

        // Include creator info with nested employee details
        createdBy: {
          select: {
            employee: {
              select: { first_name: true, last_name: true, employee_id: true },
            },
          },
        },

        // Include media files (not deleted)
        media: {
          where: {
            is_deleted: false,
          },
        },

        // Include only items belonging to this supplier
        items: {
          where: {
            item: { supplier_id: id },
          },
          include: {
            // Fetch selected item details and its linked sub-types
            item: {
              select: {
                category: true,
                image: true,
                quantity: true,
                measurement_unit: true,
                sheet: true,
                handle: true,
                hardware: true,
                accessory: true,
                edging_tape: true,
                supplier_id: true,
                supplier: {
                  select: { supplier_id: true, name: true },
                },
              },
            },
          },
        },
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
    console.error("Error in GET /api/materials_to_order/by-supplier/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
