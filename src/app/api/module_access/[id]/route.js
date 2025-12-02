import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";

export async function GET(request, { params }) {
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
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
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
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          status: false,
          message: "Internal server error",
          error: error.message,
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
      return NextResponse.json(
        { status: false, message: "Failed to log module access update" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Module access updated successfully",
        data: moduleAccess,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
