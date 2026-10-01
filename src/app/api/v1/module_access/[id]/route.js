import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  ALL_ROLES,
  MASTER_ADMIN_ONLY,
  authorizeRequest,
  requireAuth,
} from "@/lib/validators/authFromToken";
import { pickModuleFlags } from "@/lib/userAccounts";
import { withLogging } from "@/lib/withLogging";

export async function GET(request, { params }) {
  try {
    // Every user loads their own permissions on each admin page
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
    const moduleAccess = await prisma.module_access.findUnique({
      where: { user_id: id },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Module access fetched successfully",
        data: moduleAccess,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/module_access/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authError = await requireAuth(request, { roles: MASTER_ADMIN_ONLY });
    if (authError) return authError;
    const { id } = await params;
    const data = await request.json();
    let moduleAccess;
    try {
      moduleAccess = await prisma.module_access.update({
        where: { user_id: id },
        // Omitted flags stay unchanged; unknown keys are ignored
        data: pickModuleFlags(data, { partial: true }),
      });
    } catch (error) {
      console.error("Error updating module access:", error);
      return NextResponse.json(
        {
          status: false,
          message: "Internal server error",
        },
        { status: 500 },
      );
    }

    const logged = await withLogging(
      request,
      "module_access",
      id,
      "UPDATE",
      `Module access updated successfully: ${moduleAccess.user_id}`,
    );
    if (!logged) {
      console.error(`Failed to log module access update: ${id}`);
    }
    return NextResponse.json(
      {
        status: true,
        message: "Module access updated successfully",
        data: moduleAccess,
        ...(logged
          ? {}
          : { warning: "Note: Update succeeded but logging failed" }),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in PATCH /api/module_access/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
