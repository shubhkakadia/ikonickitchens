import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";
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

    // Get filename from params
    const { filename } = await params;

    if (!filename) {
      return NextResponse.json(
        { status: false, message: "Filename is required" },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { status: false, message: "Deleted media not found" },
        { status: 404 }
      );
    }

    // Delete the physical file from disk
    let fileDeleted = false;
    try {
      const filePath = path.join(process.cwd(), deletedMedia.url);
      await fs.promises.unlink(filePath);
      fileDeleted = true;
    } catch (fileError) {
      console.error("❌ Error deleting file from disk:", fileError);
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

    const logged = await withLogging(
      request,
      entityType,
      deletedMedia.id,
      "DELETE",
      `${entityType} deleted successfully: ${deletedMedia.filename}`
    );
    if (!logged) {
      return NextResponse.json(
        { status: false, message: `Failed to log ${entityType} deletion` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: "Media permanently deleted",
        filename: deletedMedia.filename,
        fileDeletedFromDisk: fileDeleted,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
