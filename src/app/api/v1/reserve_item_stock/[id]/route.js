import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/withLogging";
import { requireAuth } from "@/lib/validators/authFromToken";
import { checkAndUpdateMTOStatus } from "@/lib/mtoStatusHelper";
import {
  TransactionError,
  transactionErrorResponse,
} from "@/lib/transactionError";

export async function GET(request, { params }) {
  try {
    // Verify authentication
    const authError = await requireAuth(request, {
      modules: ["materialstoorder"],
    });
    if (authError) return authError;

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
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { status: false, message: "Stock reservation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      status: true,
      message: "Stock reservation retrieved successfully",
      data: reservation,
    });
  } catch (error) {
    console.error("Error in GET /api/v1/reserve_item_stock/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    // Verify authentication
    const authError = await requireAuth(request, {
      modules: ["materialstoorder"],
    });
    if (authError) return authError;

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
        { status: 404 },
      );
    }

    // Validate quantity if provided (reserve_item_stock.quantity is an Int)
    let newQty;
    if (quantity !== undefined) {
      newQty = Number(quantity);
      if (!Number.isFinite(newQty) || newQty <= 0) {
        return NextResponse.json(
          { status: false, message: "Quantity must be greater than 0" },
          { status: 400 },
        );
      }
      if (!Number.isInteger(newQty)) {
        return NextResponse.json(
          { status: false, message: "Quantity must be a whole number" },
          { status: 400 },
        );
      }
    }

    // If mto_id is provided, verify it exists and wants the same item
    if (mto_id) {
      const mto = await prisma.materials_to_order_item.findUnique({
        where: { id: mto_id },
      });

      if (!mto) {
        return NextResponse.json(
          { status: false, message: "Materials to order item not found" },
          { status: 404 },
        );
      }

      if (mto.item_id !== existingReservation.item_id) {
        return NextResponse.json(
          {
            status: false,
            message: "Item does not match the materials to order item",
          },
          { status: 400 },
        );
      }
    }

    // Everything that depends on current stock or reservations is re-read and
    // checked inside the transaction, after locking the MTO line(s), so
    // concurrent requests are serialised and stock can never go negative.
    let updatedReservation;
    try {
      updatedReservation = await prisma.$transaction(async (tx) => {
        // Lock in a fixed order so two requests can't deadlock each other
        const lockIds = [
          ...new Set([existingReservation.mto_id, mto_id].filter(Boolean)),
        ].sort();
        for (const lockId of lockIds) {
          await tx.$queryRaw`
            SELECT id FROM materials_to_order_item
            WHERE id = ${lockId}
            FOR UPDATE
          `;
        }

        const current = await tx.reserve_item_stock.findUnique({
          where: { id },
        });
        if (!current) {
          throw new TransactionError("Stock reservation not found", 404);
        }

        const targetQty = newQty ?? current.quantity;
        const targetMtoId = mto_id || current.mto_id;
        const qtyDifference = targetQty - current.quantity;
        const mtoChanged = targetMtoId !== current.mto_id;

        // Can't shrink a reservation below what has already been consumed,
        // otherwise the consumed units would be returned to stock
        const usedQty = current.used_quantity || 0;
        if (targetQty < usedQty) {
          throw new TransactionError(
            `Quantity cannot be less than the already used quantity (${usedQty})`,
            400,
            { used_quantity: usedQty },
          );
        }

        // Growing a reservation, or moving it to another line, must keep the
        // line's total reservations within what it needs
        if (qtyDifference > 0 || mtoChanged) {
          const target = await tx.materials_to_order_item.findUnique({
            where: { id: targetMtoId },
          });
          const others = await tx.reserve_item_stock.aggregate({
            where: { mto_id: targetMtoId, id: { not: id } },
            _sum: { quantity: true },
          });
          const alreadyReserved = others?._sum?.quantity || 0;
          if (target && alreadyReserved + targetQty > target.quantity) {
            throw new TransactionError(
              "Reservation would exceed the quantity required by the materials to order item",
              400,
              {
                required: target.quantity,
                already_reserved: alreadyReserved,
                requested: targetQty,
              },
            );
          }
        }

        // Only write if the reservation is still as we read it (stock usage
        // can consume it without taking the MTO lock)
        const updateData = { quantity: targetQty };
        if (mtoChanged) updateData.mto_id = targetMtoId;
        const written = await tx.reserve_item_stock.updateMany({
          where: {
            id,
            quantity: current.quantity,
            used_quantity: current.used_quantity,
          },
          data: updateData,
        });
        if (written.count === 0) {
          throw new TransactionError(
            "The reservation was changed by someone else. Reload and try again.",
            409,
          );
        }

        // Adjust item stock by the difference, never below zero
        if (qtyDifference > 0) {
          const taken = await tx.item.updateMany({
            where: {
              item_id: current.item_id,
              is_deleted: false,
              quantity: { gte: qtyDifference },
            },
            data: { quantity: { decrement: qtyDifference } },
          });
          if (taken.count === 0) {
            const item = await tx.item.findUnique({
              where: { item_id: current.item_id },
              select: { quantity: true },
            });
            const availableQty = Number(item?.quantity) || 0;
            throw new TransactionError(
              "Not enough stock available for this increase",
              400,
              {
                available: availableQty,
                requested: qtyDifference,
                shortage: qtyDifference - availableQty,
              },
            );
          }
        } else if (qtyDifference < 0) {
          await tx.item.update({
            where: { item_id: current.item_id },
            data: { quantity: { increment: -qtyDifference } },
          });
        }

        return tx.reserve_item_stock.findUnique({ where: { id } });
      });
    } catch (error) {
      if (error instanceof TransactionError) {
        return transactionErrorResponse(error, NextResponse);
      }
      throw error;
    }

    const logged = await withLogging(
      request,
      "reserve_item_stock",
      existingReservation.id,
      "UPDATE",
      `Stock reservation updated successfully: ${existingReservation.item_id}`,
    );
    if (!logged) {
      console.error(
        `Failed to log stock reservation update: ${existingReservation.id} - ${existingReservation.item_id}`,
      );
    }

    return NextResponse.json({
      status: true,
      message: "Stock reservation updated successfully",
      data: updatedReservation,
    });
  } catch (error) {
    console.error("Error in PATCH /api/v1/reserve_item_stock/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    // Verify authentication
    const authError = await requireAuth(request, {
      modules: ["materialstoorder"],
    });
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
        { status: 404 },
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
          { status: 403 },
        );
      }
    }

    // Store mto_id before deletion for status update
    const mtoItemId = existingReservation.mto_id;

    // Delete the reservation and restore item quantity in a transaction
    await prisma.$transaction(async (tx) => {
      // Same MTO-line lock as create/PATCH and stock usage, so a concurrent
      // usage can't consume part of the reservation mid-delete
      await tx.$queryRaw`
        SELECT id FROM materials_to_order_item
        WHERE id = ${existingReservation.mto_id}
        FOR UPDATE
      `;

      // Delete the reservation, reading used_quantity at delete time so a
      // concurrent stock usage can't slip in between the read and the restore
      // A concurrent request (e.g. stock usage consuming the whole
      // reservation) may have removed it since the lookup above; that is a
      // 404, not a server error
      let deleted;
      try {
        deleted = await tx.reserve_item_stock.delete({
          where: { id },
        });
      } catch (deleteError) {
        if (deleteError?.code === "P2025") {
          throw new TransactionError("Stock reservation not found", 404);
        }
        throw deleteError;
      }

      // Only the unused part of the reservation is still physically in stock;
      // the used part was consumed and must not be returned to the item
      const unusedQuantity = Math.max(
        deleted.quantity - (deleted.used_quantity || 0),
        0,
      );

      if (unusedQuantity > 0) {
        await tx.item.update({
          where: { item_id: deleted.item_id },
          data: {
            quantity: {
              increment: unusedQuantity,
            },
          },
        });
      }
    });

    const logged = await withLogging(
      request,
      "reserve_item_stock",
      existingReservation.id,
      "DELETE",
      `Stock reservation deleted successfully: ${existingReservation.item_id}`,
    );
    if (!logged) {
      console.error(
        `Failed to log stock reservation deletion: ${existingReservation.id} - ${existingReservation.item_id}`,
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
    if (error instanceof TransactionError) {
      return transactionErrorResponse(error, NextResponse);
    }
    console.error("Error in DELETE /api/v1/reserve_item_stock/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
