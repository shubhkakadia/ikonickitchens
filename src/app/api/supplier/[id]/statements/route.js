import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../../lib/validators/authFromToken";
import {
  uploadFile,
  validateMultipartRequest,
  getFileFromFormData,
} from "@/lib/fileHandler";
import path from "path";
import { withLogging } from "../../../../../../lib/withLogging";

export async function POST(request, { params }) {
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

    // Validate supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { supplier_id: id },
    });

    if (!supplier) {
      return NextResponse.json(
        { status: false, message: "Supplier not found" },
        { status: 404 }
      );
    }

    // Validate and parse multipart/form-data
    const formData = await validateMultipartRequest(request);
    const file = getFileFromFormData(formData, "file");
    const month_year = formData.get("month_year");
    const due_date = formData.get("due_date");
    const amount = formData.get("amount");
    const payment_status = formData.get("payment_status");
    const notes = formData.get("notes");

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { status: false, message: "File is required" },
        { status: 400 }
      );
    }

    if (!month_year) {
      return NextResponse.json(
        { status: false, message: "Month/Year is required" },
        { status: 400 }
      );
    }

    if (!due_date) {
      return NextResponse.json(
        { status: false, message: "Due date is required" },
        { status: 400 }
      );
    }

    if (!payment_status || !["PENDING", "PAID"].includes(payment_status)) {
      return NextResponse.json(
        { status: false, message: "Payment status must be PENDING or PAID" },
        { status: 400 }
      );
    }

    // Handle file upload
    const sanitizedMonthYear = month_year.replace(/[^a-zA-Z0-9_-]/g, "_");
    const uploadResult = await uploadFile(file, {
      uploadDir: "uploads",
      subDir: `suppliers/${id}/statements`,
      filenameStrategy: "id-based",
      idPrefix: `${id}_statement_${sanitizedMonthYear}`,
    });

    // Create supplier_file record
    const supplierFile = await prisma.supplier_file.create({
      data: {
        url: uploadResult.relativePath,
        filename: uploadResult.originalFilename,
        file_type: "statement",
        mime_type: uploadResult.mimeType,
        extension: uploadResult.extension,
        size: uploadResult.size,
        supplier_id: id,
      },
    });

    // Create supplier_statement record
    const statement = await prisma.supplier_statement.create({
      data: {
        month_year: month_year,
        due_date: new Date(due_date),
        amount: amount ? parseFloat(amount) : null,
        payment_status: payment_status,
        notes: notes || null,
        supplier_file_id: supplierFile.id,
        supplier_id: id,
      },
      include: {
        supplier_file: true,
      },
    });

    const logged = await withLogging(
      request,
      "supplier_statement",
      statement.id,
      "CREATE",
      `Statement uploaded successfully: ${statement.month_year} for supplier: ${supplier.name}`
    );
    if (!logged) {
      return NextResponse.json(
        { status: false, message: "Failed to log statement upload" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Statement uploaded successfully",
        data: statement,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading statement:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
        error: error.message,
      },
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
    if (await isSessionExpired(request)) {
      return NextResponse.json(
        { status: false, message: "Session expired" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Validate supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { supplier_id: id },
    });

    if (!supplier) {
      return NextResponse.json(
        { status: false, message: "Supplier not found" },
        { status: 404 }
      );
    }

    // Fetch all statements for this supplier
    const statements = await prisma.supplier_statement.findMany({
      where: {
        supplier_id: id,
      },
      include: {
        supplier_file: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Statements fetched successfully",
        data: statements,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching statements:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
