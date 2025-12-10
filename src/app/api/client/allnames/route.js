import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "../../../../../lib/validators/authFromToken";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const clients = await prisma.client.findMany({
      select: {
        client_id: true,
        client_name: true,
        client_type: true,
      },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Clients fetched successfully",
        data: clients
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/client/allnames:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
