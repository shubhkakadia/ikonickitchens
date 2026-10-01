import fs from "fs";
import path from "path";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { scanFile } from "./scanFile";
import { ALL_FILE_GROUPS, SNIFF_BYTES, detectFileType } from "./fileSignature";

const MB = 1024 * 1024;

// Per-file size limits, passed as `maxSize` to uploadFile
export const MAX_IMAGE_SIZE = 10 * MB;
export const MAX_DOCUMENT_SIZE = 25 * MB;
export const MAX_LOT_FILE_SIZE = 200 * MB; // site videos and drawings

// Whole-request limits for readFormData: the largest file plus room for fields
export const MAX_IMAGE_BODY = MAX_IMAGE_SIZE + MB;
export const MAX_DOCUMENT_BODY = MAX_DOCUMENT_SIZE + MB;
export const MAX_LOT_BODY = MAX_LOT_FILE_SIZE + 10 * MB;

export const MAX_FILES_PER_REQUEST = 10;

// Decompression-bomb guard: sharp's default is ~268 megapixels
const MAX_INPUT_PIXELS = 50e6;

export class UploadLimitError extends Error {
  constructor(message = "Request body is too large") {
    super(message);
    this.name = "UploadLimitError";
    this.status = 413;
  }
}

// Returns a 413 response for an UploadLimitError, otherwise null
export function uploadLimitResponse(error) {
  if (!(error instanceof UploadLimitError)) return null;
  return NextResponse.json(
    { status: false, message: error.message },
    { status: 413 },
  );
}

/**
 * request.formData() with a hard cap on the body size. Rejects early on a
 * declared Content-Length, and counts the bytes actually received so chunked
 * or understated bodies can't get past the limit.
 * @throws {UploadLimitError}
 */
export async function readFormData(request, maxBytes) {
  const tooLarge = () =>
    new UploadLimitError(
      `Request body exceeds the maximum of ${Math.floor(maxBytes / MB)} MB`,
    );

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge();
  if (!request.body) return request.formData();

  let received = 0;
  let exceeded = false;
  const counted = request.body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > maxBytes) {
          exceeded = true;
          controller.error(tooLarge());
        } else {
          controller.enqueue(chunk);
        }
      },
    }),
  );
  try {
    return await new Response(counted, {
      headers: { "content-type": request.headers.get("content-type") || "" },
    }).formData();
  } catch (error) {
    if (exceeded) throw tooLarge();
    throw error;
  }
}

export async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeFileToDisk(targetPath, file) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.promises.writeFile(targetPath, buffer);
}

/**
 * Converts an image file to WebP format using sharp
 * @param {Buffer} imageBuffer - The image buffer to convert
 * @param {string} mimeType - The MIME type of the original image
 * @returns {Promise<Buffer>} - The converted WebP buffer
 */
export async function convertImageToWebP(imageBuffer, mimeType) {
  try {
    // Convert to WebP with quality optimization
    const webpBuffer = await sharp(imageBuffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .webp({ quality: 90 })
      .toBuffer();
    return webpBuffer;
  } catch (error) {
    console.error("Error converting image to WebP:", error);
    throw new Error(`Failed to convert image to WebP: ${error.message}`);
  }
}

/**
 * Checks if a file is an image based on MIME type
 * @param {string} mimeType - The MIME type to check
 * @returns {boolean} - True if the file is an image
 */
export function isImageFile(mimeType) {
  if (!mimeType) return false;
  return mimeType.startsWith("image/") && mimeType !== "image/svg+xml"; // Skip SVG as it's vector
}

export async function getUniqueFilename(targetDir, baseName, extension) {
  let filename = `${baseName}${extension}`;
  let counter = 1;
  while (await fileExists(path.join(targetDir, filename))) {
    filename = `${baseName}-${counter}${extension}`;
    counter++;
  }
  return filename;
}

export async function deleteFileFromDisk(filePath) {
  try {
    if (await fileExists(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting file from disk:", error);
    return false;
  }
}

export async function getFileMetadata(filePath, file = null) {
  const fileStats = await fs.promises.stat(filePath);
  const extension = path.extname(filePath).slice(1); // Remove the dot
  const mimeType = file?.type || "application/octet-stream";

  // Determine file type based on mime type
  let fileType = "other";
  if (mimeType.startsWith("image/")) {
    fileType = "image";
  } else if (mimeType.startsWith("video/")) {
    fileType = "video";
  } else if (mimeType === "application/pdf") {
    fileType = "pdf";
  } else if (mimeType.startsWith("application/")) {
    fileType = "document";
  }

  return {
    size: fileStats.size,
    mimeType,
    extension,
    fileType,
    filename: file?.name || path.basename(filePath),
  };
}

export function getRelativePath(absolutePath) {
  return path.relative(process.cwd(), absolutePath).replaceAll("\\", "/");
}

export async function generateUniqueBaseName(prefix = "") {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

export async function uploadFile(file, options = {}) {
  const {
    uploadDir = "mediauploads",
    subDir = "",
    filenameStrategy = "unique",
    idPrefix = "",
    maxSize = null,
    allowedTypes = null,
    allowedExtensions = null,
    // Content-based allowlist; see FILE_GROUPS in fileSignature.js
    allowedGroups = ALL_FILE_GROUPS,
  } = options;

  // Validate file
  if (!file || !(file instanceof File)) {
    throw new Error("Invalid file provided");
  }

  // Validate file size
  if (maxSize && file.size > maxSize) {
    throw new Error(
      `File size exceeds maximum allowed size of ${maxSize} bytes`,
    );
  }

  // Detect the real type from the file's bytes; file.type and file.name are
  // client-controlled. Anything unrecognised (SVG, HTML, scripts, ...) is rejected.
  const head = Buffer.from(await file.slice(0, SNIFF_BYTES).arrayBuffer());
  const detected = detectFileType(head, file.name, allowedGroups);
  if (!detected) {
    throw new Error("File type is not allowed");
  }
  const detectedType = detected.mimeType;

  // Validate MIME type
  if (allowedTypes && !allowedTypes.includes(detectedType)) {
    throw new Error(`File type ${detectedType} is not allowed`);
  }

  // Validate extension
  const fileExtension = path.extname(file.name).toLowerCase();
  if (
    allowedExtensions &&
    !allowedExtensions.includes(fileExtension.toLowerCase())
  ) {
    throw new Error(`File extension ${fileExtension} is not allowed`);
  }

  // Build target directory
  const dirParts = [uploadDir];
  if (subDir) dirParts.push(subDir);
  const uploadRoot = path.resolve(process.cwd(), uploadDir) + path.sep;
  const targetDir = path.resolve(process.cwd(), ...dirParts);
  if (!(targetDir + path.sep).startsWith(uploadRoot)) {
    throw new Error("Invalid path");
  }
  await fs.promises.mkdir(targetDir, { recursive: true });

  // Check if file is an image and should be converted to WebP
  const isImage = detected.group === "image" && isImageFile(detectedType);
  const finalExtension = isImage ? ".webp" : fileExtension;

  // Generate filename based on strategy
  const safeName = (s) =>
    String(s)
      .replace(/[^A-Za-z0-9_-]/g, "_")
      .slice(0, 100);
  const safePrefix = idPrefix ? safeName(idPrefix) : "";
  let baseName;
  let targetName;
  switch (filenameStrategy) {
    case "id-based":
      baseName = safePrefix || "file";
      targetName = await getUniqueFilename(targetDir, baseName, finalExtension);
      break;
    case "original":
      baseName = safeName(path.basename(file.name, fileExtension)) || "file";
      targetName = await getUniqueFilename(targetDir, baseName, finalExtension);
      break;
    case "unique":
    default:
      baseName = await generateUniqueBaseName(safePrefix);
      targetName = `${baseName}${finalExtension}`;
      break;
  }

  const targetPath = path.resolve(targetDir, targetName);
  if (!targetPath.startsWith(uploadRoot)) {
    throw new Error("Invalid path");
  }

  // Convert image to WebP if it's an image, otherwise write as-is
  if (isImage) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const webpBuffer = await convertImageToWebP(buffer, file.type);

      // Write WebP file to disk
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.writeFile(targetPath, webpBuffer);
    } catch (error) {
      console.error("Error converting image to WebP:", error);
      // An over-sized image is an attack, not a format sharp can't read
      if (/pixel limit/i.test(error.message)) {
        throw new Error("Image dimensions are too large");
      }
      // Fallback to original file if conversion fails
      await writeFileToDisk(targetPath, file);
    }
  } else {
    // Write non-image file to disk as-is
    await writeFileToDisk(targetPath, file);
  }

  // Scan file for viruses
  try {
    const scanResult = await scanFile(targetPath);
    if (!scanResult.clean) {
      // File is infected and has been deleted by scanFile
      throw new Error(
        `File contains malware: ${scanResult.viruses?.join(", ") || "unknown threat"}`,
      );
    }
  } catch (error) {
    // If scan fails or file is infected, ensure file is deleted
    try {
      if (await fileExists(targetPath)) {
        await deleteFileFromDisk(targetPath);
      }
    } catch (deleteError) {
      console.error("Error deleting infected file:", deleteError);
    }
    // Re-throw the error
    throw error;
  }

  // Get file metadata - update MIME type and extension for converted images
  const metadata = await getFileMetadata(targetPath, {
    type: detectedType,
    name: file.name,
  });

  // Update metadata for WebP converted images
  if (isImage) {
    metadata.mimeType = "image/webp";
    metadata.extension = "webp";
    metadata.fileType = "image";
    // Update size from the actual saved file
    const stats = await fs.promises.stat(targetPath);
    metadata.size = stats.size;
  }

  const relativePath = getRelativePath(targetPath);

  return {
    success: true,
    filePath: targetPath,
    relativePath,
    filename: targetName,
    originalFilename: file.name,
    ...metadata,
  };
}

export async function uploadMultipleFiles(files, options = {}) {
  const filesArray = Array.isArray(files) ? files : [files];
  const results = {
    successful: [],
    failed: [],
  };

  for (const file of filesArray) {
    if (!(file instanceof File)) continue;

    try {
      const result = await uploadFile(file, options);
      results.successful.push(result);
    } catch (error) {
      console.error("Error uploading file:", error);
      results.failed.push({
        filename: file.name,
        error: error.message,
      });
    }
  }

  return results;
}

export async function deleteFileByRelativePath(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  return await deleteFileFromDisk(absolutePath);
}

export async function validateMultipartRequest(
  request,
  maxBytes = MAX_DOCUMENT_BODY,
) {
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.includes("multipart/form-data")) {
    throw new Error("Content-Type must be multipart/form-data");
  }

  try {
    return await readFormData(request, maxBytes);
  } catch (error) {
    if (error instanceof UploadLimitError) throw error;
    throw new Error(`Failed to parse form data: ${error.message}`);
  }
}

export function getFileFromFormData(formData, fieldName, getAll = false) {
  if (getAll) {
    const files = formData.getAll(fieldName);
    return files.filter((file) => file instanceof File);
  }
  const file = formData.get(fieldName);
  // Return the file if it's a File instance
  if (file instanceof File) {
    return file;
  }
  // Return empty string if it's explicitly an empty string (for deletion)
  if (file === "") {
    return "";
  }
  // Return null for null/undefined/not found
  return null;
}
