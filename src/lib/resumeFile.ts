// What kind of resume file is this (PDF or Word), and how to store and
// re-load it. A role's attached resume lives in storage under a path whose
// extension is the source of truth, so a re-analyze later rebuilds the File
// with the right name and type (the server reads a Word file by either).

import { DOCX_MIME, isDocxFile } from "./docx";

export type ResumeKind = "pdf" | "docx";

export function kindOfFile(file: { name: string; type: string }): ResumeKind {
  return isDocxFile(file) ? "docx" : "pdf";
}

export function kindOfPath(path: string | null | undefined): ResumeKind {
  return /\.docx$/i.test(path ?? "") ? "docx" : "pdf";
}

export function mimeFor(kind: ResumeKind): string {
  return kind === "docx" ? DOCX_MIME : "application/pdf";
}

export function fileNameFor(kind: ResumeKind): string {
  return kind === "docx" ? "resume.docx" : "resume.pdf";
}
