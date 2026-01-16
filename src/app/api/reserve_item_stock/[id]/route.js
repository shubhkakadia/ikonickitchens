import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/withLogging";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { checkAndUpdateMTOStatus } from "@/lib/mtoStatusHelper";

export async function GET(request, { params }) {
  try {
    // Verify authentication
    const authResult = await validateAdminAuth(request);
    if (!authResult.authenticated) {
      return NextResponse.json(authResult.response, { status: 401 });
    }

    const { id } = await params;

    const reservation = await prisma.reserve_item_stock.findUnique({
      where: { id },
      include: {
        item: {
          include: {
            sheet: true,
            handle: true,
            hardware: true,
            accessory: true,
            edging_tape: true,
            supplier: true,
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { status: false, message: "Stock reservation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: true,
      message: "Stock reservation retrieved successfully",
      data: reservation,
    });
  } catch (error) {
    console.error("Error in GET /api/reserve_item_stock/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    // Verify authentication
    const authResult = await validateAdminAuth(request);
    if (!authResult.authenticated) {
      return NextResponse.json(authResult.response, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();
    const { quantity, mto_id } = data;

    // Check if reservation exists
    const existingReservation = await prisma.reserve_item_stock.findUnique({
      where: { id },
    });

    if (!existingReservation) {
      return NextResponse.json(
        { status: false, message: "Stock reservation not found" },
        { status: 404 }
      );
    }

    // Validate quantity if provided
    if (quantity !== undefined && quantity <= 0) {
      return NextResponse.json(
        { status: false, message: "Quantity must be greater than 0" },
        { status: 400 }
      );
    }

    // If mto_id is provided, verify it exists
    if (mto_id) {
      const mto = await prisma.materials_to_order_item.findUnique({
        where: { id: mto_id },
      });

      if (!mto) {
        return NextResponse.json(
          { status: false, message: "Materials to order item not found" },
          { status: 404 }
        );
      }
    }

    // Handle quantity update with stock management
    let updatedReservation;

    if (quantity !== undefined) {
      const newQty = parseInt(quantity);
      const oldQty = existingReservation.quantity;
      const qtyDifference = newQty - oldQty;

      // If increasing quantity, check stock availability
      if (qtyDifference > 0) {
        const item = await prisma.item.findUnique({
          where: { item_id: existingReservation.item_id },
        });

        const availableQty = Number(item.quantity) || 0;

        if (availableQty < qtyDifference) {
          return NextResponse.json(
            {
              status: false,
              message: "Not enough stock available for this increase",
              data: {
                available: availableQty,
                requested: qtyDifference,
                shortage: qtyDifference - availableQty,
              },
            },
            { status: 400 }
          );
        }
      }

      // Update reservation and adjust item quantity in a transaction
      updatedReservation = await prisma.$transaction(async (tx) => {
        // Update the reservation
        const updateData = { quantity: newQty };
        if (mto_id !== undefined) updateData.mto_id = mto_id;

        const updated = await tx.reserve_item_stock.update({
          where: { id },
          data: updateData,
        });

        // Adjust item quantity based on the difference
        if (qtyDifference !== 0) {
          await tx.item.update({
            where: { item_id: existingReservation.item_id },
            data: {
              quantity: {
                increment: -qtyDifference, // Decrement if positive difference, increment if negative
              },
            },
          });
        }

        return updated;
      });
    } else {
      // Just update mto_id if quantity not changed
      const updateData = {};
      if (mto_id !== undefined) updateData.mto_id = mto_id;

      updatedReservation = await prisma.reserve_item_stock.update({
        where: { id },
        data: updateData,
      });
    }

    const logged = await withLogging(
      request,
      "reserve_item_stock",
      existingReservation.id,
      "UPDATE",
      `Stock reservation updated successfully: ${existingReservation.item_id}`
    );
    if (!logged) {
      console.error(
        `Failed to log stock reservation update: ${existingReservation.id} - ${existingReservation.item_id}`
      );
    }

    return NextResponse.json({
      status: true,
      message: "Stock reservation updated successfully",
      data: updatedReservation,
    });
  } catch (error) {
    console.error("Error in PATCH /api/reserve_item_stock/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    // Verify authentication
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;

    // Check if reservation exists
    const existingReservation = await prisma.reserve_item_stock.findUnique({
      where: { id },
      include: {
        mto: {
          include: {
            mto: true, // Get the parent materials_to_order to check status
          },
        },
      },
    });

    if (!existingReservation) {
      return NextResponse.json(
        { status: false, message: "Stock reservation not found" },
        { status: 404 }
      );
    }

    // Check if the reservation is linked to an MTO
    if (existingReservation.mto_id && existingReservation.mto) {
      const mtoStatus = existingReservation.mto.mto?.status;

      // Prevent deletion if MTO status is FULLY_ORDERED or CLOSED
      if (mtoStatus === "FULLY_ORDERED" || mtoStatus === "CLOSED") {
        return NextResponse.json(
          {
            status: false,
            message: `Cannot delete reservation. The associated Materials to Order is ${mtoStatus}.`,
            data: {
              mtoStatus,
              allowedStatuses: ["DRAFT", "PARTIALLY_ORDERED"],
            },
          },
          { status: 403 }
        );
      }
    }

    // Store mto_id before deletion for status update
    const mtoItemId = existingReservation.mto_id;

    // Delete the reservation and restore item quantity in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete the reservation
      await tx.reserve_item_stock.delete({
        where: { id },
      });

      // Return the quantity back to the item
      await tx.item.update({
        where: { item_id: existingReservation.item_id },
        data: {
          quantity: {
            increment: existingReservation.quantity,
          },
        },
      });
    });

    const logged = await withLogging(
      request,
      "reserve_item_stock",
      existingReservation.id,
      "DELETE",
      `Stock reservation deleted successfully: ${existingReservation.item_id}`
    );
    if (!logged) {
      console.error(
        `Failed to log stock reservation deletion: ${existingReservation.id} - ${existingReservation.item_id}`
      );
    }

    // Check and update MTO status after deleting reservation
    if (mtoItemId) {
      await checkAndUpdateMTOStatus(mtoItemId);
    }

    return NextResponse.json({
      status: true,
      message: "Stock reservation deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/reserve_item_stock/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
