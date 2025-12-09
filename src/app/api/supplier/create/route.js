import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { name, email, phone, address, notes, website, abn_number } =
      await request.json();
    const existingSupplier = await prisma.supplier.findUnique({
      where: { name },
    });
    if (existingSupplier) {
      return NextResponse.json(
        {
          status: false,
          message: "Supplier already exists by this name: " + name,
        },
        { status: 409 }
      );
    }
    const supplier = await prisma.supplier.create({
      data: { name, email, phone, address, notes, website, abn_number },
    });

    const logged = await withLogging(
      request,
      "supplier",
      supplier.supplier_id,
      "CREATE",
      `Supplier created successfully: ${supplier.name}`
    );
    if (!logged) {
      console.error(`Failed to log supplier creation: ${supplier.supplier_id} - ${supplier.name}`);
      return NextResponse.json(
        { 
          status: true, 
          message: "Supplier created successfully",
          data: supplier,
          warning: "Note: Creation succeeded but logging failed"
        },
        { status: 201 }
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Supplier created successfully",
        data: supplier,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/supplier/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
