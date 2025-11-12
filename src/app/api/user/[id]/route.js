import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";
import bcrypt from "bcrypt";

export async function DELETE(request, { params }) {
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
    const { id } = await params;
    const user = await prisma.users.delete({
      where: { employee_id: id },
    });
    return NextResponse.json(
      { status: true, message: "User deleted successfully", data: user },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal Server Error", error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
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
    let body;
    const contentType = request.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
    }
    console.log(body);
    const { user_type, is_active, module_access, password } = body;

    const { id } = await params;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.users.update({
      where: { employee_id: id },
      data: {
        user_type,
        is_active,
        module_access,
        password: hashedPassword,
      },
    });
    return NextResponse.json(
      { status: true, message: "User updated successfully", data: user },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal Server Error", error: error.message },
      { status: 500 }
    );
  }
}
