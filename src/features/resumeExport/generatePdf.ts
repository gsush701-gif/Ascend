import { pdf } from "@react-pdf/renderer";
import { createElement } from "react";
import type { ResumeStructuredContent } from "../../types/resume";
import type { ResumeTemplateId } from "./templateRegistry";
import { getResumeTemplateComponent } from "./templates";

/**
 * Client-side PDF generation — renders entirely in the browser via
 * `@react-pdf/renderer`'s browser build (its `pdf()` API resolves to
 * `lib/react-pdf.browser.js` per the package's `browser` field, which Vite
 * respects). No backend route exists for this: `structured_content` is
 * already available client-side through the existing RLS-scoped
 * `useResumeEditor` read, so a round-trip to the server would only add
 * latency and a new dependency in `server/` for no benefit. See the PR
 * description for the full client-vs-server rationale.
 */
// `pdf()` is typed to take a `React.ReactElement<DocumentProps>` (the
// element produced by react-pdf's own `<Document>`), but each template
// component here is typed as `{ content }` for its own props, not
// `DocumentProps` — it renders a `<Document>` internally rather than being
// one. The runtime shape is exactly right (react-pdf just walks the
// rendered element tree looking for `<Document>`/`<Page>`), so this narrows
// via `pdf`'s own parameter type instead of importing react-pdf's internal
// `DocumentProps` type.
type PdfInput = Parameters<typeof pdf>[0];

export async function generateResumePdfBlob(
  content: ResumeStructuredContent,
  templateId: ResumeTemplateId,
): Promise<Blob> {
  const Template = getResumeTemplateComponent(templateId);
  const instance = pdf(createElement(Template, { content }) as PdfInput);
  return instance.toBlob();
}

/** Triggers a browser file-save for a generated PDF blob. */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke on a delay so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Opens a generated PDF blob in a new tab for preview, without downloading it. */
export function previewPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  // Revoke well after the new tab has had time to load the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
