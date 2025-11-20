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
            notes: true,
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
          },
        },
        media: { where: { is_deleted: false } },
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
