import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { withLogging } from "@/lib/withLogging";

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

    // Use transaction to ensure atomicity - both user and module_access must succeed or both fail
    let newUser;
    let moduleAccess;
    try {
      await prisma.$transaction(async (tx) => {
        // Create new user
        newUser = await tx.users.create({
          data: {
            username,
            password: hashedPassword,
            user_type,
            is_active,
            employee_id:
              employee_id && employee_id.trim() !== "" ? employee_id : null,
          },
        });

        // Create module access - if this fails, user creation will be rolled back
        moduleAccess = await tx.module_access.create({
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
            usedmaterial: module_access.usedmaterial,
            logs: module_access.logs,
            lotatglance: module_access.lotatglance,
            materialstoorder: module_access.materialstoorder,
            purchaseorder: module_access.purchaseorder,
            statements: module_access.statements,
            site_photos: module_access.site_photos,
            config: module_access.config,
          },
        });
      });
    } catch (error) {
      console.error("Error creating user or module access in signup:", error);
      return NextResponse.json(
        {
          status: false,
          message: "Internal server error while creating user or module access",
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
      console.error(`Failed to log user creation: ${newUser.id} - ${newUser.username}`);
      return NextResponse.json(
        {
          status: true,
          message: "User created successfully",
          data: { user: newUser, module_access: moduleAccess },
          warning: "Note: Creation succeeded but logging failed"
        },
        { status: 201 }
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
      },
      { status: 500 }
    );
  }
}
