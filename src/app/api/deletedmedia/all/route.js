import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    // get lot details for each deleted media
    const lotFilesDeletedMedia = await prisma.lot_file.findMany({
      where: { is_deleted: true },
      include: {
        tab: {
          include: {
            lot: true,
          },
        },
      },
    });

    const mediaDeletedMedia = await prisma.media.findMany({
      where: { is_deleted: true },
    });

    const supplierFilesDeletedMedia = await prisma.supplier_file.findMany({
      where: { is_deleted: true },
    });

    const deletedMedia = [
      ...lotFilesDeletedMedia,
      ...mediaDeletedMedia,
      ...supplierFilesDeletedMedia,
    ];

    return NextResponse.json(
      {
        status: true,
        message: "Deleted media fetched successfully",
        data: deletedMedia,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/deletedmedia/all:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

// batch delete deleted media
export async function DELETE(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    // Get filenames from request body
    const body = await request.json();
    const { filenames } = body;

    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
      return NextResponse.json(
        { status: false, message: "Filenames array is required" },
        { status: 400 }
      );
    }

    // Helper function to process a single filename deletion
    const processFileDeletion = async (filename) => {
      try {
        // Decode filename in case it's URL encoded
        const decodedFilename = decodeURIComponent(filename);

        // Find the deleted media by filename in all three tables
        let deletedMedia = await prisma.lot_file.findFirst({
          where: {
            filename: decodedFilename,
            is_deleted: true,
          },
        });

        let tableName = "lot_file";

        if (!deletedMedia) {
          deletedMedia = await prisma.media.findFirst({
            where: {
              filename: decodedFilename,
              is_deleted: true,
            },
          });
          tableName = "media";
        }

        if (!deletedMedia) {
          deletedMedia = await prisma.supplier_file.findFirst({
            where: {
              filename: decodedFilename,
              is_deleted: true,
            },
          });
          tableName = "supplier_file";
        }

        if (!deletedMedia) {
          return {
            success: false,
            filename: decodedFilename,
            error: "Deleted media not found",
          };
        }

        // Delete the physical file from disk
        let fileDeleted = false;
        try {
          const filePath = path.join(process.cwd(), deletedMedia.url);
          await fs.promises.unlink(filePath);
          fileDeleted = true;
        } catch (fileError) {
          console.error(
            `❌ Error deleting file from disk: ${decodedFilename}`,
            fileError
          );
          console.error(
            "Attempted path:",
            path.join(process.cwd(), deletedMedia.url)
          );
          // Continue with database deletion even if file deletion fails
        }

        // Delete the record from database based on table type
        if (tableName === "lot_file") {
          await prisma.lot_file.delete({
            where: { id: deletedMedia.id },
          });
        } else if (tableName === "media") {
          await prisma.media.delete({
            where: { id: deletedMedia.id },
          });
        } else if (tableName === "supplier_file") {
          await prisma.supplier_file.delete({
            where: { id: deletedMedia.id },
          });
        }

        const entityType =
          tableName === "lot_file"
            ? "lot_file"
            : tableName === "media"
            ? "media"
            : "supplier_file";

        // Log the deletion
        const logged = await withLogging(
          request,
          entityType,
          deletedMedia.id,
          "DELETE",
          `${entityType} deleted successfully: ${deletedMedia.filename}`
        );

        if (!logged) {
          console.error(`Failed to log ${entityType} deletion: ${deletedMedia.id} - ${deletedMedia.filename}`);
        }

        // Deletion succeeded, so mark as successful even if logging failed
        return {
          success: true,
          filename: decodedFilename,
          fileDeletedFromDisk: fileDeleted,
          ...(logged ? {} : { warning: "Note: Deletion succeeded but logging failed" })
        };
      } catch (error) {
        console.error(`Error deleting file ${filename}:`, error);
        return {
          success: false,
          filename: filename,
          error: error.message || "Unknown error",
        };
      }
    };

    // Process all files in parallel using Promise.all
    const deletionResults = await Promise.all(
      filenames.map(filename => processFileDeletion(filename))
    );

    // Separate successful and failed results
    const results = {
      successful: deletionResults.filter(r => r.success),
      failed: deletionResults.filter(r => !r.success),
    };

    // Return results
    const hasSuccess = results.successful.length > 0;
    const hasFailures = results.failed.length > 0;

    return NextResponse.json(
      {
        status: hasSuccess,
        message: hasFailures
          ? `Deleted ${results.successful.length} file(s), ${results.failed.length} failed`
          : `Successfully deleted ${results.successful.length} file(s)`,
        data: {
          successful: results.successful,
          failed: results.failed,
          total: filenames.length,
          successfulCount: results.successful.length,
          failedCount: results.failed.length,
        },
      },
      { status: hasSuccess ? 200 : hasFailures ? 207 : 200 } // 207 Multi-Status if partial success
    );
  } catch (error) {
    console.error("Error in DELETE /api/deletedmedia/all:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
