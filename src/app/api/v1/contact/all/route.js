import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/validators/authFromToken";

export async function GET(request) {
  try {
    const authError = await requireAuth(request, {
      modules: ["client_details", "supplier_details"],
    });
    if (authError) return authError;
    const contacts = await prisma.contact.findMany();
    return NextResponse.json(
      {
        status: true,
        message: "Contacts fetched successfully",
        data: contacts,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/v1/contact/all:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
