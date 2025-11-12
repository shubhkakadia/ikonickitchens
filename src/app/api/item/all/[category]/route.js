import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../../lib/validators/authFromToken";

const CATEGORIES = ["sheet", "handle", "hardware", "accessory", "edging_tape"];
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
    const { category } = await params;
    if (!CATEGORIES.includes(category)) {
      return NextResponse.json(
        { status: false, message: "Invalid category" },
        { status: 400 }
      );
    }
    const items = await prisma.item.findMany({
      where: { category: category.toUpperCase() },
      include: {
        sheet: true,
        handle: true,
        hardware: true,
        accessory: true,
        edging_tape: true,
      },
    });
    return NextResponse.json(
      { status: true, message: "Items fetched successfully", data: items },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
