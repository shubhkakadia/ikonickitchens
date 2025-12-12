import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

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

  // Verify item exists
  const itemExists = await prisma.item.findUnique({
    where: { item_id: item_id },
    select: { item_id: true },
  });

  if (!itemExists) {
    return {
      status: false,
      message: "Item not found",
      statusCode: 404,
    };
  }

  // Calculate new quantity_used (increment by quantity)
  const currentUsed = mtoItem.quantity_used || 0;
  const newQuantityUsed = currentUsed + quantity;

  // Wrap all database writes in a transaction to ensure atomicity
  const [updatedMtoItem] = await prisma.$transaction([
    // Update materials_to_order_item's quantity_used
    prisma.materials_to_order_item.update({
      where: { id: mtoItem.id },
      data: {
        quantity_used: newQuantityUsed,
      },
      include: {
        item: true,
        mto: true,
      },
    }),
    // Atomically decrease item inventory quantity
    prisma.item.update({
      where: { item_id: item_id },
      data: {
        quantity: {
          decrement: quantity,
        },
      },
    }),
    // Create stock transaction
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

  // Verify item exists
  const itemExists = await prisma.item.findUnique({
    where: { item_id: item_id },
    select: { item_id: true },
  });

  if (!itemExists) {
    return {
      status: false,
      message: "Item not found",
      statusCode: 404,
    };
  }

  // Calculate new quantity_received (increment by quantity)
  const currentReceived = poItem.quantity_received || 0;
  const newQuantityReceived = currentReceived + quantity;

  // Wrap all database writes in a transaction to ensure atomicity
  await prisma.$transaction(async (tx) => {
    // Update purchase_order_item's quantity_received
    await tx.purchase_order_item.update({
      where: { id: poItem.id },
      data: {
        quantity_received: newQuantityReceived,
      },
    });

    // Atomically increase item inventory quantity
    await tx.item.update({
      where: { item_id: item_id },
      data: {
        quantity: {
          increment: quantity,
        },
      },
    });

    // Create stock transaction
    await tx.stock_transaction.create({
      data: {
        item_id: item_id,
        quantity: quantity,
        type: "ADDED",
        purchase_order_id: purchase_order_id,
        notes: notes || `Received from PO ${purchase_order_id}`,
      },
    });

    // Check if all items are fully received to update PO status
    const updatedPO = await tx.purchase_order.findUnique({
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
      await tx.purchase_order.update({
        where: { id: purchase_order_id },
        data: { status: newStatus },
      });
    }
  });

  // Fetch updated PO with all relations for return (after transaction commits)
  // Status was already updated inside the transaction, so it will be correct here
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

  return {
    status: true,
    message: "Quantity received updated successfully",
    data: finalPO,
    statusCode: 200,
  };
}

/**
 * Handle manual USED transaction (without MTO)
 * Decreases item inventory quantity
 * Creates stock_transaction with type USED
 */
async function handleManualUsedTransaction(data) {
  const { item_id, quantity, notes } = data;

  // Verify item exists
  const itemExists = await prisma.item.findUnique({
    where: { item_id: item_id },
    select: { item_id: true, quantity: true },
  });

  if (!itemExists) {
    return {
      status: false,
      message: "Item not found",
      statusCode: 404,
    };
  }

  // Check if sufficient quantity is available
  if (itemExists.quantity < quantity) {
    return {
      status: false,
      message: `Insufficient quantity. Available: ${itemExists.quantity}, Requested: ${quantity}`,
      statusCode: 400,
    };
  }

  // Wrap all database writes in a transaction to ensure atomicity
  const [updatedItem, stockTransaction] = await prisma.$transaction([
    // Atomically decrease item inventory quantity
    prisma.item.update({
      where: { item_id: item_id },
      data: {
        quantity: {
          decrement: quantity,
        },
      },
      include: {
        sheet: true,
        handle: true,
        hardware: true,
        accessory: true,
        edging_tape: true,
      },
    }),
    // Create stock transaction
    prisma.stock_transaction.create({
      data: {
        item_id: item_id,
        quantity: quantity,
        type: "USED",
        notes: notes || `Manually recorded used quantity`,
      },
    }),
  ]);

  return {
    status: true,
    message: "Material used recorded successfully",
    data: stockTransaction,
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

  // Verify item exists
  const itemExists = await prisma.item.findUnique({
    where: { item_id: item_id },
    select: { item_id: true },
  });

  if (!itemExists) {
    return {
      status: false,
      message: "Item not found",
      statusCode: 404,
    };
  }

  // Wrap all database writes in a transaction to ensure atomicity
  await prisma.$transaction([
    // Atomically decrease item inventory quantity
    prisma.item.update({
      where: { item_id: item_id },
      data: {
        quantity: {
          decrement: quantity,
        },
      },
    }),
    // Create stock transaction
    prisma.stock_transaction.create({
      data: {
        item_id: item_id,
        quantity: quantity,
        type: "WASTED",
        notes: notes || `Wasted item quantity`,
      },
    }),
  ]);

  // Fetch updated item for return (after transaction commits)
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
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

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
      // If materials_to_order_id is provided, use MTO handler
      // Otherwise, use manual handler
      if (materials_to_order_id) {
        result = await handleUsedTransaction({
          item_id,
          quantity,
          materials_to_order_id,
          notes,
        });
      } else {
        result = await handleManualUsedTransaction({
          item_id,
          quantity,
          notes,
        });
      }
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
      console.error(`Failed to log stock transaction creation: ${result.data.id}`);
    }

    return NextResponse.json(
      {
        status: result.status,
        message: result.message,
        ...(logged ? {} : { warning: "Note: Creation succeeded but logging failed" }),
        data: result.data,
      },
      { status: result.statusCode }
    );
  } catch (error) {
    console.error("Error in POST /api/stock_transaction/create:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
