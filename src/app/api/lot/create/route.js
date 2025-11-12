import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
  processDateTimeField,
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
    const {
      lot_id,
      name,
      project_id,
      startDate,
      installationDueDate,
      notes,
    } = await request.json();
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
        startDate: startDate? processDateTimeField(startDate) : null,
        installationDueDate: installationDueDate? processDateTimeField(installationDueDate) : null,
        notes,
        status: "ACTIVE",
      },
    });
    return NextResponse.json(
      { status: true, message: "Lot created successfully", data: lot },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
