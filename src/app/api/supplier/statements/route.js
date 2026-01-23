import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    // Filter statements where supplier is not deleted
    const statements = await prisma.supplier_statement.findMany({
      where: {
        supplier: {
          is_deleted: false,
        },
      },
      include: {
        supplier: true,
        supplier_file: true,
      },
    });
    if (!statements) {
      return NextResponse.json(
        { status: false, message: "Statements not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Statements fetched successfully",
        data: statements,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/supplier/statements:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
