import { NextResponse } from "next/server";
import { isAdmin, isSessionExpired } from "../../../../../lib/validators/authFromToken";
import { prisma } from "@/lib/db";

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
    const employees = await prisma.employees.findMany({
      include: {
        image: true,
      },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Employees fetched successfully",
        data: employees,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal Server Error", error: error.message },
      { status: 500 }
    );
  }
}
