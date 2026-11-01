// Client-side text extraction for Word (.docx) resumes, mirroring lib/pdf.ts so
// the Analyzer's own resume-strength and ATS checks work for either format.
// mammoth is loaded on demand: most visitors upload a PDF and never download it.

/** True for a .docx file, by MIME type or file name. */
export function isDocxFile(file: { name: string; type: string }): boolean {
  return (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(file.name)
  );
}

export async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = (await import("mammoth/mammoth.browser.js")) as unknown as {
    extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value;
}

/** Text of a resume file, whichever supported format it is. */
export async function extractResumeText(file: File): Promise<string> {
  if (isDocxFile(file)) return extractTextFromDocx(file);
  const { extractTextFromPdf } = await import("./pdf");
  return extractTextFromPdf(file);
}
