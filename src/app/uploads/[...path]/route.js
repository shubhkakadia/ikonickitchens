import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../lib/validators/authFromToken";

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    // Images
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";

    // PDF
    case ".pdf":
      return "application/pdf";

    // Videos
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".ogg":
      return "video/ogg";
    case ".mov":
      return "video/quicktime";
    case ".avi":
      return "video/x-msvideo";
    case ".mkv":
      return "video/x-matroska";

    default:
      return "application/octet-stream";
  }
}

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const segments = ensureArray(resolvedParams?.path);
    if (segments.length === 0) {
      return NextResponse.json(
        { status: false, message: "Missing path" },
        { status: 404 }
      );
    }
    const targetPath = path.join(process.cwd(), "uploads", ...segments);

    // Prevent path traversal
    const uploadsRoot = path.join(process.cwd(), "uploads");
    const normalized = path.normalize(targetPath);
    if (!normalized.startsWith(uploadsRoot)) {
      return NextResponse.json(
        { status: false, message: "Not found" },
        { status: 404 }
      );
    }

    let stat;
    try {
      stat = await fs.promises.stat(normalized);
    } catch {
      return NextResponse.json(
        { status: false, message: "Not found" },
        { status: 404 }
      );
    }
    if (!stat.isFile()) {
      return NextResponse.json(
        { status: false, message: "Not found" },
        { status: 404 }
      );
    }

    // Check if file is marked as deleted in database
    const relativePath = path
      .relative(process.cwd(), normalized)
      .replaceAll("\\", "/");
    const fileRecord = await prisma.lot_file.findFirst({
      where: {
        url: relativePath,
      },
    });

    // If file exists in DB and is marked as deleted, return 404
    if (fileRecord && fileRecord.is_deleted) {
      return NextResponse.json(
        { status: false, message: "Not found" },
        { status: 404 }
      );
    }

    const mimeType = getMimeType(normalized);
    const data = await fs.promises.readFile(normalized);

    return new NextResponse(data, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": "inline", // This tells the browser to display the file inline
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
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
        { status: 200 }
      );
    }
    if (await isSessionExpired(request)) {
      return NextResponse.json(
        { status: false, message: "Session expired" },
        { status: 200 }
      );
    }

    const resolvedParams = await params;
    const segments = ensureArray(resolvedParams?.path);
    if (segments.length === 0) {
      return NextResponse.json(
        { status: false, message: "Missing path" },
        { status: 404 }
      );
    }
    const targetPath = path.join(process.cwd(), "uploads", ...segments);

    // Prevent path traversal
    const uploadsRoot = path.join(process.cwd(), "uploads");
    const normalized = path.normalize(targetPath);
    if (!normalized.startsWith(uploadsRoot)) {
      return NextResponse.json(
        { status: false, message: "Not found" },
        { status: 404 }
      );
    }

    // Check if file exists
    let stat;
    try {
      stat = await fs.promises.stat(normalized);
    } catch {
      return NextResponse.json(
        { status: false, message: "File not found" },
        { status: 404 }
      );
    }
    if (!stat.isFile()) {
      return NextResponse.json(
        { status: false, message: "Not a file" },
        { status: 404 }
      );
    }

    // Mark file as deleted in database instead of physically deleting it
    const relativePath = path
      .relative(process.cwd(), normalized)
      .replaceAll("\\", "/");
    const fileRecord = await prisma.lot_file.findFirst({
      where: {
        url: relativePath,
      },
    });

    if (!fileRecord) {
      return NextResponse.json(
        { status: false, message: "File record not found in database" },
        { status: 404 }
      );
    }

    // Update the is_deleted flag to true
    await prisma.lot_file.update({
      where: {
        id: fileRecord.id,
      },
      data: {
        is_deleted: true,
      },
    });

    return NextResponse.json(
      { status: true, message: "File marked as deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
