import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
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
    console.error("Error in POST /api/config/create:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
