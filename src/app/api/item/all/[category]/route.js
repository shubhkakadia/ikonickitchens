import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "../../../../../../lib/validators/authFromToken";

const CATEGORIES = ["sheet", "handle", "hardware", "accessory", "edging_tape"];
export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { category } = await params;
    const normalizedCategory = category.toLowerCase();
    if (!CATEGORIES.includes(normalizedCategory)) {
      return NextResponse.json(
        { status: false, message: "Invalid category" },
        { status: 400 }
      );
    }
    
    // Dynamically construct include object based on category
    const include = {
      image: true, // Always include image relation
    };
    
    // Map category to its corresponding relation
    const categoryRelationMap = {
      sheet: "sheet",
      handle: "handle",
      hardware: "hardware",
      accessory: "accessory",
      edging_tape: "edging_tape",
    };
    
    include[categoryRelationMap[normalizedCategory]] = true;
    
    const items = await prisma.item.findMany({
      where: { category: normalizedCategory.toUpperCase() },
      include,
    });
    return NextResponse.json(
      { status: true, message: "Items fetched successfully", data: items },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/item/all/[category]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
