import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { withLogging } from "../../../../lib/withLogging";

export async function POST(request) {
  try {
    const {
      username,
      password,
      user_type,
      is_active,
      employee_id,
      module_access,
    } = await request.json();

    // Check if user already exists by username
    const existingUser = await prisma.users.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          status: false,
          message: "Username already exists",
        },
        { status: 409 }
      );
    }

    // If employee_id is provided, validate it exists in employees table and is not already linked
    if (employee_id && employee_id.trim() !== "") {
      // Check if the employee exists in the employees table
      const existingEmployee = await prisma.employees.findUnique({
        where: { employee_id },
      });

      if (!existingEmployee) {
        return NextResponse.json(
          {
            status: false,
            message:
              "Employee ID does not exist. Please provide a valid employee ID or leave it empty.",
          },
          { status: 400 }
        );
      }

      // Check if this employee_id is already linked to a user
      const existingUserWithEmployeeId = await prisma.users.findUnique({
        where: { employee_id },
      });

      if (existingUserWithEmployeeId) {
        return NextResponse.json(
          {
            status: false,
            message: "Employee ID is already linked to another user",
          },
          { status: 409 }
        );
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    let newUser;
    let moduleAccess;
    try {
      // Create new user
      newUser = await prisma.users.create({
        data: {
          username,
          password: hashedPassword,
          user_type,
          is_active,
          employee_id:
            employee_id && employee_id.trim() !== "" ? employee_id : null,
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          status: false,
          message: "Internal server error while creating user",
          error: error.message,
        },
        { status: 500 }
      );
    }
    try {
      moduleAccess = await prisma.module_access.create({
        data: {
          user_id: newUser.id,
          all_clients: module_access.all_clients,
          add_clients: module_access.add_clients,
          client_details: module_access.client_details,
          dashboard: module_access.dashboard,
          delete_media: module_access.delete_media,
          all_employees: module_access.all_employees,
          add_employees: module_access.add_employees,
          employee_details: module_access.employee_details,
          all_projects: module_access.all_projects,
          add_projects: module_access.add_projects,
          project_details: module_access.project_details,
          all_suppliers: module_access.all_suppliers,
          add_suppliers: module_access.add_suppliers,
          supplier_details: module_access.supplier_details,
          all_items: module_access.all_items,
          add_items: module_access.add_items,
          item_details: module_access.item_details,
          used_material: module_access.used_material,
          logs: module_access.logs,
          lotatglance: module_access.lotatglance,
          materialstoorder: module_access.materialstoorder,
          purchaseorder: module_access.purchaseorder,
          statements: module_access.statements,
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          status: false,
          message: "Internal server error while creating module access",
          error: error.message,
        },
        { status: 500 }
      );
    }

    const logged = await withLogging(
      request,
      "user",
      newUser.id,
      "CREATE",
      `User created successfully: ${newUser.username}`
    );
    if (!logged) {
      return NextResponse.json(
        { status: false, message: "Failed to log user creation" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "User created successfully",
        data: { user: newUser, module_access: moduleAccess },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
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
