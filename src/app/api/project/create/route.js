import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  validateAdminAuth,
  processDateTimeField,
} from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { name, project_id, client_id, startDate, lots } =
      await request.json();
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
            { status: 400 }
          );
        }
      }

      // Use transaction to create project and lots atomically
      const result = await prisma.$transaction(async (tx) => {
        // Create the project
        const project = await tx.project.create({
          data: {
            name,
            project_id: project_id.toLowerCase(),
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
      });

      const { project, createdLots } = result;

      // Log project creation
      const logged = await withLogging(
        request,
        "project",
        project.project_id,
        "CREATE",
        `Project created successfully: ${project.name}`
      );

      // Log lot creations
      for (const lot of createdLots) {
        await withLogging(
          request,
          "lot",
          lot.lot_id,
          "CREATE",
          `Lot created successfully: ${lot.name} for project: ${project.name}`
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
          `Failed to log project creation: ${project.project_id} - ${project.name}`
        );
        responseData.warning = "Note: Creation succeeded but logging failed";
      }

      return NextResponse.json(responseData, { status: 201 });
    }
  } catch (error) {
    console.error("Error in POST /api/project/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
