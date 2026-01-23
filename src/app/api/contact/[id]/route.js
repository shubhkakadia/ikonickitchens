import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const contact = await prisma.contact.findUnique({
      where: { id: id },
    });
    return NextResponse.json(
      { status: true, message: "Contact fetched successfully", data: contact },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/contact/[id]:", error);
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
      `Contact updated successfully: ${contact.first_name} ${contact.last_name}`,
    );
    if (!logged) {
      console.error(
        `Failed to log contact update: ${id} - ${contact.first_name} ${contact.last_name}`,
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Contact updated successfully",
        data: contact,
        ...(logged
          ? {}
          : { warning: "Note: Update succeeded but logging failed" }),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in PATCH /api/contact/[id]:", error);
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
    const contact = await prisma.contact.delete({
      where: { id: id },
    });
    const logged = await withLogging(
      request,
      "contact",
      id,
      "DELETE",
      `Contact deleted successfully: ${contact.first_name} ${contact.last_name}`,
    );
    if (!logged) {
      console.error(
        `Failed to log contact deletion: ${id} - ${contact.first_name} ${contact.last_name}`,
      );
      return NextResponse.json(
        {
          status: true,
          message: "Contact deleted successfully",
          warning: "Note: Deletion succeeded but logging failed",
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { status: true, message: "Contact deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in DELETE /api/contact/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
