import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const lotTab = await prisma.lot_tab.findUnique({
      where: { id },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Lot tab notes fetched successfully",
        data: lotTab,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/lot_tab_notes/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const { notes } = await request.json();
    const lotTab = await prisma.lot_tab.update({
      where: { id },
      data: { notes },
    });
    const logged = await withLogging(
      request,
      "lot_tab_notes",
      id,
      "UPDATE",
      `Lot tab notes updated successfully: ${lotTab.notes}`,
    );
    if (!logged) {
      console.error(`Failed to log lot tab notes update: ${id}`);
    }
    return NextResponse.json(
      {
        status: true,
        message: "Lot tab notes updated successfully",
        data: lotTab,
        ...(logged
          ? {}
          : { warning: "Note: Update succeeded but logging failed" }),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in PATCH /api/lot_tab_notes/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
