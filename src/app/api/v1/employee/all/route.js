import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { prisma } from "@/lib/db";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const employees = await prisma.employees.findMany({
      where: {
        is_deleted: false,
        is_active: true,
      },
      include: {
        image: true,
      },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Employees fetched successfully",
        data: employees,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/employee/all:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
