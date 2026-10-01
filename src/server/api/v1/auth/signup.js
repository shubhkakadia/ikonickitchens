import "server-only";

import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api/response";
import {
  MASTER_ADMIN_ONLY,
  USER_TYPES,
  requireAuth,
} from "@/lib/validators/authFromToken";
import { pickModuleFlags, validatePassword } from "@/lib/userAccounts";
import { withLogging } from "@/lib/withLogging";

// Never return the password hash to the client
const USER_PUBLIC_SELECT = {
  id: true,
  username: true,
  user_type: true,
  is_active: true,
  employee_id: true,
  createdAt: true,
  updatedAt: true,
};

export async function signup(request) {
  try {
    const authError = await requireAuth(request, { roles: MASTER_ADMIN_ONLY });
    if (authError) return authError;

    const body = await request.json();
    const { password, user_type, employee_id, module_access } = body;
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const is_active = body.is_active === true || body.is_active === "true";

    if (!username) {
      return apiError("Username is required", 400);
    }

    const passwordError = validatePassword(password, username);
    if (passwordError) {
      return apiError(passwordError, 400);
    }

    if (!USER_TYPES.includes(user_type)) {
      return apiError("Invalid user type", 400);
    }

    if (
      employee_id !== undefined &&
      employee_id !== null &&
      typeof employee_id !== "string"
    ) {
      return apiError("Invalid employee ID", 400);
    }

    const existingUser = await prisma.users.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          status: false,
          message: "Username already exists",
        },
        { status: 409 },
      );
    }

    if (employee_id && employee_id.trim() !== "") {
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
          { status: 400 },
        );
      }

      const existingUserWithEmployeeId = await prisma.users.findUnique({
        where: { employee_id },
      });

      if (existingUserWithEmployeeId) {
        return NextResponse.json(
          {
            status: false,
            message: "Employee ID is already linked to another user",
          },
          { status: 409 },
        );
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let newUser;
    let moduleAccess;

    try {
      await prisma.$transaction(async (tx) => {
        newUser = await tx.users.create({
          data: {
            username,
            password: hashedPassword,
            user_type,
            is_active,
            employee_id:
              employee_id && employee_id.trim() !== "" ? employee_id : null,
          },
          select: USER_PUBLIC_SELECT,
        });

        moduleAccess = await tx.module_access.create({
          data: {
            user_id: newUser.id,
            ...pickModuleFlags(module_access),
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
        { status: 500 },
      );
    }

    const logged = await withLogging(
      request,
      "user",
      newUser.id,
      "CREATE",
      `User created successfully: ${newUser.username}`,
    );

    if (!logged) {
      console.error(
        `Failed to log user creation: ${newUser.id} - ${newUser.username}`,
      );
      return NextResponse.json(
        {
          status: true,
          message: "User created successfully",
          data: { user: newUser, module_access: moduleAccess },
          warning: "Note: Creation succeeded but logging failed",
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: "User created successfully",
        data: { user: newUser, module_access: moduleAccess },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
