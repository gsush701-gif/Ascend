import { describe, it, expect } from "vitest";
import { buildResumeExportFilename } from "./filename";

describe("buildResumeExportFilename", () => {
  it("builds a filesystem-safe name from a normal resume name and template", () => {
    expect(buildResumeExportFilename("Jane Doe Resume", "classic")).toBe("Jane_Doe_Resume_Classic.pdf");
  });

  it("falls back to 'Resume' when the resume name is null/empty/whitespace", () => {
    expect(buildResumeExportFilename(null, "modern")).toBe("Resume_Modern.pdf");
    expect(buildResumeExportFilename("", "modern")).toBe("Resume_Modern.pdf");
    expect(buildResumeExportFilename("   ", "modern")).toBe("Resume_Modern.pdf");
  });

  it("strips punctuation/special characters that aren't filesystem-safe", () => {
    expect(buildResumeExportFilename("Jane's Résumé (v2)!!", "technical")).toBe("Jane_s_R_sum_v2_Technical.pdf");
  });

  it("collapses consecutive separators and trims leading/trailing underscores", () => {
    expect(buildResumeExportFilename("  --Jane--  ", "classic")).toBe("Jane_Classic.pdf");
  });
});
