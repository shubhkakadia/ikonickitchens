import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  validateAdminAuth,
  processDateTimeField,
} from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
import { formatProjectId, getNextProjectSequence } from "@/lib/projectId";
export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { name, project_id, client_id, startDate, lots } = await request.json();
    // Normalize client_id - handle empty string, null, or undefined
    const normalizedClientId =
      client_id && client_id.trim() !== ""
        ? client_id.trim().toLowerCase()
        : null;
    if (!normalizedClientId && !project_id) {
      return NextResponse.json(
        { status: false, message: "Project ID is required when no client is selected" },
        { status: 400 },
      );
    }

    // Validate lots if provided
    if (lots && Array.isArray(lots) && lots.length > 0) {
      // Validate required fields for all lots
      for (const lot of lots) {
        if (!lot.lotId || !lot.clientName) {
          return NextResponse.json(
            {
              status: false,
              message: "Lot ID and Client Name are required for all lots",
            },
            { status: 400 },
          );
        }
      }
    }

    // Use transaction to create project and lots atomically
    const result = await prisma.$transaction(
      async (tx) => {
        let generatedProjectId = project_id;
        if (normalizedClientId) {
          const existingClient = await tx.client.findFirst({
            where: { client_id: normalizedClientId, is_deleted: false },
            select: { client_id: true, client_slug: true },
          });
          if (!existingClient) {
            const error = new Error("Client not found with client id: " + client_id);
            error.statusCode = 404;
            throw error;
          }
          const existingProjects = await tx.project.findMany({
            where: { project_id: { startsWith: `IKC-${existingClient.client_slug}-` } },
            select: { project_id: true },
          });
          const sequence = getNextProjectSequence(existingProjects.map(({ project_id: existingProjectId }) => existingProjectId), existingClient.client_slug);
          if (!sequence) {
            const error = new Error("Project ID sequence limit reached for this client");
            error.statusCode = 409;
            throw error;
          }
          generatedProjectId = formatProjectId(existingClient.client_slug, sequence);
          if (!generatedProjectId) {
            const error = new Error("Client slug must be exactly 4 letters before creating a project");
            error.statusCode = 409;
            throw error;
          }
        }
        // Create the project
        const project = await tx.project.create({
          data: {
            name,
            project_id: String(generatedProjectId).toLowerCase(),
            client_id: normalizedClientId,
          },
        });

        // Create lots if provided
        const createdLots = [];
        if (lots && Array.isArray(lots) && lots.length > 0) {
          for (const lot of lots) {
            const createdLot = await tx.lot.create({
              data: {
                lot_id: lot.lotId.toLowerCase(),
                name: lot.clientName,
                project_id: project.project_id,
                startDate: startDate ? processDateTimeField(startDate) : null,
                installationDueDate: lot.installationDueDate
                  ? processDateTimeField(lot.installationDueDate)
                  : null,
                notes: lot.notes || null,
                status: "ACTIVE",
              },
            });
            createdLots.push(createdLot);
          }
        }

        return { project, createdLots };
      },
      { isolationLevel: "Serializable" },
    );

    const { project, createdLots } = result;

    // Log project creation
    const logged = await withLogging(
      request,
      "project",
      project.project_id,
      "CREATE",
      `Project created successfully: ${project.name}`,
    );

    // Log lot creations
    for (const lot of createdLots) {
      await withLogging(
        request,
        "lot",
        lot.lot_id,
        "CREATE",
        `Lot created successfully: ${lot.name} for project: ${project.name}`,
      );
    }

    // Prepare response
    const responseData = {
      status: true,
      message: "Project created successfully",
      data: {
        ...project,
        lots: createdLots,
      },
    };

    if (!logged) {
      console.error(
        `Failed to log project creation: ${project.project_id} - ${project.name}`,
      );
      responseData.warning = "Note: Creation succeeded but logging failed";
    }

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/project/create:", error);
    if (error.statusCode) {
      return NextResponse.json(
        { status: false, message: error.message },
        { status: error.statusCode },
      );
    }
    if (error.code === "P2034" || error.code === "P2002") {
      return NextResponse.json(
        {
          status: false,
          message: "A project ID was generated concurrently. Please try again.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 },
    );
  }
}
