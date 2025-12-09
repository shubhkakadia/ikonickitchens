import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";
export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { name, project_id, client_id } = await request.json();
    // Normalize client_id - handle empty string, null, or undefined
    const normalizedClientId =
      client_id && client_id.trim() !== ""
        ? client_id.trim().toLowerCase()
        : null;

    const existingProject = await prisma.project.findUnique({
      where: { project_id },
    });
    if (existingProject) {
      return NextResponse.json(
        {
          status: false,
          message: "Project already exists by this project id: " + project_id,
        },
        { status: 409 }
      );
    }

    // Validate client_id if provided
    if (normalizedClientId) {
      const existingClient = await prisma.client.findUnique({
        where: { client_id: normalizedClientId },
      });
      if (!existingClient) {
        return NextResponse.json(
          {
            status: false,
            message: "Client not found with client id: " + client_id,
          },
          { status: 404 }
        );
      }
    }

    const project = await prisma.project.create({
      data: {
        name,
        project_id: project_id.toLowerCase(),
        client_id: normalizedClientId,
      },
    });
    const logged = await withLogging(
      request,
      "project",
      project.project_id,
      "CREATE",
      `Project created successfully: ${project.name}`
    );
    if (!logged) {
      console.error(`Failed to log project creation: ${project.project_id} - ${project.name}`);
      return NextResponse.json(
        { 
          status: true, 
          message: "Project created successfully", 
          data: project,
          warning: "Note: Creation succeeded but logging failed"
        },
        { status: 201 }
      );
    }
    return NextResponse.json(
      { status: true, message: "Project created successfully", data: project },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/project/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
