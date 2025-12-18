import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function PATCH(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { id, entity_type } = body;

    if (!id || !entity_type) {
      return NextResponse.json(
        { status: false, message: "ID and entity type are required" },
        { status: 400 }
      );
    }

    let recoveredRecord = null;
    let entityId = null;

    // Recover based on entity type
    switch (entity_type) {
      case "employee": {
        const employee = await prisma.employees.findUnique({
          where: { id },
        });
        if (!employee) {
          return NextResponse.json(
            { status: false, message: "Employee not found" },
            { status: 404 }
          );
        }
        recoveredRecord = await prisma.employees.update({
          where: { id },
          data: { is_deleted: false },
        });
        entityId = employee.employee_id;
        break;
      }
      case "client": {
        const client = await prisma.client.findUnique({
          where: { client_id: id },
        });
        if (!client) {
          return NextResponse.json(
            { status: false, message: "Client not found" },
            { status: 404 }
          );
        }
        recoveredRecord = await prisma.client.update({
          where: { client_id: id },
          data: { is_deleted: false },
        });
        entityId = client.client_id;
        break;
      }
      case "project": {
        const project = await prisma.project.findUnique({
          where: { id },
        });
        if (!project) {
          return NextResponse.json(
            { status: false, message: "Project not found" },
            { status: 404 }
          );
        }
        recoveredRecord = await prisma.project.update({
          where: { id },
          data: { is_deleted: false },
        });
        entityId = project.project_id;
        break;
      }
      case "lot": {
        const lot = await prisma.lot.findUnique({
          where: { id },
        });
        if (!lot) {
          return NextResponse.json(
            { status: false, message: "Lot not found" },
            { status: 404 }
          );
        }
        recoveredRecord = await prisma.lot.update({
          where: { id },
          data: { is_deleted: false },
        });
        entityId = lot.lot_id;
        break;
      }
      case "item": {
        const item = await prisma.item.findUnique({
          where: { item_id: id },
        });
        if (!item) {
          return NextResponse.json(
            { status: false, message: "Item not found" },
            { status: 404 }
          );
        }
        recoveredRecord = await prisma.item.update({
          where: { item_id: id },
          data: { is_deleted: false },
        });
        entityId = item.item_id;
        break;
      }
      case "supplier": {
        const supplier = await prisma.supplier.findUnique({
          where: { supplier_id: id },
        });
        if (!supplier) {
          return NextResponse.json(
            { status: false, message: "Supplier not found" },
            { status: 404 }
          );
        }
        recoveredRecord = await prisma.supplier.update({
          where: { supplier_id: id },
          data: { is_deleted: false },
        });
        entityId = supplier.supplier_id;
        break;
      }
      default:
        return NextResponse.json(
          { status: false, message: "Invalid entity type" },
          { status: 400 }
        );
    }

    // Log the recovery action
    const logged = await withLogging(
      request,
      entity_type,
      entityId,
      "UPDATE",
      `${entity_type} recovered successfully`
    );

    if (!logged) {
      console.error(
        `Failed to log ${entity_type} recovery: ${entityId}`
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: `${entity_type} recovered successfully`,
        data: recoveredRecord,
        ...(logged ? {} : { warning: "Note: Recovery succeeded but logging failed" }),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in PATCH /api/deletedrecords/recover:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
