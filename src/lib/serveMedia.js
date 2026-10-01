import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  ALL_ROLES,
  authorizeRequest,
  canAccessLot,
} from "@/lib/validators/authFromToken";

const MEDIA_ROOT = path.resolve(process.cwd(), "mediauploads");

// Uploaded files are private business documents: never let shared proxies
// or CDNs store them, and keep the browser copy short-lived so deletions
// and replaced files take effect quickly.
const CACHE_CONTROL = "private, max-age=300";

const MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
};

function getMimeType(filePath) {
  return (
    MIME_TYPES[path.extname(filePath).toLowerCase()] ||
    "application/octet-stream"
  );
}

function notFound() {
  return NextResponse.json(
    { status: false, message: "Not found" },
    { status: 404 },
  );
}

/**
 * Finds the live (not soft-deleted) DB record that owns an uploaded file.
 * Returns { kind, lot? } or null. Files with no record are never served.
 */
async function findFileRecord(relativePath) {
  const lotFile = await prisma.lot_file.findFirst({
    where: { url: relativePath, is_deleted: false },
    select: { tab: { select: { lot: { select: { installer_id: true } } } } },
  });
  if (lotFile) return { kind: "lot_file", lot: lotFile.tab?.lot };

  const media = await prisma.media.findFirst({
    where: { url: relativePath, is_deleted: false },
    select: { id: true },
  });
  if (media) return { kind: "media" };

  const supplierFile = await prisma.supplier_file.findFirst({
    where: { url: relativePath, is_deleted: false },
    select: { id: true },
  });
  if (supplierFile) return { kind: "supplier_file" };

  return null;
}

// Parses a single "bytes=start-end" range. Returns null when unsatisfiable.
function parseRange(rangeHeader, fileSize) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || (match[1] === "" && match[2] === "")) return null;

  let start;
  let end;
  if (match[1] === "") {
    // Suffix range: last N bytes
    const suffix = parseInt(match[2], 10);
    if (suffix === 0) return null;
    start = Math.max(fileSize - suffix, 0);
    end = fileSize - 1;
  } else {
    start = parseInt(match[1], 10);
    end = match[2] === "" ? fileSize - 1 : parseInt(match[2], 10);
    end = Math.min(end, fileSize - 1);
  }
  if (start > end || start >= fileSize) return null;
  return { start, end };
}

/**
 * Serves a file from mediauploads/ to an authenticated user.
 *
 * - Accepts the Bearer header or the auth_token cookie, since <img>, <video>
 *   and PDF viewers can't send an Authorization header.
 * - Only serves files that belong to a live lot_file, media or supplier_file
 *   record, so unknown and soft-deleted files return 404.
 * - "employee" users may only read lot files on lots they install.
 */
export async function serveMediaFile(request, segments) {
  const { error, auth } = await authorizeRequest(request, {
    roles: ALL_ROLES,
    allowCookie: true,
  });
  if (error) return error;

  if (!segments || segments.length === 0) return notFound();

  // Prevent path traversal (the trailing separator also rejects siblings
  // such as "mediauploads-old")
  const absolutePath = path.resolve(MEDIA_ROOT, ...segments);
  if (!absolutePath.startsWith(MEDIA_ROOT + path.sep)) return notFound();

  const relativePath = path
    .relative(process.cwd(), absolutePath)
    .replaceAll("\\", "/");

  const record = await findFileRecord(relativePath);
  if (!record) return notFound();
  if (auth.userType === "employee") {
    if (record.kind !== "lot_file" || !canAccessLot(auth, record.lot)) {
      return notFound();
    }
  }

  let stat;
  try {
    stat = await fs.promises.stat(absolutePath);
  } catch {
    return notFound();
  }
  if (!stat.isFile()) return notFound();

  const fileSize = stat.size;
  const headers = {
    "Content-Type": getMimeType(absolutePath),
    "Cache-Control": CACHE_CONTROL,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };

  const forceDownload =
    new URL(request.url).searchParams.get("download") === "true";
  if (forceDownload) {
    const filename = path.basename(absolutePath).replace(/["\\\r\n]/g, "_");
    headers["Content-Disposition"] = `attachment; filename="${filename}"`;
  } else {
    headers["Content-Disposition"] = "inline";
  }

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const range = parseRange(rangeHeader, fileSize);
    if (!range) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }
    const { start, end } = range;
    const stream = fs.createReadStream(absolutePath, { start, end });
    return new NextResponse(Readable.toWeb(stream), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const stream = fs.createReadStream(absolutePath);
  return new NextResponse(Readable.toWeb(stream), {
    status: 200,
    headers: { ...headers, "Content-Length": String(fileSize) },
  });
}
