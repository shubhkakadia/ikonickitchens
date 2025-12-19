import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import {
  uploadMultipleFiles,
  validateMultipartRequest,
  getFileFromFormData,
} from "@/lib/fileHandler";
import { withLogging } from "@/lib/withLogging";

// Upload media files to Material Selection
export async function POST(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { id } = await params;

    // Verify Material Selection exists
    const materialSelection = await prisma.material_selection.findUnique({
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

    if (!materialSelection) {
      return NextResponse.json(
        { status: false, message: "Material selection not found" },
        { status: 404 }
      );
    }

    // Handle multipart/form-data
    const formData = await validateMultipartRequest(request);
    const files = getFileFromFormData(formData, "files", true); // getAll = true

    if (!files || files.length === 0) {
      return NextResponse.json(
        { status: false, message: "No files provided" },
        { status: 400 }
      );
    }

    // Upload multiple files
    const uploadResults = await uploadMultipleFiles(files, {
      uploadDir: "mediauploads",
      subDir: `material_selection/${materialSelection.project_id || 'general'}`,
      filenameStrategy: "original",
    });

    if (uploadResults.successful.length === 0) {
      return NextResponse.json(
        { status: false, message: "Failed to upload files" },
        { status: 500 }
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
            material_selection_id: id,
          },
        })
      )
    );

    // Log all the uploaded media ids
    const logged = await Promise.all(
      uploadedMedia.map((media) =>
        withLogging(
          request,
          "media",
          media.id,
          "CREATE",
          `Media uploaded successfully: ${media.filename} for Material Selection: ${materialSelection.id}`
        )
      )
    );

    const hasLoggingFailures = logged.some((log) => !log);
    if (hasLoggingFailures) {
      console.error(`Failed to log some media uploads for Material Selection: ${id}`);
    }

    return NextResponse.json(
      {
        status: true,
        message: `${uploadedMedia.length} file(s) uploaded successfully`,
        data: uploadedMedia,
        ...(hasLoggingFailures ? { warning: "Note: Upload succeeded but some logging failed" } : {})
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in media upload:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

// Delete media file from Material Selection
export async function DELETE(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get("mediaId");

    if (!mediaId) {
      return NextResponse.json(
        { status: false, message: "mediaId is required" },
        { status: 400 }
      );
    }

    // Verify Material Selection exists and get it for logging context
    const materialSelection = await prisma.material_selection.findUnique({
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

    if (!materialSelection) {
      return NextResponse.json(
        { status: false, message: "Material selection not found" },
        { status: 404 }
      );
    }

    // Find the media record (only if not already deleted)
    const media = await prisma.media.findFirst({
      where: {
        id: mediaId,
        material_selection_id: id,
        is_deleted: false,
      },
    });

    if (!media) {
      return NextResponse.json(
        { status: false, message: "Media not found" },
        { status: 404 }
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
      `Media deleted successfully: ${updatedMedia.filename} for Material Selection: ${materialSelection.id} (Project: ${materialSelection.project?.name || 'N/A'})`
    );

    if (!logged) {
      console.error(`Failed to log media deletion: ${updatedMedia.id} - ${updatedMedia.filename}`);
    }

    return NextResponse.json(
      {
        status: true,
        message: "Media marked as deleted successfully",
        data: {
          fileId: updatedMedia.id,
          filename: updatedMedia.filename,
        },
        ...(logged ? {} : { warning: "Note: Deletion succeeded but logging failed" }),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting media:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
