import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/withLogging";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { getUserFromToken } from "@/lib/validators/authFromToken";
import { checkAndUpdateMTOStatus } from "@/lib/mtoStatusHelper";

export async function POST(request) {
  try {
    // Verify authentication
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const session = await getUserFromToken(request);
    if (!session) {
      return NextResponse.json(
        { status: false, message: "Invalid session" },
        { status: 401 }
      );
    }

    const user_id = session.user_id;
    const data = await request.json();
    const { item_id, quantity, mto_id } = data;

    // Validate required fields
    if (!item_id || !quantity || !mto_id) {
      return NextResponse.json(
        {
          status: false,
          message: "item_id, quantity, and mto_id are required",
        },
        { status: 400 }
      );
    }

    // Validate quantity is positive
    if (quantity <= 0) {
      return NextResponse.json(
        { status: false, message: "Quantity must be greater than 0" },
        { status: 400 }
      );
    }

    // Verify item exists and check stock availability
    const item = await prisma.item.findUnique({
      where: { item_id },
    });

    if (!item) {
      return NextResponse.json(
        { status: false, message: "Item not found" },
        { status: 404 }
      );
    }

    // If mto_id is provided, verify it exists
    const mto = await prisma.materials_to_order_item.findUnique({
      where: { id: mto_id },
    });

    if (!mto) {
      return NextResponse.json(
        { status: false, message: "Materials to order item not found" },
        { status: 404 }
      );
    }

    // Check if there's enough stock available
    const requestedQty = parseInt(quantity);
    const availableQty = Number(item.quantity) || 0;

    if (availableQty < requestedQty) {
      return NextResponse.json(
        {
          status: false,
          message: "Not enough stock available",
          data: {
            available: availableQty,
            requested: requestedQty,
            shortage: requestedQty - availableQty,
          },
        },
        { status: 400 }
      );
    }

    // Create stock reservation and reduce item quantity in a transaction
    const reservation = await prisma.$transaction(async (tx) => {
      // Create the reservation
      const newReservation = await tx.reserve_item_stock.create({
        data: {
          item_id,
          quantity: requestedQty,
          mto_id: mto_id,
          user_id,
          used_quantity: 0,
        },
      });

      // Reduce the item quantity
      await tx.item.update({
        where: { item_id },
        data: {
          quantity: {
            decrement: requestedQty,
          },
        },
      });

      return newReservation;
    });

    const logged = await withLogging(
      request,
      "reserve_item_stock",
      reservation.id,
      "CREATE",
      `Stock reservation created successfully: ${reservation.item_id}`
    );
    if (!logged) {
      console.error(
        `Failed to log employee creation: ${employee.id} - ${employee.first_name} ${employee.last_name}`
      );
    }

    // Check and update MTO status after creating reservation
    await checkAndUpdateMTOStatus(mto_id);

    return NextResponse.json(
      {
        status: true,
        message: "Stock reservation created successfully",
        data: reservation,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/reserve_item_stock/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
