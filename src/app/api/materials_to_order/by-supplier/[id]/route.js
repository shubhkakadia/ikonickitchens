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
                supplier_id: true,
                supplier: {
                  select: { supplier_id: true, name: true },
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
        message: "Materials to orders fetched successfully",
        data: mtos,
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
