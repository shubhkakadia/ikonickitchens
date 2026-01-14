import path from "path";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { prisma } from "@/lib/db";
import { uploadFile, validateMultipartRequest } from "@/lib/fileHandler";
import fs from "fs";
import { withLogging } from "@/lib/withLogging";

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// Valid TabKind enum values
const VALID_TABKINDS = [
  "architecture_drawings",
  "appliances_specifications",
  "material_selection",
  "cabinetry_drawings",
  "changes_to_do",
  "site_measurements",
  "delivery_photos",
  "installation_photos",
  "maintenance_photos",
  "finished_site_photos",
];

// Mapping lowercase to proper enum format for database
const TABKIND_TO_ENUM = {
  architecture_drawings: "ARCHITECTURE_DRAWINGS",
  appliances_specifications: "APPLIANCES_SPECIFICATIONS",
  material_selection: "MATERIAL_SELECTION",
  cabinetry_drawings: "CABINETRY_DRAWINGS",
  changes_to_do: "CHANGES_TO_DO",
  site_measurements: "SITE_MEASUREMENTS",
  delivery_photos: "DELIVERY_PHOTOS",
  installation_photos: "INSTALLATION_PHOTOS",
  maintenance_photos: "MAINTENANCE_PHOTOS",
  finished_site_photos: "FINISHED_SITE_PHOTOS",
};

// Function to determine FileKind based on mime type
function getFileKind(mimeType) {
  if (!mimeType) return "OTHER";

  if (mimeType.startsWith("image/")) return "PHOTO";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType === "application/pdf") return "PDF";

  return "OTHER";
}

// Function to get MIME type from file path based on extension
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
    const targetPath = path.join(process.cwd(), "mediauploads", ...segments);

    // Prevent path traversal
    const uploadsRoot = path.join(process.cwd(), "mediauploads");
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
    console.error("Error in GET /api/uploads/lots/[...path]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const resolvedParams = await params;
    const segments = ensureArray(resolvedParams?.path);
    if (segments.length < 3) {
      return NextResponse.json(
        {
          status: false,
          message:
            "Path must be /api/uploads/[project_id]/[lot_id]/[tabkind]/[filename?]",
        },
        { status: 400 }
      );
    }
    const [projectId, lotId, tabKind] = segments;

    // Validate TabKind is one of the allowed values
    if (!VALID_TABKINDS.includes(tabKind)) {
      return NextResponse.json(
        {
          status: false,
          message: `Invalid TabKind: ${tabKind}. Allowed values are: ${VALID_TABKINDS.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    // Validate and parse multipart/form-data
    let form;
    try {
      form = await validateMultipartRequest(request);
    } catch (parseError) {
      console.error("FormData parse error:", parseError);
      return NextResponse.json(
        {
          status: false,
          message: parseError.message || "Failed to parse form data",
          error: parseError.message,
        },
        { status: 400 }
      );
    }
    const fileEntries = [];
    for (const [field, value] of form.entries()) {
      if (value instanceof File) {
        fileEntries.push({ field, file: value });
      }
    }
    if (fileEntries.length === 0) {
      return NextResponse.json(
        { status: false, message: "No file found in form-data" },
        { status: 400 }
      );
    }

    // Get or parse site_group from form data if it's a site_measurements tab
    const siteGroup = form.get("site_group");
    let siteMeasurementGroup = null;
    if (tabKind === "site_measurements" && siteGroup) {
      // Validate site_group is one of the allowed values
      const validSiteGroups = ["SITE_PHOTOS", "MEASUREMENT_PHOTOS"];
      const upperSiteGroup = siteGroup.toUpperCase();
      if (validSiteGroups.includes(upperSiteGroup)) {
        siteMeasurementGroup = upperSiteGroup;
      }
    }

    // Find or create the lot_tab record
    const tabKindEnum = TABKIND_TO_ENUM[tabKind];
    const lot = await prisma.lot.findUnique({
      where: { lot_id: lotId },
      include: {
        project: {
          select: {
            project_id: true,
            name: true,
          },
        },
      },
    });

    if (!lot) {
      return NextResponse.json(
        { status: false, message: `Lot with ID ${lotId} not found` },
        { status: 404 }
      );
    }

    // Get or create lot_tab
    let lotTab = await prisma.lot_tab.findUnique({
      where: {
        lot_id_tab: {
          lot_id: lotId,
          tab: tabKindEnum,
        },
      },
    });

    if (!lotTab) {
      lotTab = await prisma.lot_tab.create({
        data: {
          lot_id: lotId.toLowerCase(),
          tab: tabKindEnum,
        },
      });
    }

    const saved = [];
    for (const { field, file } of fileEntries) {
      // Upload file using original filename strategy
      const uploadResult = await uploadFile(file, {
        uploadDir: "mediauploads",
        subDir: `${projectId}/${lotId}/${tabKind}`,
        filenameStrategy: "original",
      });

      const fileKind = getFileKind(file.type);

      // Save file metadata to database
      const lotFile = await prisma.lot_file.create({
        data: {
          tab_id: lotTab.id,
          file_kind: fileKind,
          url: uploadResult.relativePath,
          filename: uploadResult.filename,
          mime_type: uploadResult.mimeType || null,
          extension: uploadResult.extension || null,
          size: uploadResult.size || null,
          site_group: siteMeasurementGroup,
          is_deleted: false,
        },
      });

      saved.push({
        field,
        filename: uploadResult.filename,
        size: uploadResult.size,
        mimetype: uploadResult.mimeType,
        path: uploadResult.relativePath,
        fileId: lotFile.id,
      });
    }

    // log all the uploaded file ids
    const logged = await Promise.all(
      saved.map((file) =>
        withLogging(
          request,
          "media",
          file.fileId,
          "CREATE",
          `File uploaded successfully: ${file.filename} for lot: ${lot.lot_id} and project: ${lot.project.name}`
        )
      )
    );

    const hasLoggingFailures = logged.some((log) => !log);
    if (hasLoggingFailures) {
      console.error(`Failed to log some file uploads for lot tab: ${tab.id}`);
    }
    return NextResponse.json(
      {
        status: true,
        message: "File uploaded",
        projectId,
        lotId,
        tabKind,
        files: saved,
        ...(hasLoggingFailures ? { warning: "Note: Upload succeeded but some logging failed" } : {})
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/uploads/lots/[...path]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const resolvedParams = await params;
    const segments = ensureArray(resolvedParams?.path);
    if (segments.length === 0) {
      return NextResponse.json(
        { status: false, message: "Missing path" },
        { status: 404 }
      );
    }
    // Mark file as deleted in database instead of physically deleting it
    // Since this is a soft delete, we check the database first, not the disk
    
    // Construct the expected relative path
    const targetPath = path.join(process.cwd(), "mediauploads", ...segments);
    const uploadsRoot = path.join(process.cwd(), "mediauploads");
    const normalized = path.normalize(targetPath);
    
    // Prevent path traversal
    if (!normalized.startsWith(uploadsRoot)) {
      return NextResponse.json(
        { status: false, message: "Not found" },
        { status: 404 }
      );
    }

    const relativePath = path
      .relative(process.cwd(), normalized)
      .replaceAll("\\", "/");

    // Try to find file by URL first
    let fileRecord = await prisma.lot_file.findFirst({
      where: {
        url: relativePath,
        is_deleted: false,
      },
    });

    // If not found by URL, try to find by filename and path segments
    // This handles cases where the path might not match exactly
    if (!fileRecord && segments.length >= 4) {
      const [projectId, lotId, tabKind, filename] = segments;
      const tabKindEnum = TABKIND_TO_ENUM[tabKind] || tabKind.toUpperCase();

      // Find the lot_tab first
      const lotTab = await prisma.lot_tab.findFirst({
        where: {
          lot_id: lotId,
          tab: tabKindEnum,
        },
      });

      if (lotTab) {
        // Try to find by filename in this tab
        fileRecord = await prisma.lot_file.findFirst({
          where: {
            tab_id: lotTab.id,
            filename: filename,
            is_deleted: false,
          },
        });
      }
    }

    if (!fileRecord) {
      return NextResponse.json(
        {
          status: false,
          message: "File record not found in database",
          debug: {
            relativePath,
            segments,
          },
        },
        { status: 404 }
      );
    }

    // Update the is_deleted flag to true
    const updatedFile = await prisma.lot_file.update({
      where: {
        id: fileRecord.id,
      },
      data: {
        is_deleted: true,
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "File marked as deleted successfully",
        data: {
          fileId: updatedFile.id,
          filename: updatedFile.filename,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in DELETE /api/uploads/lots/[...path]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
