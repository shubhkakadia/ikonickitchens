import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../../lib/validators/authFromToken";

export async function GET(request, { params }) {
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

    // Get lot_id from params
    const { lot_id } = await params;

    if (!lot_id) {
      return NextResponse.json(
        { status: false, message: "Lot ID is required" },
        { status: 400 }
      );
    }

    // Fetch material_selection by lot_id with current version and all nested details
    const materialSelection = await prisma.material_selection.findUnique({
      where: { lot_id },
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
            is_current: true,
            createdAt: true,
          },
          orderBy: {
            version_number: "desc",
          },
        },
      },
    });

    if (!materialSelection) {
      return NextResponse.json(
        {
          status: true,
          message: "No material selection found for this lot",
          data: null,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: "Material selection fetched successfully",
        data: materialSelection,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching material selection:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error", error: error.message },
      { status: 500 }
    );
  }
}

