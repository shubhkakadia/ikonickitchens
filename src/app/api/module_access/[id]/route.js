import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const moduleAccess = await prisma.module_access.findUnique({
      where: { user_id: id },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Module access fetched successfully",
        data: moduleAccess,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/module_access/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const data = await request.json();
    let moduleAccess;
    try {
      moduleAccess = await prisma.module_access.update({
        where: { user_id: id },
        data: {
          all_clients: data.all_clients,
          add_clients: data.add_clients,
          client_details: data.client_details,
          dashboard: data.dashboard,
          delete_media: data.delete_media,
          all_employees: data.all_employees,
          add_employees: data.add_employees,
          employee_details: data.employee_details,
          all_projects: data.all_projects,
          add_projects: data.add_projects,
          project_details: data.project_details,
          all_suppliers: data.all_suppliers,
          add_suppliers: data.add_suppliers,
          supplier_details: data.supplier_details,
          all_items: data.all_items,
          add_items: data.add_items,
          item_details: data.item_details,
          usedmaterial: data.usedmaterial,
          logs: data.logs,
          lotatglance: data.lotatglance,
          materialstoorder: data.materialstoorder,
          purchaseorder: data.purchaseorder,
          statements: data.statements,
          site_photos: data.site_photos,
          config: data.config,
          calendar: data.calendar,
        },
      });
    } catch (error) {
      console.error("Error updating module access:", error);
      return NextResponse.json(
        {
          status: false,
          message: "Internal server error",
        },
        { status: 500 }
      );
    }

    const logged = await withLogging(
      request,
      "module_access",
      id,
      "UPDATE",
      `Module access updated successfully: ${moduleAccess.user_id}`
    );
    if (!logged) {
      console.error(`Failed to log module access update: ${id}`);
    }
    return NextResponse.json(
      {
        status: true,
        message: "Module access updated successfully",
        data: moduleAccess,
        ...(logged ? {} : { warning: "Note: Update succeeded but logging failed" })
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in PATCH /api/module_access/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
