import { describe, expect, it } from "vitest";
import { fileNameFor, kindOfFile, kindOfPath, mimeFor } from "./resumeFile";

describe("resumeFile", () => {
  it("tells Word from PDF by file, and by storage path", () => {
    expect(kindOfFile({ name: "cv.docx", type: "" })).toBe("docx");
    expect(kindOfFile({ name: "cv.pdf", type: "application/pdf" })).toBe("pdf");
    expect(kindOfPath("user-1/role-abc.docx")).toBe("docx");
    expect(kindOfPath("user-1/role-abc.pdf")).toBe("pdf");
    expect(kindOfPath(undefined)).toBe("pdf");
  });

  it("gives the matching MIME type and download name", () => {
    expect(mimeFor("pdf")).toBe("application/pdf");
    expect(mimeFor("docx")).toContain("wordprocessingml");
    expect(fileNameFor("docx")).toBe("resume.docx");
    expect(fileNameFor("pdf")).toBe("resume.pdf");
  });
});
