import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    // Get category from request body
    const { category } = await request.json();

    if (!category) {
      return NextResponse.json(
        { status: false, message: "Category is required in request body" },
        { status: 400 },
      );
    }

    // Find all configs with the specified category
    const configs = await prisma.constants_config.findMany({
      where: {
        category: category,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Configs fetched successfully",
        data: configs,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in POST /api/config/read_all_by_category:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
