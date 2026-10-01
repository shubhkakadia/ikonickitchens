import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/validators/authFromToken";
import {
  uploadMultipleFiles,
  validateMultipartRequest,
  getFileFromFormData,
  MAX_LOT_BODY,
  MAX_LOT_FILE_SIZE,
  uploadLimitResponse,
  MAX_FILES_PER_REQUEST,
} from "@/lib/fileHandler";
import { withLogging } from "@/lib/withLogging";

// Upload media files to MTO
export async function POST(request, { params }) {
  try {
    const authError = await requireAuth(request, {
      modules: ["project_details", "materialstoorder", "supplier_details"],
    });
    if (authError) return authError;

    const { id } = await params;

    // Verify MTO exists
    const mto = await prisma.materials_to_order.findUnique({
      where: { id },
    });

    if (!mto || mto.is_deleted) {
      return NextResponse.json(
        { status: false, message: "Materials to order not found" },
        { status: 404 },
      );
    }

    // Handle multipart/form-data
    const formData = await validateMultipartRequest(request, MAX_LOT_BODY);
    const files = getFileFromFormData(formData, "files", true); // getAll = true

    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        {
          status: false,
          message: `Too many files: at most ${MAX_FILES_PER_REQUEST} per request`,
        },
        { status: 400 },
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { status: false, message: "No files provided" },
        { status: 400 },
      );
    }

    // Upload multiple files
    const uploadResults = await uploadMultipleFiles(files, {
      uploadDir: "mediauploads",
      subDir: `materials_to_order/${mto.project_id}`,
      filenameStrategy: "original",
      maxSize: MAX_LOT_FILE_SIZE,
    });

    if (uploadResults.successful.length === 0) {
      return NextResponse.json(
        { status: false, message: "Failed to upload files" },
        { status: 500 },
      );
    }

    // Create media records in database
    const uploadedMedia = await Promise.all(
      uploadResults.successful.map((result) =>
        prisma.media.create({
          data: {
            url: result.relativePath,
            filename: result.originalFilename,
            file_type: result.fileType,
            mime_type: result.mimeType,
            extension: result.extension,
            size: result.size,
            materials_to_orderId: id,
          },
        }),
      ),
    );

    // log all the uploaded media ids
    const logged = await Promise.all(
      uploadedMedia.map((media) =>
        withLogging(
          request,
          "media",
          media.id,
          "CREATE",
          `Media uploaded successfully: ${media.filename} for MTO: ${mto.id}`,
        ),
      ),
    );

    const hasLoggingFailures = logged.some((log) => !log);
    if (hasLoggingFailures) {
      console.error(`Failed to log some media uploads for MTO: ${id}`);
    }

    return NextResponse.json(
      {
        status: true,
        message: `${uploadedMedia.length} file(s) uploaded successfully`,
        data: uploadedMedia,
        ...(hasLoggingFailures
          ? { warning: "Note: Upload succeeded but some logging failed" }
          : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    const tooLarge = uploadLimitResponse(error);
    if (tooLarge) return tooLarge;

    console.error("Error in media upload:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

// Delete media file from MTO
export async function DELETE(request, { params }) {
  try {
    const authError = await requireAuth(request, {
      modules: ["project_details", "materialstoorder", "supplier_details"],
    });
    if (authError) return authError;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get("mediaId");

    if (!mediaId) {
      return NextResponse.json(
        { status: false, message: "mediaId is required" },
        { status: 400 },
      );
    }

    // Verify MTO exists and get it for logging context
    const mto = await prisma.materials_to_order.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            project_id: true,
            name: true,
          },
        },
      },
    });

    if (!mto || mto.is_deleted) {
      return NextResponse.json(
        { status: false, message: "Materials to order not found" },
        { status: 404 },
      );
    }

    // Find the media record (only if not already deleted)
    const media = await prisma.media.findFirst({
      where: {
        id: mediaId,
        materials_to_orderId: id,
        is_deleted: false,
      },
    });

    if (!media) {
      return NextResponse.json(
        { status: false, message: "Media not found" },
        { status: 404 },
      );
    }

    // Mark as deleted (soft delete) - don't physically delete the file
    const updatedMedia = await prisma.media.update({
      where: { id: mediaId },
      data: { is_deleted: true },
    });

    // Log the deletion action
    const logged = await withLogging(
      request,
      "media",
      updatedMedia.id,
      "DELETE",
      `Media deleted successfully: ${updatedMedia.filename} for MTO: ${mto.id} (Project: ${mto.project.name})`,
    );

    if (!logged) {
      console.error(
        `Failed to log media deletion: ${updatedMedia.id} - ${updatedMedia.filename}`,
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: "Media marked as deleted successfully",
        data: {
          fileId: updatedMedia.id,
          filename: updatedMedia.filename,
        },
        ...(logged
          ? {}
          : { warning: "Note: Deletion succeeded but logging failed" }),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting media:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
