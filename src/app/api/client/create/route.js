import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";

export async function POST(request) {
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
    const {
      client_id,
      client_type,
      client_name,
      client_address,
      client_phone,
      client_email,
      client_website,
      client_notes,
    } = await request.json();
    // Check if employee_id already exists
    const existingClient = await prisma.client.findUnique({
      where: { client_id },
    });
    if (existingClient) {
      return NextResponse.json(
        {
          status: false,
          message: "Client already exists by this client id: " + client_id,
        },
        { status: 409 }
      );
    }
    const client = await prisma.client.create({
      data: {
        client_id: client_id.toLowerCase(),
        client_type,
        client_name,
        client_address,
        client_phone,
        client_email,
        client_website,
        client_notes,
      },
    });
    return NextResponse.json(
      { status: true, message: "Client created successfully", data: client },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
