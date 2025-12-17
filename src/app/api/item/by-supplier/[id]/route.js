import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    
    // First, get distinct categories for items with this supplier_id
    const itemsWithCategories = await prisma.item.findMany({
      where: { 
        supplier_id: id,
        is_deleted: false,
      },
      select: { category: true },
    });
    
    const uniqueCategories = [...new Set(itemsWithCategories.map(item => item.category.toLowerCase()))];
    
    // Map category enum values to relation names
    const categoryRelationMap = {
      sheet: "sheet",
      handle: "handle",
      hardware: "hardware",
      accessory: "accessory",
      edging_tape: "edging_tape",
    };
    
    // Dynamically construct include object based on categories present
    const include = {
      supplier: true,
      image: true, // Always include image relation
    };
    
    // Only include relations for categories that actually exist
    uniqueCategories.forEach(category => {
      const relation = categoryRelationMap[category];
      if (relation) {
        include[relation] = true;
      }
    });
    
    const items = await prisma.item.findMany({
      where: { 
        supplier_id: id,
        is_deleted: false,
      },
      include,
    });
    return NextResponse.json(
      { status: true, message: "Items fetched successfully", data: items },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/item/by-supplier/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
