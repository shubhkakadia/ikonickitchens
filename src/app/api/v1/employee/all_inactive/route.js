import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/validators/authFromToken";
import { employeeQueryArgs, presentEmployees } from "@/lib/employeeData";
import { prisma } from "@/lib/db";

export async function GET(request) {
  try {
    const { error, auth } = await authorizeRequest(request, {
      modules: ["all_employees"],
    });
    if (error) return error;
    const employees = await prisma.employees.findMany({
      where: {
        is_deleted: false,
        is_active: false,
      },
      ...employeeQueryArgs(auth),
    });
    return NextResponse.json(
      {
        status: true,
        message: "Employees fetched successfully",
        data: presentEmployees(employees, auth),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/v1/employee/all_inactive:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
