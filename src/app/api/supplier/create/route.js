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
    const { name, email, phone, address, notes, website } =
      await request.json();
    const existingSupplier = await prisma.supplier.findUnique({
      where: { name },
    });
    if (existingSupplier) {
      return NextResponse.json(
        { status: false, message: "Supplier already exists by this name: " + name },
        { status: 409 }
      );
    }
    const supplier = await prisma.supplier.create({
      data: { name, email, phone, address, notes, website },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Supplier created successfully",
        data: supplier,
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
