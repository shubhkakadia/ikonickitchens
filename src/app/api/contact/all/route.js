import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "../../../../../lib/validators/authFromToken";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const contacts = await prisma.contact.findMany();
    return NextResponse.json(
      {
        status: true,
        message: "Contacts fetched successfully",
        data: contacts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/contact/all:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
