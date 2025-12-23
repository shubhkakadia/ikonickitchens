import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { lot_id, tab, notes } = await request.json();
    const lotTab = await prisma.lot_tab.create({
      data: {
        lot_id,
        tab,
        notes,
      },
    });

    const logged = await withLogging(
      request,
      "lot_tab_notes",
      lotTab.id,
      "CREATE",
      `Lot tab notes saved successfully: ${lotTab.notes}`
    );
    if (!logged) {
      console.error(`Failed to log lot tab notes creation: ${lotTab.id}`);
      return NextResponse.json(
        {
          status: true,
          message: "Lot tab notes saved successfully",
          data: lotTab,
          warning: "Note: Creation succeeded but logging failed"
        },
        { status: 201 }
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Lot tab notes saved successfully",
        data: lotTab,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/lot_tab_notes/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
