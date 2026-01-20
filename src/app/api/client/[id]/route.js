import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
import { formatPhoneToNational } from "@/components/validators";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const client = await prisma.client.findFirst({
      where: {
        client_id: id,
        is_deleted: false,
      },
      select: {
        client_id: true,
        client_name: true,
        client_type: true,
        client_address: true,
        client_phone: true,
        client_email: true,
        client_website: true,
        client_notes: true,
        contacts: true,
        projects: {
          where: {
            is_deleted: false,
          },
          select: {
            id: true,
            project_id: true,
            name: true,
            createdAt: true,
            lots: {
              where: {
                is_deleted: false,
              },
              select: {
                id: true,
                lot_id: true,
                name: true,
                status: true,
                startDate: true,
                installationDueDate: true,
                stages: {
                  select: {
                    name: true,
                    status: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json(
        { status: false, message: "Client not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { status: true, message: "Client fetched successfully", data: client },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/client/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
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
    const formatPhone = (phone) => {
      return phone ? formatPhoneToNational(phone) : phone;
    };

    await prisma.client.update({
      where: { client_id: id },
      data: {
        client_type,
        client_name,
        client_address,
        client_phone: formatPhone(client_phone),
        client_email,
        client_website,
        client_notes,
      },
    });

    // include projects and contacts
    const clientWithRelations = await prisma.client.findUnique({
      where: { client_id: id },
      select: {
        client_id: true,
        client_name: true,
        client_type: true,
        client_address: true,
        client_phone: true,
        client_email: true,
        client_website: true,
        client_notes: true,
        contacts: true,
        projects: {
          where: {
            is_deleted: false,
          },
          select: {
            id: true,
            project_id: true,
            name: true,
            createdAt: true,
            lots: {
              where: {
                is_deleted: false,
              },
              select: {
                id: true,
                lot_id: true,
                name: true,
                status: true,
                startDate: true,
                installationDueDate: true,
                stages: {
                  select: {
                    name: true,
                    status: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    const logged = await withLogging(
      request,
      "client",
      id,
      "UPDATE",
      `Client updated successfully: ${clientWithRelations.client_name}`,
    );
    if (!logged) {
      console.error(
        `Failed to log client update: ${id} - ${clientWithRelations.client_name}`,
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Client updated successfully",
        data: clientWithRelations,
        ...(logged
          ? {}
          : { warning: "Note: Update succeeded but logging failed" }),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in PATCH /api/client/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;

    // Check if client exists and is not already deleted
    const existingClient = await prisma.client.findUnique({
      where: { client_id: id },
    });

    if (!existingClient) {
      return NextResponse.json(
        { status: false, message: "Client not found" },
        { status: 404 },
      );
    }

    if (existingClient.is_deleted) {
      return NextResponse.json(
        { status: false, message: "Client already deleted" },
        { status: 400 },
      );
    }

    // Soft delete the client record (set is_deleted flag)
    const client = await prisma.client.update({
      where: { client_id: id },
      data: { is_deleted: true },
    });

    const logged = await withLogging(
      request,
      "client",
      id,
      "DELETE",
      `Client deleted successfully: ${client.client_name}`,
    );
    if (!logged) {
      console.error(
        `Failed to log client deletion: ${id} - ${client.client_name}`,
      );
      return NextResponse.json(
        {
          status: true,
          message: "Client deleted successfully",
          data: client,
          warning: "Note: Deletion succeeded but logging failed",
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { status: true, message: "Client deleted successfully", data: client },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in DELETE /api/client/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
