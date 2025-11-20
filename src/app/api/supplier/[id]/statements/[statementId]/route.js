import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../../../lib/validators/authFromToken";
import {
  uploadFile,
  deleteFileByRelativePath,
  getFileFromFormData,
} from "@/lib/fileHandler";
import path from "path";

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

    const { id, statementId } = await params;

    // Validate statement exists
    const existingStatement = await prisma.supplier_statement.findUnique({
      where: { id: statementId },
      include: { supplier_file: true },
    });

    if (!existingStatement) {
      return NextResponse.json(
        { status: false, message: "Statement not found" },
        { status: 404 }
      );
    }

    if (existingStatement.supplier_id !== id) {
      return NextResponse.json(
        {
          status: false,
          message: "Statement does not belong to this supplier",
        },
        { status: 403 }
      );
    }

    // Check Content-Type
    const contentType = request.headers.get("Content-Type");
    const isFormData =
      contentType && contentType.includes("multipart/form-data");

    let month_year, due_date, amount, payment_status, notes, file;

    if (isFormData) {
      const formData = await request.formData();
      file = getFileFromFormData(formData, "file");
      month_year = formData.get("month_year");
      due_date = formData.get("due_date");
      amount = formData.get("amount");
      payment_status = formData.get("payment_status");
      notes = formData.get("notes");
    } else {
      const body = await request.json();
      month_year = body.month_year;
      due_date = body.due_date;
      amount = body.amount;
      payment_status = body.payment_status;
      notes = body.notes;
    }

    // Validate payment status if provided
    if (payment_status && !["PENDING", "PAID"].includes(payment_status)) {
      return NextResponse.json(
        { status: false, message: "Payment status must be PENDING or PAID" },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData = {};
    if (month_year !== undefined) updateData.month_year = month_year;
    if (due_date !== undefined) updateData.due_date = new Date(due_date);
    if (amount !== undefined)
      updateData.amount = amount ? parseFloat(amount) : null;
    if (payment_status !== undefined)
      updateData.payment_status = payment_status;
    if (notes !== undefined) updateData.notes = notes || null;

    // Handle file upload if new file is provided
    if (file) {
      // Delete old file if it exists
      if (existingStatement.supplier_file) {
        await deleteFileByRelativePath(existingStatement.supplier_file.url);
      }

      // Upload new file
      const sanitizedMonthYear = (
        month_year || existingStatement.month_year
      ).replace(/[^a-zA-Z0-9_-]/g, "_");
      const uploadResult = await uploadFile(file, {
        uploadDir: "uploads",
        subDir: `suppliers/${id}/statements`,
        filenameStrategy: "id-based",
        idPrefix: `${id}_statement_${sanitizedMonthYear}`,
      });

      // Update or create supplier_file
      if (existingStatement.supplier_file) {
        await prisma.supplier_file.update({
          where: { id: existingStatement.supplier_file_id },
          data: {
            url: uploadResult.relativePath,
            filename: uploadResult.originalFilename,
            mime_type: uploadResult.mimeType,
            extension: uploadResult.extension,
            size: uploadResult.size,
          },
        });
      } else {
        const newFile = await prisma.supplier_file.create({
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
        updateData.supplier_file_id = newFile.id;
      }
    }

    // Update statement
    const updatedStatement = await prisma.supplier_statement.update({
      where: { id: statementId },
      data: updateData,
      include: {
        supplier_file: true,
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Statement updated successfully",
        data: updatedStatement,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating statement:", error);
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

    const { id, statementId } = await params;

    // Validate statement exists
    const statement = await prisma.supplier_statement.findUnique({
      where: { id: statementId },
      include: { supplier_file: true },
    });

    if (!statement) {
      return NextResponse.json(
        { status: false, message: "Statement not found" },
        { status: 404 }
      );
    }

    if (statement.supplier_id !== id) {
      return NextResponse.json(
        {
          status: false,
          message: "Statement does not belong to this supplier",
        },
        { status: 403 }
      );
    }

    // Delete file from disk if it exists
    if (statement.supplier_file) {
      await deleteFileByRelativePath(statement.supplier_file.url);
    }

    // Delete statement (cascade will handle supplier_file deletion)
    await prisma.supplier_statement.delete({
      where: { id: statementId },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Statement deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting statement:", error);
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
