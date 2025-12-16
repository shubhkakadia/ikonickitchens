import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const clients = await prisma.client.findMany({
      where: {
        is_deleted: false,
      },
      include: {
        contacts: true,
        projects: {
          where: {
            is_deleted: false,
          },
          include: {
            lots: {
              where: {
                is_deleted: false,
              },
              select: {
                status: true,
              },
            },
          },
        },
      },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Clients fetched successfully",
        data: clients,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/client/all:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
