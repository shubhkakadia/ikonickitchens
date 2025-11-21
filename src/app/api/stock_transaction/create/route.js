import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";

/**
 * Handle USED transaction (from Materials To Order)
 * Updates materials_to_order_item's quantity_used
 * Decreases item inventory quantity
 * Creates stock_transaction with type USED
 */
async function handleUsedTransaction(data) {
  const { item_id, quantity, materials_to_order_id, notes } = data;

  // Find the materials_to_order_item by mto_id and item_id
  const mtoItem = await prisma.materials_to_order_item.findFirst({
    where: {
      mto_id: materials_to_order_id,
      item_id: item_id,
    },
    include: {
      mto: true,
      item: true,
    },
  });

  if (!mtoItem) {
    return {
      status: false,
      message: "Materials to order item not found",
      statusCode: 404,
    };
  }

  // Calculate new quantity_used (increment by quantity)
  const currentUsed = mtoItem.quantity_used || 0;
  const newQuantityUsed = currentUsed + quantity;

  // Update materials_to_order_item's quantity_used
  const updatedMtoItem = await prisma.materials_to_order_item.update({
    where: { id: mtoItem.id },
    data: {
      quantity_used: newQuantityUsed,
    },
    include: {
      item: true,
      mto: true,
    },
  });

  // Get current item quantity
  const currentItem = await prisma.item.findUnique({
    where: { item_id: item_id },
    select: { quantity: true },
  });

  if (!currentItem) {
    return {
      status: false,
      message: "Item not found",
      statusCode: 404,
    };
  }

  // Decrease item inventory quantity
  const currentQuantity = currentItem.quantity || 0;
  const newQuantity = Math.max(0, currentQuantity - quantity);

  // Update item quantity and create stock transaction
  await Promise.all([
    prisma.item.update({
      where: { item_id: item_id },
      data: {
        quantity: newQuantity,
      },
    }),
    prisma.stock_transaction.create({
      data: {
        item_id: item_id,
        quantity: quantity,
        type: "USED",
        materials_to_order_id: materials_to_order_id,
        notes: notes || `Used from MTO ${materials_to_order_id}`,
      },
    }),
  ]);

  return {
    status: true,
    message: "Quantity used updated successfully",
    data: updatedMtoItem,
    statusCode: 200,
  };
}

/**
 * Handle ADDED transaction (from Purchase Order)
 * Updates purchase_order_item's quantity_received
 * Increases item inventory quantity
 * Creates stock_transaction with type ADDED
 */
async function handleAddedTransaction(data) {
  const { item_id, quantity, purchase_order_id, notes } = data;

  // Find the purchase_order_item by order_id and item_id
  const poItem = await prisma.purchase_order_item.findFirst({
    where: {
      order_id: purchase_order_id,
      item_id: item_id,
    },
    include: {
      order: true,
      item: true,
    },
  });

  if (!poItem) {
    return {
      status: false,
      message: "Purchase order item not found",
      statusCode: 404,
    };
  }

  // Calculate new quantity_received (increment by quantity)
  const currentReceived = poItem.quantity_received || 0;
  const newQuantityReceived = currentReceived + quantity;

  // Update purchase_order_item's quantity_received
  const updatedPoItem = await prisma.purchase_order_item.update({
    where: { id: poItem.id },
    data: {
      quantity_received: newQuantityReceived,
    },
    include: {
      item: true,
      order: true,
    },
  });

  // Get current item quantity
  const currentItem = await prisma.item.findUnique({
    where: { item_id: item_id },
    select: { quantity: true },
  });

  if (!currentItem) {
    return {
      status: false,
      message: "Item not found",
      statusCode: 404,
    };
  }

  // Increase item inventory quantity
  const currentQuantity = currentItem.quantity || 0;
  const newQuantity = currentQuantity + quantity;

  // Update item quantity and create stock transaction
  await Promise.all([
    prisma.item.update({
      where: { item_id: item_id },
      data: {
        quantity: newQuantity,
      },
    }),
    prisma.stock_transaction.create({
      data: {
        item_id: item_id,
        quantity: quantity,
        type: "ADDED",
        purchase_order_id: purchase_order_id,
        notes: notes || `Received from PO ${purchase_order_id}`,
      },
    }),
  ]);

  // Check if all items are fully received to update PO status
  const updatedPO = await prisma.purchase_order.findUnique({
    where: { id: purchase_order_id },
    include: {
      items: true,
    },
  });

  const allItemsReceived = updatedPO.items.every(
    (item) => (item.quantity_received || 0) >= item.quantity
  );
  const someItemsReceived = updatedPO.items.some(
    (item) => (item.quantity_received || 0) > 0
  );

  let newStatus = updatedPO.status;
  if (allItemsReceived && updatedPO.status !== "CANCELLED") {
    newStatus = "FULLY_RECEIVED";
  } else if (
    someItemsReceived &&
    !allItemsReceived &&
    updatedPO.status !== "CANCELLED"
  ) {
    newStatus = "PARTIALLY_RECEIVED";
  }

  // Apply status update if needed
  if (newStatus !== updatedPO.status) {
    await prisma.purchase_order.update({
      where: { id: purchase_order_id },
      data: { status: newStatus },
    });
  }

  // Fetch updated PO with all relations for return
  const finalPO = await prisma.purchase_order.findUnique({
    where: { id: purchase_order_id },
    include: {
      supplier: true,
      items: {
        include: {
          item: {
            include: {
              sheet: true,
              handle: true,
              hardware: true,
              accessory: true,
            },
          },
        },
      },
      orderedBy: {
        select: {
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
      mto: {
        select: {
          project: { select: { project_id: true, name: true } },
          status: true,
        },
      },
    },
  });

  // Update status in response
  if (newStatus !== updatedPO.status) {
    finalPO.status = newStatus;
  }

  return {
    status: true,
    message: "Quantity received updated successfully",
    data: finalPO,
    statusCode: 200,
  };
}

/**
 * Handle WASTED transaction
 * Only creates stock_transaction
 * Decreases item inventory quantity
 */
async function handleWastedTransaction(data) {
  const { item_id, quantity, notes } = data;

  // Get current item quantity
  const currentItem = await prisma.item.findUnique({
    where: { item_id: item_id },
    select: { quantity: true },
  });

  if (!currentItem) {
    return {
      status: false,
      message: "Item not found",
      statusCode: 404,
    };
  }

  // Decrease item inventory quantity (wasted means always decrease)
  const currentQuantity = currentItem.quantity || 0;
  const newQuantity = Math.max(0, currentQuantity - quantity);

  // Update item quantity and create stock transaction
  await Promise.all([
    prisma.item.update({
      where: { item_id: item_id },
      data: {
        quantity: newQuantity,
      },
    }),
    prisma.stock_transaction.create({
      data: {
        item_id: item_id,
        quantity: quantity,
        type: "WASTED",
        notes: notes || `Wasted item quantity`,
      },
    }),
  ]);

  // Fetch updated item for return
  const updatedItem = await prisma.item.findUnique({
    where: { item_id: item_id },
    include: {
      sheet: true,
      handle: true,
      hardware: true,
      accessory: true,
      edging_tape: true,
    },
  });

  return {
    status: true,
    message: "Wasted quantity recorded successfully",
    data: updatedItem,
    statusCode: 200,
  };
}

/**
 * Main POST handler
 * Routes to appropriate function based on type (ADDED, USED, or WASTED)
 */
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

    const body = await request.json();
    const {
      item_id,
      quantity,
      type,
      notes,
      purchase_order_id,
      materials_to_order_id,
    } = body;

    // Validate required fields
    if (!item_id || quantity === undefined || quantity === null || !type) {
      return NextResponse.json(
        {
          status: false,
          message: "item_id, quantity, and type are required",
        },
        { status: 400 }
      );
    }

    if (quantity < 0) {
      return NextResponse.json(
        {
          status: false,
          message: "quantity must be non-negative",
        },
        { status: 400 }
      );
    }

    // Route to appropriate handler based on type
    let result;
    if (type === "USED") {
      if (!materials_to_order_id) {
        return NextResponse.json(
          {
            status: false,
            message: "materials_to_order_id is required for USED transactions",
          },
          { status: 400 }
        );
      }
      result = await handleUsedTransaction({
        item_id,
        quantity,
        materials_to_order_id,
        notes,
      });
    } else if (type === "ADDED") {
      if (!purchase_order_id) {
        return NextResponse.json(
          {
            status: false,
            message: "purchase_order_id is required for ADDED transactions",
          },
          { status: 400 }
        );
      }
      result = await handleAddedTransaction({
        item_id,
        quantity,
        purchase_order_id,
        notes,
      });
    } else if (type === "WASTED") {
      result = await handleWastedTransaction({
        item_id,
        quantity,
        notes,
      });
    } else {
      return NextResponse.json(
        {
          status: false,
          message: "type must be either 'ADDED', 'USED', or 'WASTED'",
        },
        { status: 400 }
      );
    }

    const logged = await withLogging(
      request,
      "stock_transaction",
      result.data.id,
      "CREATE",
      `Stock transaction created successfully: ${type} for item: ${item_id}`
    );

    if (!logged) {
      return NextResponse.json(
        { status: false, message: "Failed to log stock transaction creation" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        status: result.status,
        message: result.message,
        data: result.data,
      },
      { status: result.statusCode }
    );
  } catch (error) {
    console.error("Error creating stock transaction:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
