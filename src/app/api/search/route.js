import { NextResponse } from "next/server";
import { Category } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { search } = await request.json();

    if (!search || typeof search !== "string" || search.trim() === "") {
      return NextResponse.json(
        { status: false, message: "Search term is required" },
        { status: 400 },
      );
    }

    const searchTerm = search.trim();
    const searchTermUpper = searchTerm.toUpperCase();

    // Search for client, employee, item, supplier, project
    // for client get client_id, client_type, client_name
    // for employee get employee_id, image, first_name, last_name, role
    // for item get item_id, category, image, quantity, measurement_unit, brand, color, finish, type, name, sub_category,
    // for supplier get supplier_id, supplier_name
    //  for project get project_id, project_name, number of lots,

    // Search clients
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { client_name: { contains: searchTerm } },
          { client_type: { contains: searchTerm } },
        ],
      },
      select: {
        client_id: true,
        client_type: true,
        client_name: true,
      },
    });

    // Search employees
    const employees = await prisma.employees.findMany({
      where: {
        OR: [
          { first_name: { contains: searchTerm } },
          { last_name: { contains: searchTerm } },
          { role: { contains: searchTerm } },
        ],
        is_active: {
          not: false, // Only return active employees (is_active !== false, defaults to true)
        },
      },
      select: {
        employee_id: true,
        first_name: true,
        last_name: true,
        role: true,
        image: {
          select: {
            url: true,
          },
        },
      },
    });

    // Search suppliers
    const suppliers = await prisma.supplier.findMany({
      where: {
        name: { contains: searchTerm },
      },
      select: {
        supplier_id: true,
        name: true,
      },
    });

    // Search projects
    const projects = await prisma.project.findMany({
      where: {
        name: { contains: searchTerm },
      },
      select: {
        project_id: true,
        name: true,
        lots: {
          select: {
            lot_id: true,
          },
        },
      },
    });

    // Search items - handle enums separately to avoid invalid Prisma filters
    const categoryMatch =
      Category && typeof Category === "object"
        ? Object.values(Category).find((c) => c === searchTermUpper)
        : null;

    const itemSearchOR = [
      { measurement_unit: { contains: searchTerm } },
      { description: { contains: searchTerm } },
      {
        sheet: {
          OR: [
            { brand: { contains: searchTerm } },
            { color: { contains: searchTerm } },
            { finish: { contains: searchTerm } },
          ],
        },
      },
      {
        handle: {
          OR: [
            { brand: { contains: searchTerm } },
            { color: { contains: searchTerm } },
            { type: { contains: searchTerm } },
          ],
        },
      },
      {
        hardware: {
          OR: [
            { brand: { contains: searchTerm } },
            { name: { contains: searchTerm } },
            { type: { contains: searchTerm } },
            { sub_category: { contains: searchTerm } },
          ],
        },
      },
      {
        accessory: {
          name: { contains: searchTerm },
        },
      },
      {
        edging_tape: {
          OR: [
            { brand: { contains: searchTerm } },
            { color: { contains: searchTerm } },
            { finish: { contains: searchTerm } },
          ],
        },
      },
    ];

    if (categoryMatch) {
      itemSearchOR.push({ category: categoryMatch });
    }

    const items = await prisma.item.findMany({
      where: {
        OR: itemSearchOR,
      },
      select: {
        item_id: true,
        category: true,
        quantity: true,
        measurement_unit: true,
        image: {
          select: {
            url: true,
          },
        },
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
            type: true,
            name: true,
            sub_category: true,
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
      },
    });

    // Transform the results to match the requested format
    const transformedClients = clients.map((client) => ({
      client_id: client.client_id,
      client_type: client.client_type,
      client_name: client.client_name,
    }));

    const transformedEmployees = employees.map((employee) => ({
      employee_id: employee.employee_id,
      image: employee.image?.url || null,
      first_name: employee.first_name,
      last_name: employee.last_name,
      role: employee.role,
    }));

    const transformedSuppliers = suppliers.map((supplier) => ({
      supplier_id: supplier.supplier_id,
      supplier_name: supplier.name,
    }));

    const transformedProjects = projects.map((project) => ({
      project_id: project.project_id,
      project_name: project.name,
      number_of_lots: project.lots.length,
    }));

    const transformedItems = items.map((item) => {
      const result = {
        item_id: item.item_id,
        category: item.category,
        image: item.image?.url || null,
        quantity: item.quantity,
        measurement_unit: item.measurement_unit,
        brand: null,
        color: null,
        finish: null,
        type: null,
        name: null,
        sub_category: null,
      };

      // Extract fields based on category
      if (item.sheet) {
        result.brand = item.sheet.brand;
        result.color = item.sheet.color;
        result.finish = item.sheet.finish;
      } else if (item.handle) {
        result.brand = item.handle.brand;
        result.color = item.handle.color;
        result.type = item.handle.type;
      } else if (item.hardware) {
        result.brand = item.hardware.brand;
        result.type = item.hardware.type;
        result.name = item.hardware.name;
        result.sub_category = item.hardware.sub_category;
      } else if (item.accessory) {
        result.name = item.accessory.name;
      } else if (item.edging_tape) {
        result.brand = item.edging_tape.brand;
        result.color = item.edging_tape.color;
        result.finish = item.edging_tape.finish;
      }

      return result;
    });

    return NextResponse.json({
      status: true,
      data: {
        clients: transformedClients,
        employees: transformedEmployees,
        items: transformedItems,
        suppliers: transformedSuppliers,
        projects: transformedProjects,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/search:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
