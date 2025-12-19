import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    
    const { id } = await params;
    const config = await prisma.constants_config.findUnique({
      where: { id },
    });

    if (!config) {
      return NextResponse.json(
        { status: false, message: "Config not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { status: true, message: "Config fetched successfully", data: config },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/config/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    
    const { id } = await params;
    const { category, value } = await request.json();

    // Check if config exists
    const existingConfig = await prisma.constants_config.findUnique({
      where: { id },
    });

    if (!existingConfig) {
      return NextResponse.json(
        { status: false, message: "Config not found" },
        { status: 404 }
      );
    }

    // Build update data object with only provided fields
    const updateData = {};

    if (category !== undefined) {
      updateData.category = category;
    }

    if (value !== undefined) {
      updateData.value = value;
    }

    // If no fields to update, return error
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { status: false, message: "No fields to update" },
        { status: 400 }
      );
    }

    const config = await prisma.constants_config.update({
      where: { id },
      data: updateData,
    });

    const logged = await withLogging(
      request,
      "constants_config",
      id,
      "UPDATE",
      `Config updated successfully: ${config.category}`
    );

    if (!logged) {
      console.error(`Failed to log config update: ${id} - ${config.category}`);
    }

    return NextResponse.json(
      {
        status: true,
        message: "Config updated successfully",
        data: config,
        ...(logged ? {} : { warning: "Note: Update succeeded but logging failed" }),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in PATCH /api/config/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    
    const { id } = await params;

    // Check if config exists
    const existingConfig = await prisma.constants_config.findUnique({
      where: { id },
    });

    if (!existingConfig) {
      return NextResponse.json(
        { status: false, message: "Config not found" },
        { status: 404 }
      );
    }

    // Delete the config record
    const config = await prisma.constants_config.delete({
      where: { id },
    });

    const logged = await withLogging(
      request,
      "constants_config",
      id,
      "DELETE",
      `Config deleted successfully: ${config.category}`
    );

    if (!logged) {
      console.error(`Failed to log config deletion: ${id} - ${config.category}`);
      return NextResponse.json(
        {
          status: true,
          message: "Config deleted successfully",
          data: config,
          warning: "Note: Deletion succeeded but logging failed",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { status: true, message: "Config deleted successfully", data: config },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in DELETE /api/config/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
