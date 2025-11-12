import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isAdmin,
  isSessionExpired,
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

    const { lot_id, tab, notes } = await request.json();
    const lotTab = await prisma.lot_tab.create({
      data: {
        lot_id,
        tab,
        notes,
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Lot tab notes saved successfully",
        data: lotTab,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
