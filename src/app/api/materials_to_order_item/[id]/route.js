import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const data = await request.json();

    if (!data || data.quantity_ordered === undefined) {
      return NextResponse.json(
        { status: false, message: "quantity_ordered is required" },
        { status: 400 }
      );
    }

    const raw = Number(data.quantity_ordered);
    if (!Number.isFinite(raw) || raw < 0) {
      return NextResponse.json(
        { status: false, message: "quantity_ordered must be a number >= 0" },
        { status: 400 }
      );
    }

    const mtoItem = await prisma.materials_to_order_item.findUnique({
      where: { id },
      select: {
        id: true,
        mto_id: true,
        item_id: true,
      },
    });

    if (!mtoItem) {
      return NextResponse.json(
        { status: false, message: "Materials to order item not found" },
        { status: 404 }
      );
    }

    const quantityOrdered = Math.floor(raw);

    const updated = await prisma.materials_to_order_item.update({
      where: { id },
      data: { quantity_ordered: quantityOrdered },
    });

    const logged = await withLogging(
      request,
      "materials_to_order_item",
      id,
      "UPDATE",
      `Updated quantity_ordered=${quantityOrdered} for mto_item=${id} (mto_id=${mtoItem.mto_id}, item_id=${mtoItem.item_id})`
    );
    if (!logged) {
      console.error(`Failed to log materials_to_order_item update: ${id}`);
    }

    return NextResponse.json(
      {
        status: true,
        message: "Materials to order item updated successfully",
        data: updated,
        ...(logged ? {} : { warning: "Note: Update succeeded but logging failed" }),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in PATCH /api/materials_to_order_item/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

