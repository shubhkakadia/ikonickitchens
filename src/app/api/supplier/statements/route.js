import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";

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
    const statements = await prisma.supplier_statement.findMany({
      include: {
        supplier: true,
        supplier_file: true,
      },
    });
    if (!statements) {
      return NextResponse.json(
        { status: false, message: "Statements not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Statements fetched successfully",
        data: statements,
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