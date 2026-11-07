import { useCallback, useRef, useState } from "react";
import { Upload, FileText, X, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "../../lib/cn";
import { toast } from "../ui/toast";
import { useRoleResumePdf } from "../../features/tracker/hooks/useRoleResumePdf";
import type { TrackerItem } from "../../types/tracker";

type RoleResumePdfPanelProps = {
  item: TrackerItem;
  updateRoleFields: (id: string, fields: Partial<TrackerItem>) => void;
};

/**
 * Drag-and-drop resume viewer for the Role report page. Renders inline via
 * a plain <iframe> (every target browser renders PDFs natively). Once
 * attached, this resume is what "Analyze this role" scores against instead
 * of your account's default saved resume — see RoleDetail.tsx's runAnalyze.
 */
export function RoleResumePdfPanel({ item, updateRoleFields }: RoleResumePdfPanelProps) {
  const { uploading, error, objectUrl, kind, upload, remove } = useRoleResumePdf(
    item.id,
    item.resumeStoragePath,
    updateRoleFields,
  );
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      void upload(file).then(({ error: uploadError }) => {
        if (uploadError) return;
        toast.success({
          title: "Resume attached",
          description: "This role's analysis will now use this resume instead of your default.",
        });
      });
    },
    [upload],
  );

  const hasResume = Boolean(item.resumeStoragePath);

  return (
    <div
      className={
        hasResume
          ? "flex h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          : ""
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {hasResume ? (
        <>
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50 px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-600">
              <FileText size={14} className="shrink-0 text-slate-400" />
              <span className="truncate">{kind === "docx" ? "Resume.docx" : "Resume.pdf"}</span>
            </span>
            <div className="flex shrink-0 items-center gap-0.5">
              {objectUrl && kind === "pdf" && (
                <a
                  href={objectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-press rounded-md p-1.5 text-slate-500 transition hover:bg-slate-900/[0.08] hover:text-slate-900"
                  title="Open in new tab"
                >
                  <ExternalLink size={15} />
                </a>
              )}
              <span className="mx-1 h-4 w-px bg-slate-300" aria-hidden="true" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-press rounded-md p-1.5 text-slate-500 transition hover:bg-slate-900/[0.08] hover:text-slate-900 disabled:opacity-50"
                title="Replace"
              >
                <RefreshCw size={15} className={uploading ? "animate-spin" : ""} />
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                className="btn-press rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-600"
                title="Remove"
              >
                <X size={15} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 bg-slate-50">
            {kind === "docx" ? (
              // Browsers can't render a Word file inline the way they do a PDF, so
              // show what's attached and let them download it; analysis still uses it.
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-600">
                  <FileText size={22} />
                </span>
                <p className="text-sm font-medium text-slate-800">Word resume attached</p>
                <p className="max-w-[260px] text-xs text-slate-500">
                  Word files can&apos;t be previewed here, but this role&apos;s analysis uses it. Upload a PDF if you
                  want to see it on this page.
                </p>
                {objectUrl && (
                  <a
                    href={objectUrl}
                    download="resume.docx"
                    className="btn-press rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Download
                  </a>
                )}
                {error && <p className="text-xs text-red-600">{error}</p>}
              </div>
            ) : objectUrl ? (
              // #toolbar=0 hides Chrome's own built-in PDF viewer toolbar
              // (the dark bar with page count/zoom/print) — that chrome is
              // drawn natively by the browser, not by this page, so it
              // can't be recolored directly; hiding it and letting our own
              // light `bg-slate-100` show through is the actual fix.
              <iframe src={`${objectUrl}#toolbar=0`} title="Resume PDF" className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">
                {error ?? "Loading…"}
              </div>
            )}
          </div>
        </>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-white p-8 text-center transition",
            dragActive
              ? "border-cyan-400 bg-cyan-500/5"
              : "border-slate-300 hover:border-slate-400 hover:bg-slate-900/[0.02]",
          )}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/[0.04] text-slate-400">
            <Upload size={18} />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-700">
              {uploading ? "Uploading…" : "Attach a resume for this role"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Drag a PDF or Word file here, or click to browse</p>
          </div>
          <p className="max-w-[260px] text-xs text-slate-400">
            Without one, analysis uses your default saved resume.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
