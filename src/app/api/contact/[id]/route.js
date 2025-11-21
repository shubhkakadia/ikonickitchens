import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";

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
    const contact = await prisma.contact.findUnique({
      where: { id: id },
    });
    return NextResponse.json(
      { status: true, message: "Contact fetched successfully", data: contact },
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
    const contact = await prisma.contact.delete({
      where: { id: id },
    });
    const logged = await withLogging(
      request,
      "contact",
      id,
      "DELETE",
      `Contact deleted successfully: ${contact.first_name} ${contact.last_name}`
    );
    if (!logged) {
      return NextResponse.json(
        { status: false, message: "Failed to log contact deletion" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { status: true, message: "Contact deleted successfully" },
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
      first_name,
      last_name,
      email,
      role,
      phone,
      preferred_contact_method,
      notes,
      client_id,
      supplier_id,
    } = await request.json();
    const contact = await prisma.contact.update({
      where: { id: id },
      data: {
        first_name,
        last_name,
        email,
        role,
        phone,
        preferred_contact_method,
        notes,
        client_id: client_id ? client_id.toLowerCase() : null,
        supplier_id: supplier_id || null,
      },
    });

    const logged = await withLogging(
      request,
      "contact",
      id,
      "UPDATE",
      `Contact updated successfully: ${contact.first_name} ${contact.last_name}`
    );
    if (!logged) {
      return NextResponse.json(
        { status: false, message: "Failed to log contact update" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { status: true, message: "Contact updated successfully", data: contact },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
