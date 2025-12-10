import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const {
      client_type,
      client_name,
      client_address,
      client_phone,
      client_email,
      client_website,
      client_notes,
    } = await request.json();
    // Check if client already exists
    const existingClient = await prisma.client.findUnique({
      where: { client_name },
    });
    if (existingClient) {
      return NextResponse.json(
        {
          status: false,
          message: "Client already exists by this client id: " + client_name,
        },
        { status: 409 }
      );
    }
    const client = await prisma.client.create({
      data: {
        client_type,
        client_name,
        client_address,
        client_phone,
        client_email,
        client_website,
        client_notes,
      },
    });
    const logged = await withLogging(
      request,
      "client",
      client.client_id,
      "CREATE",
      `Client created successfully: ${client.client_name}`
    );
    if (!logged) {
      console.error(`Failed to log client creation: ${client.client_id} - ${client.client_name}`);
      return NextResponse.json(
        { 
          status: true, 
          message: "Client created successfully", 
          data: client,
          warning: "Note: Creation succeeded but logging failed"
        },
        { status: 201 }
      );
    }
    return NextResponse.json(
      { status: true, message: "Client created successfully", data: client },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/client/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
