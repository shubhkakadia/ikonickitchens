import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  validateAdminAuth,
  processDateTimeField,
} from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { lot_id, name, project_id, startDate, installationDueDate, notes } =
      await request.json();
    const existingLot = await prisma.lot.findUnique({
      where: { lot_id: lot_id.toLowerCase() },
    });
    if (existingLot) {
      return NextResponse.json(
        {
          status: false,
          message: "Lot already exists by this lot id: " + lot_id.toLowerCase(),
        },
        { status: 409 }
      );
    }
    const lot = await prisma.lot.create({
      data: {
        lot_id: lot_id.toLowerCase(),
        name,
        project_id: project_id.toLowerCase(),
        startDate: startDate ? processDateTimeField(startDate) : null,
        installationDueDate: installationDueDate
          ? processDateTimeField(installationDueDate)
          : null,
        notes,
        status: "ACTIVE",
      },
      include: {
        project: true,
      },
    });
    const logged = await withLogging(
      request,
      "lot",
      lot.lot_id,
      "CREATE",
      `Lot created successfully: ${lot.name} for project: ${lot.project.name}`
    );
    if (!logged) {
      console.error(`Failed to log lot creation: ${lot.lot_id} - ${lot.name}`);
      return NextResponse.json(
        { 
          status: true, 
          message: "Lot created successfully", 
          data: lot,
          warning: "Note: Creation succeeded but logging failed"
        },
        { status: 201 }
      );
    }
    return NextResponse.json(
      { status: true, message: "Lot created successfully", data: lot },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/lot/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
