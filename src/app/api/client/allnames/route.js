import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";

export async function GET(request) {
  try {
    const admin = await isAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { status: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    if (await isSessionExpired(request)) {
      return NextResponse.json(
        { status: false, message: "Session expired" },
        { status: 401 }
      );
    }
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
        data: clients.map((client) => ({
          client_id: client.client_id,
          client_name: client.client_name,
          client_type: client.client_type,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
