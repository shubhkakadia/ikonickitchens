import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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
      // contact_id will be auto-generated on the server
      first_name,
      last_name,
      email,
      phone,
      preferred_contact_method,
      notes,
      client_id,
      supplier_id,
    } = await request.json();

    // Helper to compute the next contact_id like ct-001, ct-002, ...
    const getNextContactId = async () => {
      const last = await prisma.contact.findFirst({
        select: { contact_id: true },
        orderBy: { contact_id: "desc" },
      });
      const prefix = "ct-";
      const defaultNumeric = 1;
      if (!last || !last.contact_id) {
        return `${prefix}${String(defaultNumeric).padStart(3, "0")}`;
      }
      const parts = String(last.contact_id).split("-");
      const numericPart = parts.length > 1 ? parseInt(parts[1], 10) : NaN;
      const nextNumber = Number.isNaN(numericPart)
        ? defaultNumeric
        : numericPart + 1;
      // Keep at least 3 digits, but grow as needed (e.g., 999 -> 1000)
      const width = Math.max(3, String(nextNumber).length);
      return `${prefix}${String(nextNumber).padStart(width, "0")}`;
    };

    // Attempt create with a short retry loop to mitigate rare race conditions
    let contact = null;

    contact = await prisma.contact.create({
      data: {
        contact_id: await getNextContactId(),
        first_name,
        last_name,
        email,
        phone,
        preferred_contact_method,
        notes,
        client_id: client_id ? client_id.toLowerCase() : null,
        supplier_id: supplier_id || null,
      },
    });

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
