import { Card } from "../../../components/ui/Card";

type ResumeUploaderProps = {
  resume: File | null;
  onResumeChange: (file: File | null) => void;
};

export function ResumeUploader({ resume, onResumeChange }: ResumeUploaderProps) {
  return (
    <Card>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        Step 1 • Resume PDF
      </div>
      <div className="mt-2">
        <div className="text-base font-semibold">Your Resume</div>
        <p className="mt-1 text-xs text-zinc-400">
          Upload a text-based PDF so Ascend can read your projects and skills
          accurately.
        </p>
      </div>
      <div className="mt-4 h-px bg-zinc-900/80" />
      <label className="mt-4 block cursor-pointer">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-4 py-2.5 text-sm hover:bg-zinc-900 transition-colors">
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => onResumeChange(e.target.files?.[0] || null)}
            />
            <span>Choose PDF</span>
          </div>
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">
            Max 5MB
          </span>
        </div>
      </label>
      <p className="mt-2 text-[11px] text-zinc-500">
        Tip: Export from Word/Docs as PDF. Scanned images usually can't be
        parsed.
      </p>
      {resume && (
        <div className="mt-3 rounded-xl border border-zinc-900 bg-zinc-950/70 px-3 py-2">
          <div className="text-[11px] text-zinc-500">Selected file</div>
          <div className="mt-0.5 text-sm text-zinc-200 truncate">
            {resume.name}
          </div>
        </div>
      )}
    </Card>
  );
}
