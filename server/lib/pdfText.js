// `npm audit` flags this pinned pdfjs-dist version for CVE-2024-4367
// (arbitrary JS execution via a crafted PDF's embedded actions when
// `isEvalSupported` is left at its default of true). That's exactly why
// `isEvalSupported: false` is passed to getDocument() below — it's the
// workaround the advisory itself recommends, so this pin is safe to leave
// as-is for now. A real upgrade (needed eventually — this version is very
// old) requires switching this file's `require()` to a dynamic `import()`,
// since pdfjs-dist dropped its CommonJS legacy build in v3+ and now needs
// Node >=20.16; that should happen as its own change once the deployed
// Node version on Render is confirmed, not bundled in here.
//
// pdf-parse@1.1.1 bundles its own vendored copy of pdf.js v1.10.100 (~2016)
// which breaks under modern Node: merely evaluating `typeof fetch` anywhere
// in the process (which Node's own lazy-loaded fetch/WebSocket globals do)
// corrupts its internal parsing state and produces spurious
// "Illegal character" / "bad XRef entry" errors on perfectly valid PDFs.
// pdfjs-dist (already a pinned dependency, actively maintained, same
// library the frontend already uses) doesn't have this problem.
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

// Real resumes are 1-3 pages. The 5MB upload cap doesn't bound page count
// (a crafted PDF can pack thousands of near-empty pages into a few MB), and
// parsing every page runs on this single Node instance, so without a cap a
// malicious upload could tie up the event loop for everyone. 25 is generous
// headroom above any legitimate resume.
const MAX_PAGES = 25;

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

  const pagesToRead = Math.min(doc.numPages, MAX_PAGES);
  const pageTexts = [];
  for (let i = 1; i <= pagesToRead; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => item.str || "").join(" "));
  }

  return { text: pageTexts.join("\n"), numPages: doc.numPages };
}

module.exports = { extractPdfText };
