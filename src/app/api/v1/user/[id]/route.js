import {
  MAX_IMAGE_BODY,
  readFormData,
  uploadLimitResponse,
} from "@/lib/fileHandler";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  ALL_ROLES,
  MASTER_ADMIN_ONLY,
  USER_TYPES,
  authorizeRequest,
  requireAuth,
} from "@/lib/validators/authFromToken";
import { pickModuleFlags, validatePassword } from "@/lib/userAccounts";
import bcrypt from "bcrypt";
import { withLogging } from "@/lib/withLogging";

function jsonError(message, status) {
  return NextResponse.json({ status: false, message }, { status });
}

export async function GET(request, { params }) {
  try {
    const { error, auth } = await authorizeRequest(request, {
      roles: ALL_ROLES,
    });
    if (error) return error;
    const { id } = await params;
    if (auth.user.id !== id && auth.userType !== "master-admin") {
      return NextResponse.json(
        { status: false, message: "Insufficient permissions" },
        { status: 403 },
      );
    }
    const user = await prisma.users.findUnique({
      where: { id: id },
      omit: { password: true },
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
        { status: 404 },
      );
    }
    return NextResponse.json(
      { status: true, message: "User fetched successfully", data: user },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/v1/user/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { error, auth } = await authorizeRequest(request, {
      roles: ALL_ROLES,
    });
    if (error) return error;
    let body;
    const contentType = request.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const formData = await readFormData(request, MAX_IMAGE_BODY);
      body = Object.fromEntries(formData.entries());
    }
    const { user_type, is_active, password, old_password } = body;
    let { module_access } = body;
    if (typeof module_access === "string") {
      try {
        module_access = JSON.parse(module_access);
      } catch {
        return jsonError("Invalid module access", 400);
      }
    }

    const { id } = await params;
    const isSelf = auth.user.id === id;
    const isMasterAdmin = auth.userType === "master-admin";

    // Only a master-admin may edit other users
    if (!isSelf && !isMasterAdmin) {
      return jsonError("Insufficient permissions", 403);
    }

    const existingUser = await prisma.users.findUnique({
      where: { id: id },
      omit: { password: false },
      include: { module_access: true },
    });
    if (!existingUser) {
      return NextResponse.json(
        { status: false, message: "User not found" },
        { status: 404 },
      );
    }

    // Work out which fields actually change
    const nextUserType =
      user_type === undefined ? undefined : String(user_type).toLowerCase();
    if (nextUserType !== undefined && !USER_TYPES.includes(nextUserType)) {
      return jsonError("Invalid user type", 400);
    }
    const userTypeChanged =
      nextUserType !== undefined &&
      nextUserType !== existingUser.user_type.toLowerCase();

    const nextIsActive =
      is_active === undefined
        ? undefined
        : is_active === true || is_active === "true";
    const isActiveChanged =
      nextIsActive !== undefined && nextIsActive !== existingUser.is_active;

    const moduleFlags =
      module_access === undefined || module_access === null
        ? {}
        : pickModuleFlags(module_access, { partial: true });
    const moduleAccessChanged = Object.entries(moduleFlags).some(
      ([key, value]) => existingUser.module_access?.[key] !== value,
    );

    const passwordChanged =
      typeof password === "string" && password.trim() !== "";

    // Nobody, master-admins included, may change their own role, status or
    // permissions; that has to be done by another master-admin
    if (isSelf && (userTypeChanged || isActiveChanged || moduleAccessChanged)) {
      return jsonError(
        "You cannot change your own role, status or permissions",
        403,
      );
    }

    let hashedPassword;
    if (passwordChanged) {
      // Changing your own password always needs the current one
      if (isSelf) {
        if (!old_password) {
          return jsonError("Current password is required", 400);
        }
        const isValidPassword = await bcrypt.compare(
          old_password,
          existingUser.password,
        );
        if (!isValidPassword) {
          return NextResponse.json(
            { status: false, message: "Current password is incorrect" },
            { status: 401 },
          );
        }
      }
      const passwordError = validatePassword(password, existingUser.username);
      if (passwordError) {
        return jsonError(passwordError, 400);
      }
      hashedPassword = await bcrypt.hash(password, 10);
    }

    let user;
    try {
      user = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.users.update({
          where: { id: id },
          omit: { password: true },
          data: {
            user_type: userTypeChanged ? nextUserType : undefined,
            is_active: isActiveChanged ? nextIsActive : undefined,
            password: hashedPassword,
          },
          include: {
            employee: { select: { first_name: true, last_name: true } },
          },
        });

        let moduleAccess = existingUser.module_access;
        if (moduleAccessChanged) {
          moduleAccess = await tx.module_access.upsert({
            where: { user_id: id },
            update: moduleFlags,
            create: { user_id: id, ...moduleFlags },
          });
        }

        // Log the user out everywhere after a credential, role or status
        // change. When changing your own password, keep the current session.
        if (passwordChanged || userTypeChanged || isActiveChanged) {
          await tx.sessions.deleteMany({
            where: {
              user_id: id,
              ...(isSelf ? { NOT: { id: auth.session.id } } : {}),
            },
          });
        }

        return { ...updatedUser, module_access: moduleAccess };
      });
    } catch (error) {
      console.error("Error updating user:", error);
      return NextResponse.json(
        { status: false, message: "User not updated" },
        { status: 500 },
      );
    }

    const logged = await withLogging(
      request,
      "user",
      id,
      "UPDATE",
      `User updated successfully: ${user.employee?.first_name} ${user.employee?.last_name}`,
    );
    if (!logged) {
      console.error(`Failed to log user update: ${id}`);
    }
    return NextResponse.json(
      {
        status: true,
        message: "User updated successfully",
        data: user,
        ...(logged
          ? {}
          : { warning: "Note: Update succeeded but logging failed" }),
      },
      { status: 200 },
    );
  } catch (error) {
    const tooLarge = uploadLimitResponse(error);
    if (tooLarge) return tooLarge;

    console.error("Error in PATCH /api/v1/user/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// "Deleting" a user deactivates the account instead of erasing it. The row has
// to stay: every audit log entry points at it (logs.user_id is SET NULL on
// delete), so removing it would strip the author from everything the user did.
// The account can no longer sign in, its sessions are revoked, and its link to
// the employee is released so a new account can be created for that employee.
export async function DELETE(request, { params }) {
  try {
    const { error, auth } = await authorizeRequest(request, {
      roles: MASTER_ADMIN_ONLY,
    });
    if (error) return error;
    const { id } = await params;
    const isSelf = auth.user.id === id;

    const existing = await prisma.users.findUnique({
      where: { id },
      omit: { password: true },
      include: {
        employee: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });
    if (!existing) {
      return NextResponse.json(
        { status: false, message: "User not found" },
        { status: 404 },
      );
    }

    // Repeating the request (a double click) changes nothing
    if (!existing.is_active && !existing.employee_id) {
      return NextResponse.json(
        {
          status: true,
          message: "User account is already removed",
          data: existing,
        },
        { status: 200 },
      );
    }

    const user = await prisma.$transaction(async (tx) => {
      // Everyone is logged out; when removing yourself the current session is
      // kept for the rest of this request (the account is inactive anyway, so
      // it can't be used again)
      await tx.sessions.deleteMany({
        where: {
          user_id: id,
          ...(isSelf ? { NOT: { id: auth.session.id } } : {}),
        },
      });
      return tx.users.update({
        where: { id },
        data: { is_active: false, employee_id: null },
        omit: { password: true },
      });
    });

    // The employee link was just released, so the name comes from before
    const person = `${existing.employee?.first_name} ${existing.employee?.last_name}`;
    const logged = await withLogging(
      request,
      "user",
      id,
      "DELETE",
      `User deleted (deactivated, kept for the audit trail): ${person}`,
    );
    if (!logged) {
      console.error(`Failed to log user deletion: ${id} - ${person}`);
      return NextResponse.json(
        {
          status: true,
          message: "User deleted successfully",
          data: user,
          warning: "Note: Deletion succeeded but logging failed",
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { status: true, message: "User deleted successfully", data: user },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in DELETE /api/v1/user/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
