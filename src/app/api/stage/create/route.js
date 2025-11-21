import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
  processDateTimeField,
} from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";

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
    const { lot_id, name, status, notes, startDate, endDate, assigned_to } =
      await request.json();

    // Create the stage first
    const stage = await prisma.stage.create({
      include: {
        lot: {
          select: {
            project: { select: { project_id: true, name: true } },
          },
        },
      },
      data: {
        lot_id: lot_id.toLowerCase(),
        name: name.toLowerCase(),
        status,
        notes,
        startDate: processDateTimeField(startDate),
        endDate: processDateTimeField(endDate),
      },
    });

    // Then create the stage_employee relationships if assigned_to is provided
    if (assigned_to && assigned_to.length > 0) {
      await prisma.stage_employee.createMany({
        data: assigned_to.map((employee_id) => ({
          stage_id: stage.stage_id,
          employee_id: employee_id,
        })),
        skipDuplicates: true, // Skip if the relationship already exists
      });
    }

    // lot id and project name for logging
    const logged = await withLogging(
      request,
      "stage",
      stage.stage_id,
      "CREATE",
      `Stage created successfully: ${stage.name} for lot: ${stage.lot_id} and project: ${stage.lot?.project?.name}`
    );
    if (!logged) {
      return NextResponse.json(
        { status: false, message: "Failed to log stage creation" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { status: true, message: "Stage created successfully", data: stage },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
