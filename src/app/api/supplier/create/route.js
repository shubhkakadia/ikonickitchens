import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { name, email, phone, address, notes, website, abn_number, contacts } =
      await request.json();
    const existingSupplier = await prisma.supplier.findUnique({
      where: { name },
    });
    if (existingSupplier) {
      return NextResponse.json(
        {
          status: false,
          message: "Supplier already exists by this name: " + name,
        },
        { status: 409 }
      );
    }

    // Validate contacts if provided
    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      // Validate required fields for all contacts
      for (const contact of contacts) {
        if (!contact.first_name || !contact.last_name) {
          return NextResponse.json(
            {
              status: false,
              message: "First Name and Last Name are required for all contacts",
            },
            { status: 400 }
          );
        }
      }
    }

    // Use transaction to create supplier and contacts atomically
    const result = await prisma.$transaction(async (tx) => {
      // Create the supplier
      const supplier = await tx.supplier.create({
        data: { name, email, phone, address, notes, website, abn_number },
      });

      // Create contacts if provided
      const createdContacts = [];
      if (contacts && Array.isArray(contacts) && contacts.length > 0) {
        for (const contact of contacts) {
          const createdContact = await tx.contact.create({
            data: {
              first_name: contact.first_name,
              last_name: contact.last_name,
              email: contact.email || null,
              phone: contact.phone || null,
              role: contact.role || null,
              preferred_contact_method: contact.preferred_contact_method || null,
              notes: contact.notes || null,
              supplier_id: supplier.supplier_id,
            },
          });
          createdContacts.push(createdContact);
        }
      }

      return { supplier, createdContacts };
    });

    const { supplier, createdContacts } = result;

    // Log supplier creation
    const logged = await withLogging(
      request,
      "supplier",
      supplier.supplier_id,
      "CREATE",
      `Supplier created successfully: ${supplier.name}`
    );

    // Log contact creations
    for (const contact of createdContacts) {
      await withLogging(
        request,
        "contact",
        contact.id,
        "CREATE",
        `Contact created successfully: ${contact.first_name} ${contact.last_name} for supplier: ${supplier.name}`
      );
    }

    // Prepare response
    const responseData = {
      status: true,
      message: "Supplier created successfully",
      data: {
        ...supplier,
        contacts: createdContacts,
      },
    };

    if (!logged) {
      console.error(
        `Failed to log supplier creation: ${supplier.supplier_id} - ${supplier.name}`
      );
      responseData.warning = "Note: Creation succeeded but logging failed";
    }

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/supplier/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
