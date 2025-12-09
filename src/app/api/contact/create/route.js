import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const {
      // id will be auto-generated on the server
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

    let contact = null;

    contact = await prisma.contact.create({
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
      contact.id,
      "CREATE",
      `Contact created successfully: ${contact.first_name} ${contact.last_name}`
    );

    if (!logged) {
      console.error(`Failed to log contact creation: ${contact.id} - ${contact.first_name} ${contact.last_name}`);
      return NextResponse.json(
        { 
          status: true, 
          message: "Contact created successfully", 
          data: contact,
          warning: "Note: Creation succeeded but logging failed"
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { status: true, message: "Contact created successfully", data: contact },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/contact/create:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
