import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const project = await prisma.project.findFirst({
      where: {
        project_id: id,
        is_deleted: false,
      },
      include: {
        client: true,
        lots: {
          where: {
            is_deleted: false,
          },
        },
        materials_to_order: {
          include: {
            lots: {
              where: {
                is_deleted: false,
              },
              include: {
                project: true,
              },
            },
            items: {
              include: {
                item: {
                  include: {
                    sheet: true,
                    handle: true,
                    hardware: true,
                    accessory: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { status: false, message: "Project not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { status: true, message: "Project fetched successfully", data: project },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/project/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const { name, client_id } = await request.json();

    // Build update data object with only provided fields
    const updateData = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (client_id !== undefined) {
      updateData.client_id = client_id ? client_id.toLowerCase() : null;
    }

    const project = await prisma.project.update({
      where: { project_id: id },
      data: updateData,
    });
    const logged = await withLogging(
      request,
      "project",
      id,
      "UPDATE",
      `Project updated successfully: ${project.name}`,
    );
    if (!logged) {
      console.error(`Failed to log project update: ${id} - ${project.name}`);
    }
    return NextResponse.json(
      {
        status: true,
        message: "Project updated successfully",
        data: project,
        ...(logged
          ? {}
          : { warning: "Note: Update succeeded but logging failed" }),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in PATCH /api/project/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;

    // Check if project exists and is not already deleted
    const existingProject = await prisma.project.findUnique({
      where: { project_id: id },
    });

    if (!existingProject) {
      return NextResponse.json(
        { status: false, message: "Project not found" },
        { status: 404 },
      );
    }

    if (existingProject.is_deleted) {
      return NextResponse.json(
        { status: false, message: "Project already deleted" },
        { status: 400 },
      );
    }

    // Soft delete the project record (set is_deleted flag)
    const project = await prisma.project.update({
      where: { project_id: id },
      data: { is_deleted: true },
    });

    const logged = await withLogging(
      request,
      "project",
      id,
      "DELETE",
      `Project deleted successfully: ${project.name}`,
    );
    if (!logged) {
      console.error(`Failed to log project deletion: ${id} - ${project.name}`);
      return NextResponse.json(
        {
          status: true,
          message: "Project deleted successfully",
          data: project,
          warning: "Note: Deletion succeeded but logging failed",
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { status: true, message: "Project deleted successfully", data: project },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in DELETE /api/project/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
