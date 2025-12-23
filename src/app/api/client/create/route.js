import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
import { formatPhoneToNational } from "@/components/validators";

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
      contacts,
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

    const formatPhone = (phone) => {
      return phone ? formatPhoneToNational(phone) : phone;
    }

    // Use transaction to create client and contacts atomically
    const result = await prisma.$transaction(async (tx) => {
      // Create the client
      const client = await tx.client.create({
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
              client_id: client.client_id,
            },
          });
          createdContacts.push(createdContact);
        }
      }

      return { client, createdContacts };
    });

    const { client, createdContacts } = result;

    // Log client creation
    const logged = await withLogging(
      request,
      "client",
      client.client_id,
      "CREATE",
      `Client created successfully: ${client.client_name}`
    );

    // Log contact creations
    for (const contact of createdContacts) {
      await withLogging(
        request,
        "contact",
        contact.id,
        "CREATE",
        `Contact created successfully: ${contact.first_name} ${contact.last_name} for client: ${client.client_name}`
      );
    }

    // Prepare response
    const responseData = {
      status: true,
      message: "Client created successfully",
      data: {
        ...client,
        contacts: createdContacts,
      },
    };

    if (!logged) {
      console.error(
        `Failed to log client creation: ${client.client_id} - ${client.client_name}`
      );
      responseData.warning = "Note: Creation succeeded but logging failed";
    }

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/client/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
