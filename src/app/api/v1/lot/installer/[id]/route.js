import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { ALL_ROLES, authorizeRequest } from "@/lib/validators/authFromToken";

export async function GET(request, { params }) {
  try {
    const { error, auth } = await authorizeRequest(request, {
      roles: ALL_ROLES,
      modules: ["site_photos"],
    });
    if (error) return error;
    const { id } = await params;
    const userType = auth.userType;

    if (!id) {
      return NextResponse.json(
        { status: false, message: "id is required" },
        { status: 400 },
      );
    }

    const isAdminUser = userType === "master-admin" || userType === "admin";
f
    // Non-admins only ever see their own installer lots, regardless of the
    // id in the URL
    if (!isAdminUser && !auth.user.employee_id) {
      return NextResponse.json(
        {
          status: true,
          message: "Installer lots fetched successfully",
          data: [],
        },
        { status: 200 },
      );
    }

    let installerWhereClause = {
      status: "ACTIVE",
      is_deleted: false,
      installer_id: auth.user.employee_id,
    };

    let adminWhereClause = {
      status: "ACTIVE",
      is_deleted: false,
    };

    const activeLots = await prisma.lot.findMany({
      where: isAdminUser ? adminWhereClause : installerWhereClause,
      include: {
        project: {
          select: {
            name: true,
            project_id: true,
            client: {
              select: {
                client_name: true,
              },
            },
          },
        },
        tabs: {
          where: {
            tab: "CABINETRY_DRAWINGS",
          },
          include: {
            files: {
              where: {
                is_deleted: false,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        },
      },
      orderBy: {
        project: {
          name: "asc",
        },
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: isAdminUser
          ? "All active lots fetched successfully"
          : "Installer lots fetched successfully",
        data: activeLots,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/lot/installer:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
