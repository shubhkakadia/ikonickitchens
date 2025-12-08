import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";

export async function POST(request) {
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

    const data = await request.json();
    const { project_id, notes, createdBy_id, items, lot_ids } = data;

    // Create materials_to_order first
    const mto = await prisma.materials_to_order.create({
      data: {
        ...(project_id && { project_id }),
        notes,
        createdBy_id,
        items:
          items && items.length > 0
            ? {
                create: items.map((item) => ({
                  item_id: item.item_id,
                  quantity: item.quantity,
                  notes: item.notes,
                })),
              }
            : undefined,
      },
    });

    // Then assign lots to this MTO
    if (lot_ids && lot_ids.length > 0) {
      await prisma.lot.updateMany({
        where: { lot_id: { in: lot_ids } },
        data: { materials_to_orders_id: mto.id },
      });
    }

    // Fetch the complete MTO with all relations
    const completeMto = await prisma.materials_to_order.findUnique({
      where: { id: mto.id },
      include: {
        lots: {
          include: {
            project: {
              include: {
                client: true,
              },
            },
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
              },
            },
          },
        },
        project: {
          include: {
            lots: true,
          },
        },
      },
    });

    // Fetch media separately
    const media = await prisma.media.findMany({
      where: {
        materials_to_orderId: mto.id,
        is_deleted: false,
      },
    });

    // Add media to the response
    const mtoWithMedia = {
      ...completeMto,
      media: media,
    };

    const projectName = completeMto.project?.name || "No Project";
    const logged = await withLogging(request, "materials_to_order", mto.id, "CREATE", `Materials to order created successfully${completeMto.project ? ` for project: ${projectName}` : ""}`);
    if (!logged) {
      return NextResponse.json(
        { status: false, message: "Failed to log materials to order creation" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Materials to order created successfully",
        data: mtoWithMedia,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
