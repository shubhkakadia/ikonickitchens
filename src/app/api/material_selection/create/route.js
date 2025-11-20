import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";

// Helper function to get user from token
async function getUserFromToken(req) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    const sessionToken = authHeader.substring(7);
    const session = await prisma.sessions.findUnique({
      where: {
        token: sessionToken,
      },
    });
    return session;
  } catch (error) {
    console.error("Error validating session token:", error);
    return null;
  }
}

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

    // Get user_id from session token (more secure than relying on frontend)
    const session = await getUserFromToken(request);
    if (!session) {
      return NextResponse.json(
        { status: false, message: "Invalid session" },
        { status: 401 }
      );
    }
    const user_id = session.user_id;

    // Verify that user exists
    const user = await prisma.users.findUnique({
      where: { id: user_id },
    });

    if (!user) {
      return NextResponse.json(
        {
          status: false,
          message: "User not found with id: " + user_id,
        },
        { status: 404 }
      );
    }

    // Parse request body
    const {
      lot_id,
      project_id,
      quote_id,
      ceiling_height,
      bulkhead_height,
      kicker_height,
      cabinetry_height,
      notes,
      is_current = true, // Default to true - new versions are typically current
      areas = [], // Array of areas with nested items
    } = await request.json();

    // Validate required fields
    if (!lot_id) {
      return NextResponse.json(
        { status: false, message: "lot_id is required" },
        { status: 400 }
      );
    }

    // Verify that lot exists
    const lot = await prisma.lot.findUnique({
      where: { lot_id },
    });

    if (!lot) {
      return NextResponse.json(
        {
          status: false,
          message: "Lot not found with id: " + lot_id,
        },
        { status: 404 }
      );
    }

    // If project_id is provided, verify it exists
    if (project_id) {
      const project = await prisma.project.findUnique({
        where: { project_id },
      });

      if (!project) {
        return NextResponse.json(
          {
            status: false,
            message: "Project not found with id: " + project_id,
          },
          { status: 404 }
        );
      }
    }

    // If quote_id is provided, verify it exists
    if (quote_id) {
      const quote = await prisma.quote.findUnique({
        where: { quote_id },
      });

      if (!quote) {
        return NextResponse.json(
          {
            status: false,
            message: "Quote not found with id: " + quote_id,
          },
          { status: 404 }
        );
      }
    }

    // Validate areas data if provided
    if (areas && Array.isArray(areas)) {
      for (let i = 0; i < areas.length; i++) {
        const area = areas[i];
        if (!area.area_name) {
          return NextResponse.json(
            {
              status: false,
              message: `Area at index ${i} is missing required field: area_name`,
            },
            { status: 400 }
          );
        }

        // Validate items if provided
        if (area.items && Array.isArray(area.items)) {
          for (let j = 0; j < area.items.length; j++) {
            const item = area.items[j];
            if (!item.name) {
              return NextResponse.json(
                {
                  status: false,
                  message: `Item at index ${j} in area "${area.area_name}" is missing required field: name`,
                },
                { status: 400 }
              );
            }
          }
        }
      }
    }

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Check if material_selection exists for this lot_id
      let materialSelection = await tx.material_selection.findUnique({
        where: { lot_id },
      });

      // If material_selection doesn't exist, create it with user_id
      if (!materialSelection) {
        materialSelection = await tx.material_selection.create({
          data: {
            lot_id,
            project_id: project_id || null,
            quote_id: quote_id || null,
            createdBy_id: user_id, // Always set createdBy_id when creating new material_selection
          },
        });

        // Update the lot to link it to the material_selection
        await tx.lot.update({
          where: { lot_id },
          data: { material_selection_id: materialSelection.id },
        });
      } else {
        // If material_selection exists, only update project_id or quote_id if provided
        // Don't update createdBy_id - it should remain as the original creator
        if (project_id || quote_id !== undefined) {
          materialSelection = await tx.material_selection.update({
            where: { id: materialSelection.id },
            data: {
              ...(project_id && { project_id }),
              ...(quote_id !== undefined && { quote_id: quote_id || null }),
            },
          });
        }
      }

      const materialSelectionId = materialSelection.id;

      // Find the highest version number for this specific material_selection_id
      // This ensures version numbers are scoped to the same lot_id (since material_selection is unique per lot_id)
      const latestVersion = await tx.material_selection_versions.findFirst({
        where: {
          material_selection_id: materialSelectionId, // Scoped to this material_selection (which is unique per lot_id)
        },
        orderBy: { version_number: "desc" },
        select: { version_number: true },
      });

      // Calculate next version number - increments only for the same material_selection (same lot_id)
      const nextVersionNumber = latestVersion
        ? latestVersion.version_number + 1
        : 1;

      // If this version should be the current version, set all other versions to is_current: false
      if (is_current) {
        await tx.material_selection_versions.updateMany({
          where: {
            material_selection_id: materialSelectionId,
            is_current: true,
          },
          data: {
            is_current: false,
          },
        });
      }

      // Prepare areas data with nested items
      const areasData = areas.map((area) => {
        const areaData = {
          area_name: area.area_name,
          area_instance_id: area.area_instance_id || 1,
          bed_option: area.bed_option || null,
          notes: area.notes || null,
        };

        // Add nested items if provided
        if (area.items && Array.isArray(area.items) && area.items.length > 0) {
          areaData.items = {
            create: area.items.map((item) => ({
              name: item.name,
              category: item.category || null,
              is_applicable:
                item.is_applicable !== undefined ? item.is_applicable : false,
              item_notes: item.item_notes || null,
            })),
          };
        }

        return areaData;
      });

      // Create the new version with nested areas and items
      // Prisma handles Decimal conversion automatically for MySQL Decimal fields
      // We can pass numbers or strings directly
      const versionData = {
        material_selection_id: materialSelectionId,
        version_number: nextVersionNumber,
        is_current,
        quote_id: quote_id || null,
        notes: notes || null,
        // Handle Decimal fields - convert empty strings to null, otherwise use the value
        ceiling_height:
          ceiling_height !== undefined &&
          ceiling_height !== null &&
          ceiling_height !== ""
            ? ceiling_height
            : null,
        bulkhead_height:
          bulkhead_height !== undefined &&
          bulkhead_height !== null &&
          bulkhead_height !== ""
            ? bulkhead_height
            : null,
        kicker_height:
          kicker_height !== undefined &&
          kicker_height !== null &&
          kicker_height !== ""
            ? kicker_height
            : null,
        cabinetry_height:
          cabinetry_height !== undefined &&
          cabinetry_height !== null &&
          cabinetry_height !== ""
            ? cabinetry_height
            : null,
        // Add nested areas if provided
        ...(areasData.length > 0 && {
          areas: {
            create: areasData,
          },
        }),
      };

      const newVersion = await tx.material_selection_versions.create({
        data: versionData,
        include: {
          areas: {
            include: {
              items: true,
            },
          },
        },
      });

      // Update material_selection's current_version_id if this is the current version
      if (is_current) {
        await tx.material_selection.update({
          where: { id: materialSelectionId },
          data: { current_version_id: newVersion.id },
        });
      }

      // Return material_selection, version with areas and items
      return {
        material_selection: materialSelection,
        version: newVersion,
      };
    });

    return NextResponse.json(
      {
        status: true,
        message: "Material selection and version created successfully",
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating material selection version:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
