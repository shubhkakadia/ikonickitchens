import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/withLogging";
import { requireAuth } from "@/lib/validators/authFromToken";
import { getUserFromToken } from "@/lib/validators/authFromToken";
import { checkAndUpdateMTOStatus } from "@/lib/mtoStatusHelper";
import {
  TransactionError,
  transactionErrorResponse,
} from "@/lib/transactionError";

export async function POST(request) {
  try {
    // Verify authentication
    const authError = await requireAuth(request, {
      modules: ["materialstoorder"],
    });
    if (authError) return authError;

    const session = await getUserFromToken(request);
    if (!session) {
      return NextResponse.json(
        { status: false, message: "Invalid session" },
        { status: 401 },
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
        { status: 400 },
      );
    }

    // reserve_item_stock.quantity is an Int, so only whole numbers are valid
    const requestedQty = Number(quantity);
    if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
      return NextResponse.json(
        { status: false, message: "Quantity must be greater than 0" },
        { status: 400 },
      );
    }
    if (!Number.isInteger(requestedQty)) {
      return NextResponse.json(
        { status: false, message: "Quantity must be a whole number" },
        { status: 400 },
      );
    }

    // Verify item exists
    const item = await prisma.item.findUnique({
      where: { item_id },
    });

    if (!item || item.is_deleted) {
      return NextResponse.json(
        { status: false, message: "Item not found" },
        { status: 404 },
      );
    }

    // Verify the MTO item exists
    const mto = await prisma.materials_to_order_item.findUnique({
      where: { id: mto_id },
      include: { mto: { select: { is_deleted: true } } },
    });

    if (!mto || mto.mto?.is_deleted) {
      return NextResponse.json(
        { status: false, message: "Materials to order item not found" },
        { status: 404 },
      );
    }

    // A reservation can only draw on the item the MTO line asks for
    if (mto.item_id !== item_id) {
      return NextResponse.json(
        {
          status: false,
          message: "Item does not match the materials to order item",
        },
        { status: 400 },
      );
    }

    // Everything that depends on stock or on existing reservations is checked
    // inside the transaction, after locking the MTO line, so concurrent
    // requests are serialised and stock can never go negative.
    let reservation;
    try {
      reservation = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM materials_to_order_item
          WHERE id = ${mto_id}
          FOR UPDATE
        `;

        // Total reservations for this MTO line may not exceed what it needs
        const reserved = await tx.reserve_item_stock.aggregate({
          where: { mto_id },
          _sum: { quantity: true },
        });
        const alreadyReserved = reserved?._sum?.quantity || 0;
        if (alreadyReserved + requestedQty > mto.quantity) {
          throw new TransactionError(
            "Reservation would exceed the quantity required by the materials to order item",
            400,
            {
              required: mto.quantity,
              already_reserved: alreadyReserved,
              requested: requestedQty,
            },
          );
        }

        // Take the stock atomically; this fails if someone else got it first
        const taken = await tx.item.updateMany({
          where: {
            item_id,
            is_deleted: false,
            quantity: { gte: requestedQty },
          },
          data: { quantity: { decrement: requestedQty } },
        });
        if (taken.count === 0) {
          const current = await tx.item.findUnique({
            where: { item_id },
            select: { quantity: true },
          });
          const availableQty = Number(current?.quantity) || 0;
          throw new TransactionError("Not enough stock available", 400, {
            available: availableQty,
            requested: requestedQty,
            shortage: requestedQty - availableQty,
          });
        }

        return tx.reserve_item_stock.create({
          data: {
            item_id,
            quantity: requestedQty,
            mto_id: mto_id,
            user_id,
            used_quantity: 0,
          },
        });
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
      reservation.id,
      "CREATE",
      `Stock reservation created successfully: ${reservation.item_id}`,
    );
    if (!logged) {
      console.error(
        `Failed to log stock reservation creation: ${reservation.id} - ${reservation.item_id}`,
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
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/v1/reserve_item_stock/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
