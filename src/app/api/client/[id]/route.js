import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";

export async function GET(request, { params }) {
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
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
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
    const { id } = await params;
    const client = await prisma.client.delete({
      where: { client_id: id },
    });
    return NextResponse.json(
      { status: true, message: "Client deleted successfully", data: client },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
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
    return NextResponse.json(
      {
        status: true,
        message: "Client updated successfully",
        data: clientWithRelations,
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
