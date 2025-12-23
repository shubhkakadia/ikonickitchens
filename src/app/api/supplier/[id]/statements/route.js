import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import {
  uploadFile,
  validateMultipartRequest,
  getFileFromFormData,
  deleteFileByRelativePath,
} from "@/lib/fileHandler";
import path from "path";
import { withLogging } from "@/lib/withLogging";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { id } = await params;

    // Validate supplier exists
    const supplier = await prisma.supplier.findFirst({
      where: {
        supplier_id: id,
        is_deleted: false,
      },
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
      },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

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

    // Handle file upload (must happen before transaction)
    const sanitizedMonthYear = month_year.replace(/[^a-zA-Z0-9_-]/g, "_");
    const uploadResult = await uploadFile(file, {
      uploadDir: "mediauploads",
      subDir: `suppliers/${id}/statements`,
      filenameStrategy: "id-based",
      idPrefix: `${id}_statement_${sanitizedMonthYear}`,
    });

    // Wrap both database writes in a transaction to ensure atomicity
    let statement;
    try {
      statement = await prisma.$transaction(async (tx) => {
        // Create supplier_file record
        const supplierFile = await tx.supplier_file.create({
          data: {
            url: uploadResult.relativePath,
            filename: uploadResult.originalFilename,
            file_type: "statement",
            mime_type: uploadResult.mimeType,
            extension: uploadResult.extension,
            size: uploadResult.size,
          },
        });

        // Create supplier_statement record
        return await tx.supplier_statement.create({
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
      });
    } catch (transactionError) {
      // If transaction fails, clean up the uploaded file
      try {
        await deleteFileByRelativePath(uploadResult.relativePath);
      } catch (deleteError) {
        console.error(
          `Failed to clean up uploaded file after transaction failure: ${uploadResult.relativePath}`,
          deleteError
        );
      }
      // Re-throw the original transaction error
      throw transactionError;
    }

    const logged = await withLogging(
      request,
      "supplier_statement",
      statement.id,
      "CREATE",
      `Statement uploaded successfully: ${statement.month_year} for supplier: ${supplier.name}`
    );
    if (!logged) {
      console.error(`Failed to log statement upload: ${statement.id} - ${statement.month_year}`);
      return NextResponse.json(
        {
          status: true,
          message: "Statement uploaded successfully",
          data: statement,
          warning: "Note: Creation succeeded but logging failed"
        },
        { status: 201 }
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
      },
      { status: 500 }
    );
  }
}
