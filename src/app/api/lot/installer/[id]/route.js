import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth, getUserFromToken } from "@/lib/validators/authFromToken";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const session = await getUserFromToken(request);
    const userType = session?.user_type;
    
    if (!id) {
      return NextResponse.json(
        { status: false, message: "id is required" },
        { status: 400 },
      );
    }

    // Build the where clause based on user type
    let installerWhereClause = {
      status: "ACTIVE",
      is_deleted: false,
      installer_id: id,
    };

    let adminWhereClause = {
      status: "ACTIVE",
      is_deleted: false,
    };

    const activeLots = await prisma.lot.findMany({
      where:
        userType === "master-admin" || userType === "admin"
          ? adminWhereClause
          : installerWhereClause,
      include: {
        project: {
          select: {
            name: true,
            project_id: true,
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
        message:
          userType === "master-admin" || userType === "admin"
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
