import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

function getItemName(item) {
  if (item.description) return item.description;

  if (item.sheet) {
    return [item.sheet.brand, item.sheet.color, item.sheet.finish]
      .filter(Boolean)
      .join(" - ");
  }

  if (item.handle) {
    return [item.handle.brand, item.handle.type, item.handle.color]
      .filter(Boolean)
      .join(" - ");
  }

  if (item.hardware) {
    return [item.hardware.brand, item.hardware.name, item.hardware.type]
      .filter(Boolean)
      .join(" - ");
  }

  if (item.accessory?.name) return item.accessory.name;

  if (item.edging_tape) {
    return [
      item.edging_tape.brand,
      item.edging_tape.color,
      item.edging_tape.finish,
    ]
      .filter(Boolean)
      .join(" - ");
  }

  return item.item_id;
}

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const project = await prisma.project.findFirst({
      where: { project_id: id, is_deleted: false },
      select: { project_id: true },
    });

    if (!project) {
      return NextResponse.json(
        { status: false, message: "Project not found" },
        { status: 404 },
      );
    }

    const transactions = await prisma.stock_transaction.findMany({
      where: {
        type: "USED",
        OR: [
          { project_id: project.project_id },
          {
            materials_to_order: {
              is: { project_id: project.project_id },
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        lot: { select: { lot_id: true, name: true } },
        materials_to_order: {
          select: {
            id: true,
            lots: { select: { lot_id: true, name: true } },
          },
        },
        item: {
          include: {
            sheet: true,
            handle: true,
            hardware: true,
            accessory: true,
            edging_tape: true,
            itemSuppliers: {
              where: { price: { not: null } },
              select: { price: true },
            },
          },
        },
      },
    });

    const categoryMap = new Map();
    let totalQuantity = 0;
    let estimatedTotalExpense = 0;
    let unpricedTransactionCount = 0;
    let unpricedQuantity = 0;

    const data = transactions.map((transaction) => {
      const prices = transaction.item.itemSuppliers
        .map((supplier) => Number(supplier.price))
        .filter((price) => Number.isFinite(price));
      const unitPrice = prices.length ? Math.min(...prices) : null;
      const estimatedCost =
        unitPrice === null ? null : transaction.quantity * unitPrice;
      const category = transaction.item.category;

      totalQuantity += transaction.quantity;
      if (estimatedCost === null) {
        unpricedTransactionCount += 1;
        unpricedQuantity += transaction.quantity;
      } else {
        estimatedTotalExpense += estimatedCost;
      }

      const categorySummary = categoryMap.get(category) || {
        category,
        quantity: 0,
        estimated_expense: 0,
        transaction_count: 0,
        unpriced_transaction_count: 0,
        unpriced_quantity: 0,
      };
      categorySummary.quantity += transaction.quantity;
      categorySummary.transaction_count += 1;
      if (estimatedCost === null) {
        categorySummary.unpriced_transaction_count += 1;
        categorySummary.unpriced_quantity += transaction.quantity;
      } else {
        categorySummary.estimated_expense += estimatedCost;
      }
      categoryMap.set(category, categorySummary);

      return {
        id: transaction.id,
        created_at: transaction.createdAt,
        quantity: transaction.quantity,
        notes: transaction.notes,
        category,
        item_id: transaction.item.item_id,
        item_name: getItemName(transaction.item),
        measurement_unit: transaction.item.measurement_unit,
        unit_price: unitPrice,
        estimated_cost: estimatedCost,
        lot: transaction.lot,
        mto_lots: transaction.materials_to_order?.lots || [],
      };
    });

    return NextResponse.json({
      status: true,
      message: "Used materials fetched successfully",
      data: {
        transactions: data,
        summary: {
          total_quantity: totalQuantity,
          transaction_count: data.length,
          estimated_total_expense: estimatedTotalExpense,
          unpriced_transaction_count: unpricedTransactionCount,
          unpriced_quantity: unpricedQuantity,
        },
        category_summaries: Array.from(categoryMap.values()).sort(
          (a, b) => b.estimated_expense - a.estimated_expense,
        ),
      },
    });
  } catch (error) {
    console.error("Error fetching project used materials:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
