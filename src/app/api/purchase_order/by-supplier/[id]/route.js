import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../../lib/validators/authFromToken";
import { prisma } from "@/lib/db";

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
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
