import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../../lib/validators/authFromToken";
import {
  uploadMultipleFiles,
  deleteFileByRelativePath,
  validateMultipartRequest,
  getFileFromFormData,
} from "@/lib/fileHandler";

// Upload media files to MTO
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

    // Verify MTO exists
    const mto = await prisma.materials_to_order.findUnique({
      where: { id },
    });

    if (!mto) {
      return NextResponse.json(
        { status: false, message: "Materials to order not found" },
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
      uploadDir: "uploads",
      subDir: `materials_to_order/${id}`,
      filenameStrategy: "unique",
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
            materials_to_orderId: id,
          },
        })
      )
    );

    return NextResponse.json(
      {
        status: true,
        message: `${uploadedMedia.length} file(s) uploaded successfully`,
        data: uploadedMedia,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in media upload:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

// Delete media file from MTO
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
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get("mediaId");

    if (!mediaId) {
      return NextResponse.json(
        { status: false, message: "mediaId is required" },
        { status: 400 }
      );
    }

    // Find the media record
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media || media.materials_to_orderId !== id) {
      return NextResponse.json(
        { status: false, message: "Media not found" },
        { status: 404 }
      );
    }

    // Mark as deleted (soft delete)
    await prisma.media.update({
      where: { id: mediaId },
      data: { is_deleted: true },
    });

    // Delete the file from disk
    await deleteFileByRelativePath(media.url);

    return NextResponse.json(
      {
        status: true,
        message: "Media deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting media:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

