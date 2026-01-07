import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth, getUserFromToken } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
import { sendNotification } from "@/lib/notification";

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    // Get user_id from session token (more secure than relying on frontend)
    const session = await getUserFromToken(request);
    if (!session) {
      return NextResponse.json(
        { status: false, message: "Invalid session" },
        { status: 401 }
      );
    }
    const createdBy_id = session.user_id;

    const data = await request.json();
    const { project_id, notes, items, lot_ids } = data;

    // Use transaction to atomically create MTO and update lots
    const mto = await prisma.$transaction(async (tx) => {
      // Create materials_to_order
      const newMto = await tx.materials_to_order.create({
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

      // Assign lots to this MTO atomically
      if (lot_ids && lot_ids.length > 0) {
        await tx.lot.updateMany({
          where: { lot_id: { in: lot_ids } },
          data: { materials_to_orders_id: newMto.id },
        });
      }

      return newMto;
    });

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

    // Send notification for MTO creation
    try {
      // Get lot names
      const lotNames = completeMto.lots && completeMto.lots.length > 0
        ? (completeMto.lots.length === 1
          ? completeMto.lots[0].lot_id
          : completeMto.lots.map(l => l.lot_id).join(", "))
        : "Unknown Lot";

      await sendNotification(
        {
          type: "material_to_order",
          materials_to_order_id: mto.id,
          project_id: completeMto.project_id,
          project_name: completeMto.project?.name || "Unknown Project",
          client_name: completeMto.project?.client?.client_name || "Unknown Client",
          lot_name: lotNames,
          is_new: true,
        },
        "materials_to_order_list_update"
      );
    } catch (notificationError) {
      console.error("Failed to send MTO creation notification:", notificationError);
      // Don't fail the request if notification fails
    }

    if (!logged) {
      console.error(`Failed to log materials to order creation: ${mto.id}`);
      return NextResponse.json(
        {
          status: true,
          message: "Materials to order created successfully",
          data: mtoWithMedia,
          warning: "Note: Creation succeeded but logging failed"
        },
        { status: 201 }
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
    console.error("Error in POST /api/materials_to_order/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
