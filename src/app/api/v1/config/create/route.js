import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function POST(request) {
  try {
    const authError = await requireAuth(request, {
      modules: [
        "config",
        "add_employees",
        "employee_details",
        "add_items",
        "item_details",
        "project_details",
        "materialstoorder",
        "purchaseorder",
        "supplier_details",
      ],
    });
    if (authError) return authError;

    const { category, value } = await request.json();

    // Validate required fields
    if (!category || !value) {
      return NextResponse.json(
        {
          status: false,
          message: "Category and value are required",
        },
        { status: 400 },
      );
    }

    // Create the config
    const config = await prisma.constants_config.create({
      data: {
        category,
        value,
      },
    });

    const logged = await withLogging(
      request,
      "constants_config",
      config.id,
      "CREATE",
      `Config created successfully: ${config.category}`,
    );

    if (!logged) {
      console.error(
        `Failed to log config creation: ${config.id} - ${config.category}`,
      );
      return NextResponse.json(
        {
          status: true,
          message: "Config created successfully",
          data: config,
          warning: "Note: Creation succeeded but logging failed",
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      { status: true, message: "Config created successfully", data: config },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/v1/config/create:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
