import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");
const { assertSafeDocx, estimatePages, extractDocxText, isDocxUpload, DOCX_MIME } = require("./docxText");

/** A minimal but valid .docx containing the given paragraphs. */
async function makeDocx(paragraphs) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  const body = paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

describe("extractDocxText", () => {
  it("reads the paragraphs of a real .docx", async () => {
    const buf = await makeDocx(["Jordan Rivera", "Built a REST API with Node and Docker"]);
    const { text, numPages } = await extractDocxText(buf);
    expect(text).toContain("Jordan Rivera");
    expect(text).toContain("REST API with Node and Docker");
    expect(numPages).toBe(1);
  });

  it("rejects something that is not a Word document, without throwing a raw library error", async () => {
    await expect(extractDocxText(Buffer.from("this is just plain text, not a zip file at all"))).rejects.toThrow(
      /Word document/,
    );
    await expect(extractDocxText(Buffer.alloc(0))).rejects.toThrow(/Word document/);
  });
});

describe("assertSafeDocx — zip bomb guard", () => {
  it("accepts an ordinary .docx", async () => {
    expect(() => assertSafeDocx(null)).toThrow();
    const buf = await makeDocx(["hello"]);
    expect(() => assertSafeDocx(buf)).not.toThrow();
  });

  it("rejects a small file that would unpack to far more than the limit", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", Buffer.alloc(40 * 1024 * 1024, 0)); // 40MB of zeros, tiny once compressed
    const bomb = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    expect(bomb.length).toBeLessThan(5 * 1024 * 1024);
    expect(() => assertSafeDocx(bomb)).toThrow(/too large/);
  });
});

describe("helpers", () => {
  it("estimates pages from word count, at least one", () => {
    expect(estimatePages("")).toBe(1);
    expect(estimatePages("word ".repeat(499))).toBe(1);
    expect(estimatePages("word ".repeat(1200))).toBe(3);
  });

  it("recognises a .docx by MIME type or file name", () => {
    expect(isDocxUpload({ mimetype: DOCX_MIME, originalname: "x" })).toBe(true);
    expect(isDocxUpload({ mimetype: "application/octet-stream", originalname: "My Resume.DOCX" })).toBe(true);
    expect(isDocxUpload({ mimetype: "application/pdf", originalname: "cv.pdf" })).toBe(false);
    expect(isDocxUpload(null)).toBe(false);
  });
});
