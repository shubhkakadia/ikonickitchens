import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";
import bcrypt from "bcrypt";
import { withLogging } from "../../../../../lib/withLogging";

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
      where: { id: id },
      include: {
        employee: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });
    const logged = await withLogging(
      request,
      "user",
      id,
      "DELETE",
      `User deleted successfully: ${user.employee?.first_name} ${user.employee?.last_name}`
    );
    if (!logged) {
      return NextResponse.json(
        { status: false, message: "Failed to log user deletion" },
        { status: 500 }
      );
    }
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
    
    // Build update data object
    const updateData = {
      user_type,
      is_active,
      module_access,
    };
    
    // Only update password if it's provided and not empty
    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }
    
    const user = await prisma.users.update({
      where: { employee_id: id },
      data: updateData,
    });
    const logged = await withLogging(
      request,
      "user",
      id,
      "UPDATE",
      `User updated successfully: ${user.employee?.first_name} ${user.employee?.last_name}`
    );
    if (!logged) {
      return NextResponse.json(
        { status: false, message: "Failed to log user update" },
        { status: 500 }
      );
    }
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

export async function GET(request, { params }) {
  try {
    const admin = await isAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { status: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    const { id } = await params;
    const user = await prisma.users.findUnique({
      where: { id: id },
    });
    if (!user) {
      return NextResponse.json(
        { status: false, message: "User not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { status: true, message: "User fetched successfully", data: user },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal Server Error", error: error.message },
      { status: 500 }
    );
  }
}
