import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    // Fetch all deleted records from different tables
    const deletedEmployees = await prisma.employees.findMany({
      where: { is_deleted: true },
      select: {
        id: true,
        employee_id: true,
        first_name: true,
        last_name: true,
        role: true,
        updatedAt: true,
      },
    });

    const deletedClients = await prisma.client.findMany({
      where: { is_deleted: true },
      select: {
        client_id: true,
        client_name: true,
        updatedAt: true,
      },
    });

    const deletedProjects = await prisma.project.findMany({
      where: { is_deleted: true },
      select: {
        id: true,
        project_id: true,
        name: true,
        lots: {
          where: { is_deleted: false },
          select: {
            name: true,
            lot_id: true,
          },
        },
        updatedAt: true,
      },
    });

    const deletedLots = await prisma.lot.findMany({
      where: { is_deleted: true },
      select: {
        id: true,
        lot_id: true,
        name: true,
        updatedAt: true,
      },
    });

    const deletedItems = await prisma.item.findMany({
      where: { is_deleted: true },
      select: {
        item_id: true,
        category: true,
        description: true,
        sheet: {
          select: {
            brand: true,
            color: true,
            finish: true,
          },
        },
        handle: {
          select: {
            brand: true,
            color: true,
            type: true,
          },
        },
        hardware: {
          select: {
            brand: true,
            name: true,
            type: true,
          },
        },
        accessory: {
          select: {
            name: true,
          },
        },
        edging_tape: {
          select: {
            brand: true,
            color: true,
            finish: true,
          },
        },
        updatedAt: true,
      },
    });

    const deletedSuppliers = await prisma.supplier.findMany({
      where: { is_deleted: true },
      select: {
        supplier_id: true,
        name: true,
        updatedAt: true,
      },
    });

    // Transform data to include entity type and slug
    const allDeletedRecords = [];

    // Employees
    deletedEmployees.forEach((emp) => {
      allDeletedRecords.push({
        id: emp.id,
        entity_id: emp.employee_id,
        entity_type: "employee",
        slug: `${emp.first_name} ${emp.last_name || ""} ${emp.role}`.trim(),
        updatedAt: emp.updatedAt,
      });
    });

    // Clients
    deletedClients.forEach((client) => {
      allDeletedRecords.push({
        id: client.client_id,
        entity_id: client.client_id,
        entity_type: "client",
        slug: client.client_name,
        updatedAt: client.updatedAt,
      });
    });

    // Projects
    deletedProjects.forEach((project) => {
      const lotsCount = project.lots?.length || 0;
      const lotsNames = project.lots?.map((l) => l.name).join(", ") || "";
      allDeletedRecords.push({
        id: project.id,
        entity_id: project.project_id,
        entity_type: "project",
        slug: `${lotsCount} lot(s): ${lotsNames || project.name}`,
        updatedAt: project.updatedAt,
      });
    });

    // Lots
    deletedLots.forEach((lot) => {
      allDeletedRecords.push({
        id: lot.id,
        entity_id: lot.lot_id,
        entity_type: "lot",
        slug: `${lot.name} (${lot.lot_id})`,
        updatedAt: lot.updatedAt,
      });
    });

    // Items
    deletedItems.forEach((item) => {
      let slugParts = [item.category];
      
      if (item.sheet) {
        const parts = [
          item.sheet.brand,
          item.sheet.color,
          item.sheet.finish,
        ].filter(Boolean);
        if (parts.length > 0) slugParts.push(...parts);
      } else if (item.handle) {
        const parts = [
          item.handle.brand,
          item.handle.color,
          item.handle.type,
        ].filter(Boolean);
        if (parts.length > 0) slugParts.push(...parts);
      } else if (item.hardware) {
        const parts = [
          item.hardware.brand,
          item.hardware.name,
          item.hardware.type,
        ].filter(Boolean);
        if (parts.length > 0) slugParts.push(...parts);
      } else if (item.accessory) {
        if (item.accessory.name) slugParts.push(item.accessory.name);
      } else if (item.edging_tape) {
        const parts = [
          item.edging_tape.brand,
          item.edging_tape.color,
          item.edging_tape.finish,
        ].filter(Boolean);
        if (parts.length > 0) slugParts.push(...parts);
      }
      
      if (item.description) slugParts.push(item.description);
      
      allDeletedRecords.push({
        id: item.item_id,
        entity_id: item.item_id,
        entity_type: "item",
        slug: slugParts.join(", ") || item.category,
        updatedAt: item.updatedAt,
      });
    });

    // Suppliers
    deletedSuppliers.forEach((supplier) => {
      allDeletedRecords.push({
        id: supplier.supplier_id,
        entity_id: supplier.supplier_id,
        entity_type: "supplier",
        slug: supplier.name,
        updatedAt: supplier.updatedAt,
      });
    });

    // Sort by updatedAt descending (most recently deleted first)
    allDeletedRecords.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return NextResponse.json(
      {
        status: true,
        message: "Deleted records fetched successfully",
        data: allDeletedRecords,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/deletedrecords/all:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
