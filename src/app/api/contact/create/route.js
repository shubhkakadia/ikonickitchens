import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";

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

    // Attempt create with a short retry loop to mitigate rare race conditions
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
      return NextResponse.json(
        { status: false, message: "Failed to log contact creation" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { status: true, message: "Contact created successfully", data: contact },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
