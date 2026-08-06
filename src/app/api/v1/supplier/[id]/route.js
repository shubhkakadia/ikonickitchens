import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
import { formatPhoneToNational } from "@/components/validators";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const supplier = await prisma.supplier.findFirst({
      where: {
        supplier_id: id,
        is_deleted: false,
      },
      include: {
        contacts: true,
        statements: {
          include: {
            supplier_file: true,
          },
        },
      },
    });
    if (!supplier) {
      return NextResponse.json(
        { status: false, message: "Supplier not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Supplier fetched successfully",
        data: supplier,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/supplier/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const { name, email, phone, address, notes, website, abn_number } =
      await request.json();
    const formatPhone = (phone) => {
      return phone ? formatPhoneToNational(phone) : phone;
    };

    const supplier = await prisma.supplier.update({
      where: { supplier_id: id },
      data: {
        name,
        email,
        phone: formatPhone(phone),
        address,
        notes,
        website,
        abn_number,
      },
    });

    const logged = await withLogging(
      request,
      "supplier",
      id,
      "UPDATE",
      `Supplier updated successfully: ${supplier.name}`,
    );
    if (!logged) {
      console.error(`Failed to log supplier update: ${id} - ${supplier.name}`);
    }
    return NextResponse.json(
      {
        status: true,
        message: "Supplier updated successfully",
        data: supplier,
        ...(logged
          ? {}
          : { warning: "Note: Update succeeded but logging failed" }),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in PATCH /api/supplier/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;

    // Check if supplier exists and is not already deleted
    const existingSupplier = await prisma.supplier.findUnique({
      where: { supplier_id: id },
    });

    if (!existingSupplier) {
      return NextResponse.json(
        { status: false, message: "Supplier not found" },
        { status: 404 },
      );
    }

    if (existingSupplier.is_deleted) {
      return NextResponse.json(
        { status: false, message: "Supplier already deleted" },
        { status: 400 },
      );
    }

    // Soft delete the supplier record (set is_deleted flag)
    const supplier = await prisma.supplier.update({
      where: { supplier_id: id },
      data: { is_deleted: true },
    });

    const logged = await withLogging(
      request,
      "supplier",
      id,
      "DELETE",
      `Supplier deleted successfully: ${supplier.name}`,
    );
    if (!logged) {
      console.error(
        `Failed to log supplier deletion: ${id} - ${supplier.name}`,
      );
      return NextResponse.json(
        {
          status: true,
          message: "Supplier deleted successfully",
          data: supplier,
          warning: "Note: Deletion succeeded but logging failed",
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Supplier deleted successfully",
        data: supplier,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in DELETE /api/supplier/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
