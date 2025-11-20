import fs from "fs";
import path from "path";

/**
 * Centralized File Handler Library
 * Provides utilities for file operations across all API routes
 */

/**
 * Check if a file exists at the given path
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<boolean>} - True if file exists, false otherwise
 */
export async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write a file to disk
 * @param {string} targetPath - Absolute path where file should be written
 * @param {File} file - File object from FormData
 * @returns {Promise<void>}
 */
export async function writeFileToDisk(targetPath, file) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.promises.writeFile(targetPath, buffer);
}

/**
 * Get unique filename by appending counter if file exists
 * @param {string} targetDir - Directory where file will be saved
 * @param {string} baseName - Base name for the file (without extension)
 * @param {string} extension - File extension (e.g., ".jpg", ".pdf")
 * @returns {Promise<string>} - Unique filename
 */
export async function getUniqueFilename(targetDir, baseName, extension) {
  let filename = `${baseName}${extension}`;
  let counter = 1;
  while (await fileExists(path.join(targetDir, filename))) {
    filename = `${baseName}-${counter}${extension}`;
    counter++;
  }
  return filename;
}

/**
 * Delete a file from disk
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<boolean>} - True if deleted successfully, false otherwise
 */
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

/**
 * Get file metadata
 * @param {string} filePath - Absolute path to the file
 * @param {File} file - File object from FormData (optional, for mime type)
 * @returns {Promise<Object>} - File metadata object
 */
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

/**
 * Get relative path from project root
 * @param {string} absolutePath - Absolute file path
 * @returns {string} - Relative path (with forward slashes)
 */
export function getRelativePath(absolutePath) {
  return path.relative(process.cwd(), absolutePath).replaceAll("\\", "/");
}

/**
 * Generate a unique base name for a file
 * @param {string} prefix - Optional prefix (e.g., entity ID)
 * @returns {string} - Unique base name
 */
export function generateUniqueBaseName(prefix = "") {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * Upload configuration options
 * @typedef {Object} UploadOptions
 * @property {string} uploadDir - Base upload directory (relative to process.cwd())
 * @property {string} subDir - Optional subdirectory (e.g., entity ID)
 * @property {string} filenameStrategy - 'unique' | 'id-based' | 'original'
 * @property {string} idPrefix - Optional ID prefix for id-based strategy
 * @property {number} maxSize - Maximum file size in bytes (optional)
 * @property {string[]} allowedTypes - Allowed MIME types (optional)
 * @property {string[]} allowedExtensions - Allowed file extensions (optional)
 */

/**
 * Upload a single file
 * @param {File} file - File object from FormData
 * @param {UploadOptions} options - Upload configuration options
 * @returns {Promise<Object>} - Upload result with file info
 */
export async function uploadFile(file, options = {}) {
  const {
    uploadDir = "uploads",
    subDir = "",
    filenameStrategy = "unique",
    idPrefix = "",
    maxSize = null,
    allowedTypes = null,
    allowedExtensions = null,
  } = options;

  // Validate file
  if (!file || !(file instanceof File)) {
    throw new Error("Invalid file provided");
  }

  // Validate file size
  if (maxSize && file.size > maxSize) {
    throw new Error(
      `File size exceeds maximum allowed size of ${maxSize} bytes`
    );
  }

  // Validate MIME type
  if (allowedTypes && !allowedTypes.includes(file.type)) {
    throw new Error(`File type ${file.type} is not allowed`);
  }

  // Validate extension
  const fileExtension = path.extname(file.name);
  if (
    allowedExtensions &&
    !allowedExtensions.includes(fileExtension.toLowerCase())
  ) {
    throw new Error(`File extension ${fileExtension} is not allowed`);
  }

  // Build target directory
  const dirParts = [uploadDir];
  if (subDir) dirParts.push(subDir);
  const targetDir = path.join(process.cwd(), ...dirParts);
  await fs.promises.mkdir(targetDir, { recursive: true });

  // Generate filename based on strategy
  let baseName;
  let targetName;
  switch (filenameStrategy) {
    case "id-based":
      baseName = idPrefix || "file";
      targetName = await getUniqueFilename(targetDir, baseName, fileExtension);
      break;
    case "original":
      baseName = path.basename(file.name, fileExtension);
      targetName = await getUniqueFilename(targetDir, baseName, fileExtension);
      break;
    case "unique":
    default:
      baseName = generateUniqueBaseName(idPrefix);
      targetName = `${baseName}${fileExtension}`;
      break;
  }

  const targetPath = path.join(targetDir, targetName);

  // Write file to disk
  await writeFileToDisk(targetPath, file);

  // Get file metadata
  const metadata = await getFileMetadata(targetPath, file);
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

/**
 * Upload multiple files
 * @param {File[]} files - Array of File objects from FormData
 * @param {UploadOptions} options - Upload configuration options
 * @returns {Promise<Object>} - Upload results with successful and failed uploads
 */
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

/**
 * Delete a file by relative path
 * @param {string} relativePath - Relative path from project root
 * @returns {Promise<boolean>} - True if deleted successfully
 */
export async function deleteFileByRelativePath(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  return await deleteFileFromDisk(absolutePath);
}

/**
 * Validate multipart form data request
 * @param {Request} request - Next.js request object
 * @returns {Promise<FormData>} - Parsed FormData
 * @throws {Error} - If request is not multipart/form-data
 */
export async function validateMultipartRequest(request) {
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.includes("multipart/form-data")) {
    throw new Error("Content-Type must be multipart/form-data");
  }

  try {
    return await request.formData();
  } catch (error) {
    throw new Error(`Failed to parse form data: ${error.message}`);
  }
}

/**
 * Get file from FormData by field name
 * @param {FormData} formData - FormData object
 * @param {string} fieldName - Field name in FormData
 * @param {boolean} getAll - If true, returns array of all files with this name
 * @returns {File|File[]|null} - File object(s) or null if not found
 */
export function getFileFromFormData(formData, fieldName, getAll = false) {
  if (getAll) {
    const files = formData.getAll(fieldName);
    return files.filter((file) => file instanceof File);
  }
  const file = formData.get(fieldName);
  return file instanceof File ? file : null;
}
