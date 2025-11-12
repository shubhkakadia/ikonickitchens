import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";

export async function POST(request) {
  try {
    const admin = await isAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { status: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    if (await isSessionExpired(request)) {
      return NextResponse.json(
        { status: false, message: "Session expired" },
        { status: 401 }
      );
    }
    const { name, project_id, client_id } = await request.json();
    // Normalize client_id - handle empty string, null, or undefined
    const normalizedClientId = client_id && client_id.trim() !== "" 
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
    return NextResponse.json(
      { status: true, message: "Project created successfully", data: project },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
