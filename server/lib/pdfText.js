// pdf-parse@1.1.1 bundles its own vendored copy of pdf.js v1.10.100 (~2016)
// which breaks under modern Node: merely evaluating `typeof fetch` anywhere
// in the process (which Node's own lazy-loaded fetch/WebSocket globals do)
// corrupts its internal parsing state and produces spurious
// "Illegal character" / "bad XRef entry" errors on perfectly valid PDFs.
// pdfjs-dist (already a pinned dependency, actively maintained, same
// library the frontend already uses) doesn't have this problem.
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

/**
 * Extract text from a PDF buffer.
 * @param {Buffer} buffer
 * @returns {Promise<{ text: string, numPages: number }>}
 */
async function extractPdfText(buffer) {
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    verbosity: 0,
    isEvalSupported: false,
  }).promise;

  const pageTexts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => item.str || "").join(" "));
  }

  return { text: pageTexts.join("\n"), numPages: doc.numPages };
}

module.exports = { extractPdfText };
