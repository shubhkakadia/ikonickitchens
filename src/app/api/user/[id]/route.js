import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import bcrypt from "bcrypt";
import { withLogging } from "@/lib/withLogging";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const user = await prisma.users.findUnique({
      where: { id: id },
      include: {
        employee: {
          include: {
            image: true,
          },
        },
        module_access: true,
      },
    });
    if (!user) {
      return NextResponse.json(
        { status: false, message: "User not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { status: true, message: "User fetched successfully", data: user },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/user/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    let body;
    const contentType = request.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
    }
    const { user_type, is_active, module_access, password, old_password } =
      body;

    const { id } = await params;

    // Try to find user by employee_id first, then by user id
    let existingUser;
    try {
      existingUser = await prisma.users.findUnique({
        where: { id: id },
      });
    } catch (secondError) {
      // If both fail, return error
      return NextResponse.json(
        { status: false, message: "User not found" },
        { status: 404 }
      );
    }

    // If old_password is provided, verify it before updating password
    if (old_password && password) {
      const isValidPassword = await bcrypt.compare(
        old_password,
        existingUser.password
      );
      if (!isValidPassword) {
        return NextResponse.json(
          { status: false, message: "Current password is incorrect" },
          { status: 401 }
        );
      }
    }

    // Build update data object
    const updateData = {};

    // Only include fields that are provided (for password reset, only password is sent)
    if (user_type !== undefined) {
      updateData.user_type = user_type;
    }
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }
    if (module_access !== undefined) {
      updateData.module_access = module_access;
    }

    // Only update password if it's provided and not empty
    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    let user;
    try {
      user = await prisma.users.update({
        where: { id: id },
        data: {
          user_type: updateData.user_type,
          is_active: updateData.is_active,
          password: updateData.password,
        },
      });
      const moduleAccess = await prisma.module_access.update({
        where: { user_id: id },
        data: {
          all_clients: updateData.module_access.all_clients,
          add_clients: updateData.module_access.add_clients,
          client_details: updateData.module_access.client_details,
          dashboard: updateData.module_access.dashboard,
          delete_media: updateData.module_access.delete_media,
          all_employees: updateData.module_access.all_employees,
          add_employees: updateData.module_access.add_employees,
          employee_details: updateData.module_access.employee_details,
          all_projects: updateData.module_access.all_projects,
          add_projects: updateData.module_access.add_projects,
          project_details: updateData.module_access.project_details,
          all_suppliers: updateData.module_access.all_suppliers,
          add_suppliers: updateData.module_access.add_suppliers,
          supplier_details: updateData.module_access.supplier_details,
          all_items: updateData.module_access.all_items,
          add_items: updateData.module_access.add_items,
          item_details: updateData.module_access.item_details,
          usedmaterial: updateData.module_access.usedmaterial,
          logs: updateData.module_access.logs,
          lotatglance: updateData.module_access.lotatglance,
          materialstoorder: updateData.module_access.materialstoorder,
          purchaseorder: updateData.module_access.purchaseorder,
          statements: updateData.module_access.statements,
        },
      });
      user = {
        ...user,
        module_access: moduleAccess,
      };
    } catch (error) {
      console.error("Error updating user:", error);
      return NextResponse.json(
        { status: false, message: "User not updated" },
        { status: 404 }
      );
    }

    const logged = await withLogging(
      request,
      "user",
      id,
      "UPDATE",
      `User updated successfully: ${user.employee?.first_name} ${user.employee?.last_name}`
    );
    if (!logged) {
      console.error(`Failed to log user update: ${id}`);
    }
    return NextResponse.json(
      {
        status: true,
        message: "User updated successfully",
        data: user,
        ...(logged ? {} : { warning: "Note: Update succeeded but logging failed" })
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in PATCH /api/user/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const user = await prisma.users.delete({
      where: { id: id },
      include: {
        employee: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });
    const logged = await withLogging(
      request,
      "user",
      id,
      "DELETE",
      `User deleted successfully: ${user.employee?.first_name} ${user.employee?.last_name}`
    );
    if (!logged) {
      console.error(`Failed to log user deletion: ${id} - ${user.employee?.first_name} ${user.employee?.last_name}`);
      return NextResponse.json(
        {
          status: true,
          message: "User deleted successfully",
          data: user,
          warning: "Note: Deletion succeeded but logging failed"
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { status: true, message: "User deleted successfully", data: user },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in DELETE /api/user/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
