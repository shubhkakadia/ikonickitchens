// Content-based file type detection for uploads. The client-supplied MIME type
// and file name are untrusted, so the type is decided from the file's bytes.
// SVG, HTML, scripts, and executables are deliberately not recognised: they can
// run script on our origin when opened, so they are always rejected.

export const SNIFF_BYTES = 4096;

// Groups callers can allow. Extensions are the only ones stored on disk for a
// detected type, so a PNG named "x.html" is rejected rather than saved as HTML.
export const FILE_GROUPS = {
  image: {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  },
  pdf: { pdf: "application/pdf" },
  video: {
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    ogg: "video/ogg",
  },
  office: {
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  cad: { dwg: "application/acad" },
  text: { csv: "text/csv", txt: "text/plain" },
};

export const ALL_FILE_GROUPS = Object.keys(FILE_GROUPS);

const ascii = (buf, start, end) => buf.toString("latin1", start, end);
const startsWith = (buf, bytes) => bytes.every((b, i) => buf[i] === b);

// Returns the group a buffer's signature belongs to, or null if unrecognised.
function sniffGroup(buf, ext) {
  if (buf.length < 4) return null;

  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image"; // JPEG
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image";
  if (ascii(buf, 0, 6) === "GIF87a" || ascii(buf, 0, 6) === "GIF89a")
    return "image";
  if (ascii(buf, 0, 4) === "RIFF" && buf.length >= 12) {
    const form = ascii(buf, 8, 12);
    if (form === "WEBP") return "image";
    if (form === "AVI ") return "video";
  }
  // The spec allows the header anywhere in the first 1024 bytes
  if (ascii(buf, 0, 1024).includes("%PDF-")) return "pdf";
  if (buf.length >= 12 && ascii(buf, 4, 8) === "ftyp") {
    const brand = ascii(buf, 8, 12);
    return [
      "heic",
      "heix",
      "hevc",
      "hevx",
      "mif1",
      "msf1",
      "heim",
      "heis",
    ].includes(brand)
      ? "image"
      : "video";
  }
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return "video"; // WebM / Matroska
  if (ascii(buf, 0, 4) === "OggS") return "video";
  if (ascii(buf, 0, 4) === "PK\x03\x04") {
    // Only genuine Office packages, not arbitrary zips
    const head = ascii(buf, 0, SNIFF_BYTES);
    const isOffice =
      head.includes("[Content_Types].xml") ||
      head.includes("word/") ||
      head.includes("xl/") ||
      head.includes("ppt/");
    return isOffice ? "office" : null;
  }
  if (startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    return "office"; // legacy .doc/.xls/.ppt
  if (/^AC10\d\d/.test(ascii(buf, 0, 6))) return "cad"; // DWG
  if (
    (ext === "csv" || ext === "txt") &&
    !buf.includes(0) &&
    !looksLikeMarkup(buf)
  ) {
    return "text";
  }
  return null;
}

function looksLikeMarkup(buf) {
  return /^\s*<(\?xml|!doctype|html|svg|script)/i.test(ascii(buf, 0, 256));
}

/**
 * Detects a file's type from its leading bytes.
 * @param {Buffer} buf - at least the first SNIFF_BYTES bytes of the file
 * @param {string} fileName - original name, used for the extension and to tell csv/txt apart
 * @param {string[]} allowedGroups - subset of ALL_FILE_GROUPS
 * @returns {{ group: string, extension: string, mimeType: string } | null}
 *   null when the content is unrecognised, not allowed here, or its extension
 *   doesn't belong to the detected type.
 */
export function detectFileType(buf, fileName, allowedGroups = ALL_FILE_GROUPS) {
  const dot = String(fileName || "").lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";

  const group = sniffGroup(buf, ext);
  if (!group || !allowedGroups.includes(group)) return null;

  const mimeType = FILE_GROUPS[group][ext];
  if (!mimeType) return null;
  return { group, extension: ext, mimeType };
}
