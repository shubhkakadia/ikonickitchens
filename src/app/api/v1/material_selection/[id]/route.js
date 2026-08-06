import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    // Get material_selection id from params
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { status: false, message: "Material selection ID is required" },
        { status: 400 },
      );
    }

    // Fetch material_selection with current version and all nested details
    const materialSelection = await prisma.material_selection.findUnique({
      where: { id },
      include: {
        currentVersion: {
          include: {
            areas: {
              include: {
                items: true,
              },
            },
          },
        },
        project: {
          select: {
            project_id: true,
            name: true,
          },
        },
        quote: {
          select: {
            quote_id: true,
            id: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        lot: {
          select: {
            lot_id: true,
            name: true,
          },
        },
        versions: {
          select: {
            id: true,
            version_number: true,
            createdAt: true,
          },
        },
      },
    });

    if (!materialSelection) {
      return NextResponse.json(
        { status: false, message: "Material selection not found" },
        { status: 404 },
      );
    }

    // Fetch media separately to avoid Prisma client issues
    const media = await prisma.media.findMany({
      where: {
        material_selection_id: id,
        is_deleted: false,
      },
    });

    // Add media to the response
    const materialSelectionWithMedia = {
      ...materialSelection,
      media: media,
    };

    return NextResponse.json(
      {
        status: true,
        message: "Material selection fetched successfully",
        data: materialSelectionWithMedia,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching material selection:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
