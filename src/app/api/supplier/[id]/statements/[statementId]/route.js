import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "../../../../../../../lib/validators/authFromToken";
import {
  uploadFile,
  deleteFileByRelativePath,
  getFileFromFormData,
} from "@/lib/fileHandler";
import path from "path";
import { withLogging } from "../../../../../../../lib/withLogging";

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

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
    let oldFileUrl = null;
    if (file) {
      // Store old file URL for deletion after successful update
      if (existingStatement.supplier_file) {
        oldFileUrl = existingStatement.supplier_file.url;
      }

      // Upload new file first (before deleting old one)
      const sanitizedMonthYear = (
        month_year || existingStatement.month_year
      ).replace(/[^a-zA-Z0-9_-]/g, "_");
      const uploadResult = await uploadFile(file, {
        uploadDir: "uploads",
        subDir: `suppliers/${id}/statements`,
        filenameStrategy: "id-based",
        idPrefix: `${id}_statement_${sanitizedMonthYear}`,
      });

      // Store upload result for use in transaction
      updateData._fileUploadResult = uploadResult;
      updateData._hasExistingFile = !!existingStatement.supplier_file;
      updateData._existingFileId = existingStatement.supplier_file_id;
    }

    // Wrap all database updates in a single transaction to ensure atomicity
    const updatedStatement = await prisma.$transaction(async (tx) => {
      // Update or create supplier_file if new file was uploaded
      if (file && updateData._fileUploadResult) {
        if (updateData._hasExistingFile) {
          // Update existing file record
          await tx.supplier_file.update({
            where: { id: updateData._existingFileId },
            data: {
              url: updateData._fileUploadResult.relativePath,
              filename: updateData._fileUploadResult.originalFilename,
              mime_type: updateData._fileUploadResult.mimeType,
              extension: updateData._fileUploadResult.extension,
              size: updateData._fileUploadResult.size,
            },
          });
        } else {
          // Create new file record
          const newFile = await tx.supplier_file.create({
            data: {
              url: updateData._fileUploadResult.relativePath,
              filename: updateData._fileUploadResult.originalFilename,
              file_type: "statement",
              mime_type: updateData._fileUploadResult.mimeType,
              extension: updateData._fileUploadResult.extension,
              size: updateData._fileUploadResult.size,
              supplier_id: id,
            },
          });
          updateData.supplier_file_id = newFile.id;
        }
      }

      // Clean up temporary fields before updating statement
      delete updateData._fileUploadResult;
      delete updateData._hasExistingFile;
      delete updateData._existingFileId;

      // Update statement (all updates happen atomically)
      return await tx.supplier_statement.update({
        where: { id: statementId },
        include: {
          supplier_file: true,
          supplier: {
            select: {
              name: true,
            },
          },
        },
        data: updateData,
      });
    });

    // Only delete old file after all database updates succeed
    if (file && oldFileUrl) {
      try {
        await deleteFileByRelativePath(oldFileUrl);
      } catch (deleteError) {
        // Log error but don't fail the request - old file cleanup is best effort
        console.error(`Failed to delete old file: ${oldFileUrl}`, deleteError);
      }
    }

    const logged = await withLogging(
      request,
      "supplier_statement",
      statementId,
      "UPDATE",
      `Statement updated successfully: ${updatedStatement.month_year} for supplier: ${updatedStatement.supplier.name}`
    );
    if (!logged) {
      console.error(`Failed to log statement update: ${statementId} - ${updatedStatement.month_year}`);
    }
    return NextResponse.json(
      {
        status: true,
        message: "Statement updated successfully",
        data: updatedStatement,
        ...(logged ? {} : { warning: "Note: Update succeeded but logging failed" })
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating statement:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { id, statementId } = await params;

    // Validate statement exists
    const statement = await prisma.supplier_statement.findUnique({
      where: { id: statementId },
      include: {
        supplier_file: true,
        supplier: {
          select: {
            name: true,
          },
        },
      },
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

    const logged = await withLogging(
      request,
      "supplier_statement",
      statementId,
      "DELETE",
      `Statement deleted successfully: ${statement.month_year} for supplier: ${statement.supplier.name}`
    );
    if (!logged) {
      console.error(`Failed to log statement deletion: ${statementId} - ${statement.month_year}`);
      return NextResponse.json(
        {
          status: true,
          message: "Statement deleted successfully",
          warning: "Note: Deletion succeeded but logging failed"
        },
        { status: 200 }
      );
    }
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
      },
      { status: 500 }
    );
  }
}
