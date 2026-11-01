// Text extraction for Word (.docx) resumes, used by POST /analyze alongside the
// PDF path in pdfText.js. A .docx is a zip file, and zips can be "bombs": a few
// KB that unpack to gigabytes. The 5MB upload cap bounds the compressed size
// only, and this runs on one small Node instance, so the zip's own directory is
// checked BEFORE anything is unpacked.
//
// Only .docx is supported. The old binary .doc format isn't a zip and can't be
// read by this library, so the route tells the user to save as .docx or PDF.

const mammoth = require("mammoth");

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
// A resume's XML is tiny. 30MB unpacked is far above any real one.
const MAX_UNCOMPRESSED_BYTES = 30 * 1024 * 1024;
const MAX_ENTRIES = 2000;
// Rough resume density, used because a .docx has no fixed pages.
const WORDS_PER_PAGE = 500;

class DocxError extends Error {
  constructor(message) {
    super(message);
    this.name = "DocxError";
  }
}

/** True when an uploaded file is a .docx, by MIME type or file name. */
function isDocxUpload(file) {
  if (!file) return false;
  if (file.mimetype === DOCX_MIME) return true;
  return typeof file.originalname === "string" && /\.docx$/i.test(file.originalname);
}

/**
 * Reads the zip central directory (no unpacking) and rejects anything that
 * isn't a zip, claims too many entries, or would unpack beyond the limit.
 * Zip64 archives are rejected: a real resume never needs one.
 *
 * @param {Buffer} buffer
 */
function assertSafeDocx(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) throw new DocxError("Not a Word document.");

  // End-of-central-directory record: signature 0x06054b50, within the last 64KB+22.
  let eocd = -1;
  const lowest = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= lowest; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new DocxError("Not a Word document.");

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const dirSize = buffer.readUInt32LE(eocd + 12);
  const dirOffset = buffer.readUInt32LE(eocd + 16);
  if (entryCount === 0xffff || dirSize === 0xffffffff || dirOffset === 0xffffffff) {
    throw new DocxError("Unsupported Word document.");
  }
  if (entryCount > MAX_ENTRIES) throw new DocxError("Word document is too complex.");
  if (dirOffset + dirSize > buffer.length) throw new DocxError("Not a Word document.");

  let pos = dirOffset;
  let total = 0;
  for (let n = 0; n < entryCount; n++) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50) {
      throw new DocxError("Not a Word document.");
    }
    const uncompressed = buffer.readUInt32LE(pos + 24);
    if (uncompressed === 0xffffffff) throw new DocxError("Unsupported Word document.");
    total += uncompressed;
    if (total > MAX_UNCOMPRESSED_BYTES) throw new DocxError("Word document is too large once opened.");
    const nameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    pos += 46 + nameLen + extraLen + commentLen;
  }
}

/** Approximate page count from word count (a .docx has no fixed pagination). */
function estimatePages(text) {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_PAGE));
}

/**
 * Extract the text of a .docx buffer. Resolves to the same `{ text, numPages }`
 * shape as pdfText.js's extractPdfText so /analyze can use either.
 *
 * @param {Buffer} buffer
 * @returns {Promise<{ text: string, numPages: number }>}
 */
async function extractDocxText(buffer) {
  assertSafeDocx(buffer);
  let value;
  try {
    ({ value } = await mammoth.extractRawText({ buffer }));
  } catch (e) {
    throw new DocxError("Could not read this Word document.");
  }
  const text = typeof value === "string" ? value : "";
  return { text, numPages: estimatePages(text) };
}

module.exports = {
  DOCX_MIME,
  DocxError,
  isDocxUpload,
  assertSafeDocx,
  estimatePages,
  extractDocxText,
};
