import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const client = await prisma.client.findUnique({
      where: { client_id: id },
      include: {
        projects: {
          include: {
            lots: {
              include: {
                stages: true,
              },
            },
          },
        },
        contacts: true,
      },
    });
    return NextResponse.json(
      { status: true, message: "Client fetched successfully", data: client },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/client/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const {
      client_type,
      client_name,
      client_address,
      client_phone,
      client_email,
      client_website,
      client_notes,
    } = await request.json();
    await prisma.client.update({
      where: { client_id: id },
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

    // include projects and contacts
    const clientWithRelations = await prisma.client.findUnique({
      where: { client_id: id },
      include: {
        projects: {
          include: {
            lots: {
              include: {
                stages: true,
              },
            },
          },
        },
        contacts: true,
      },
    });
    const logged = await withLogging(
      request,
      "client",
      id,
      "UPDATE",
      `Client updated successfully: ${clientWithRelations.client_name}`
    );
    if (!logged) {
      console.error(`Failed to log client update: ${id} - ${clientWithRelations.client_name}`);
    }
    return NextResponse.json(
      {
        status: true,
        message: "Client updated successfully",
        data: clientWithRelations,
        ...(logged ? {} : { warning: "Note: Update succeeded but logging failed" })
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in PATCH /api/client/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const client = await prisma.client.delete({
      where: { client_id: id },
    });
    const logged = await withLogging(
      request,
      "client",
      id,
      "DELETE",
      `Client deleted successfully: ${client.client_name}`
    );
    if (!logged) {
      console.error(`Failed to log client deletion: ${id} - ${client.client_name}`);
      return NextResponse.json(
        {
          status: true,
          message: "Client deleted successfully",
          data: client,
          warning: "Note: Deletion succeeded but logging failed"
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { status: true, message: "Client deleted successfully", data: client },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in DELETE /api/client/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
