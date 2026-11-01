import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { cn } from "../../../lib/cn";
import { validateResumeFile } from "../inputChecks";

type Props = {
  /** Name of the resume currently in use, if any. */
  fileName: string | null;
  /** Called only with a file that passed the checks. */
  onFile: (file: File) => void;
};

/**
 * Resume picker with drag-and-drop and plain-language errors. PDF and Word
 * (.docx) are accepted; an old .doc or a photo gets told what to do, instead of
 * the picker silently hiding it or the server failing later.
 */
export function ResumeDropzone({ fileName, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function accept(file: File | undefined | null) {
    if (!file) return;
    const problem = validateResumeFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onFile(file);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors",
          dragging
            ? "border-cyan-400 bg-cyan-500/10"
            : fileName
              ? "border-emerald-300 bg-emerald-50/60"
              : "border-slate-300 bg-slate-900/[0.03] hover:bg-slate-900/[0.06]",
        )}
      >
        {fileName ? (
          <FileText className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <Upload className="h-5 w-5 shrink-0 text-slate-400" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-slate-800">
            {fileName ?? "Drop your resume here, or click to choose"}
          </div>
          <div className="text-[11px] text-slate-500">
            {fileName ? "Click to choose a different file" : "PDF or Word (.docx), up to 5MB"}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          // No type filter on purpose: a hidden file looks like "my file is missing".
          // Anything that isn't a PDF or .docx gets an explanation instead.
          className="hidden"
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
