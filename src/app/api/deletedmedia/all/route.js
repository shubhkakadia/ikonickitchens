import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";

export async function GET(request) {
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
    // get lot details for each deleted media
    const deletedMedia = await prisma.lot_file.findMany({
      where: { is_deleted: true },
      include: {
        tab: {
          include: {
            lot: true,
          },
        },
      },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Deleted media fetched successfully",
        data: deletedMedia,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
