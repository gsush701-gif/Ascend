// One-off generator for e2e/fixtures/sample-resume.pdf — a small, valid,
// text-based (not scanned-image) PDF with real resume-like content and a
// correct xref table, so pdfjs-dist (server/lib/pdfText.js) can extract
// text from it exactly like a real user-uploaded resume. Run with:
//   node e2e/fixtures/generate-sample-pdf.cjs
// Not part of the test run itself — the committed .pdf output is the fixture.
const fs = require("fs");
const path = require("path");

const lines = [
  "Jordan Rivera",
  "jordan.rivera@example.com | (555) 019-2837 | linkedin.com/in/jordanrivera | github.com/jordanrivera",
  "",
  "SUMMARY",
  "Computer science student with experience building full-stack web applications.",
  "",
  "EXPERIENCE",
  "Software Engineering Intern, Example Corp (Summer 2025)",
  "Built internal tools using Python, JavaScript, React, and Node.js.",
  "Deployed services to AWS using Docker and improved test coverage by 30 percent.",
  "",
  "PROJECTS",
  "Personal Portfolio Site - built with React and TypeScript, deployed on GitHub Pages.",
  "",
  "SKILLS",
  "Python, JavaScript, TypeScript, React, Node.js, SQL, Git, AWS, Docker, REST APIs",
  "",
  "EDUCATION",
  "B.S. Computer Science, State University, Expected 2027",
];

function pdfEscape(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

const contentLines = lines
  .map((line, i) => {
    const y = 740 - i * 16;
    return `BT /F1 10 Tf 50 ${y} Td (${pdfEscape(line)}) Tj ET`;
  })
  .join("\n");

const objects = [];
objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
objects[3] =
  "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>";
objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
const streamBody = contentLines;
objects[5] = `<< /Length ${Buffer.byteLength(streamBody, "utf8")} >>\nstream\n${streamBody}\nendstream`;

let pdf = "%PDF-1.4\n";
const offsets = [0];
for (let i = 1; i <= 5; i++) {
  offsets[i] = Buffer.byteLength(pdf, "utf8");
  pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
}
const xrefOffset = Buffer.byteLength(pdf, "utf8");
pdf += `xref\n0 6\n0000000000 65535 f \n`;
for (let i = 1; i <= 5; i++) {
  pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
}
pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

const outPath = path.join(__dirname, "sample-resume.pdf");
fs.writeFileSync(outPath, pdf, "binary");
console.log("Wrote", outPath, `(${Buffer.byteLength(pdf, "binary")} bytes)`);
