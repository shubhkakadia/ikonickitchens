import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";

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

    // Create new user
    const newUser = await prisma.users.create({
      data: {
        username,
        password: hashedPassword,
        user_type,
        is_active,
        employee_id:
          employee_id && employee_id.trim() !== "" ? employee_id : null,
        module_access,
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "User created successfully",
        data: newUser,
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
