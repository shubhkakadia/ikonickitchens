import { NextResponse } from "next/server";
import {
  authorizeRequest,
  MASTER_ADMIN_ONLY,
} from "@/lib/validators/authFromToken";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/withLogging";
import { decryptValue, REVEALABLE_FIELDS } from "@/lib/employeeData";

// Master-admin only: returns one unmasked sensitive field for one employee.
// GET /api/v1/employee/:employee_id/reveal?field=tfn_number|bank_account_number|supper_account_number
export async function GET(request, { params }) {
  try {
    const { error } = await authorizeRequest(request, {
      roles: MASTER_ADMIN_ONLY,
    });
    if (error) return error;

    const { id } = await params;
    const field = new URL(request.url).searchParams.get("field");

    if (!REVEALABLE_FIELDS.includes(field)) {
      return NextResponse.json(
        {
          status: false,
          message: `field must be one of: ${REVEALABLE_FIELDS.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const employee = await prisma.employees.findFirst({
      where: { employee_id: id, is_deleted: false },
      select: { employee_id: true, [field]: true },
    });
    if (!employee) {
      return NextResponse.json(
        { status: false, message: "Employee not found" },
        { status: 404 },
      );
    }

    const value = decryptValue(employee[field]);

    // Every reveal is audited; refuse to disclose if the audit entry fails.
    const logged = await withLogging(
      request,
      "employee",
      id,
      "OTHER",
      `Revealed ${field} for employee ${id}`,
    );
    if (!logged) {
      return NextResponse.json(
        { status: false, message: "Could not record audit log; not revealed" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: "Value revealed",
        data: { field, value: value ?? null },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/employee/[id]/reveal:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
