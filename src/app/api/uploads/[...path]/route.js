import path from "path";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";
import { prisma } from "@/lib/db";
import {
  uploadFile,
  validateMultipartRequest,
} from "@/lib/fileHandler";

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
];

// Mapping TabKind enum to abbreviations
const TABKIND_ABBREVIATIONS = {
  architecture_drawings: "AD",
  appliances_specifications: "AS",
  material_selection: "MS",
  cabinetry_drawings: "CD",
  changes_to_do: "CTD",
  site_measurements: "SM",
};

// Mapping lowercase to proper enum format for database
const TABKIND_TO_ENUM = {
  architecture_drawings: "ARCHITECTURE_DRAWINGS",
  appliances_specifications: "APPLIANCES_SPECIFICATIONS",
  material_selection: "MATERIAL_SELECTION",
  cabinetry_drawings: "CABINETRY_DRAWINGS",
  changes_to_do: "CHANGES_TO_DO",
  site_measurements: "SITE_MEASUREMENTS",
};

// Function to determine FileKind based on mime type
function getFileKind(mimeType) {
  if (!mimeType) return "OTHER";

  if (mimeType.startsWith("image/")) return "PHOTO";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType === "application/pdf") return "PDF";

  return "OTHER";
}


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

    // Await params before accessing its properties (Next.js 15 requirement)
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
    const [projectId, lotId, tabKind, filenameFromUrl] = segments;

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
        uploadDir: "uploads",
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

    return NextResponse.json(
      {
        status: true,
        message: "File uploaded",
        projectId,
        lotId,
        tabKind,
        files: saved,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}