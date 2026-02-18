import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/cn";

type JobDescriptionBoxProps = {
  jd: string;
  onJdChange: (value: string) => void;
  onAnalyze: () => void;
  canAnalyze: boolean;
  loading: boolean;
  analyzeError: string | null;
  onRetry: () => void;
};

export function JobDescriptionBox({
  jd,
  onJdChange,
  onAnalyze,
  canAnalyze,
  loading,
  analyzeError,
  onRetry,
}: JobDescriptionBoxProps) {
  return (
    <Card>
      <div className="text-base font-semibold mb-4">Job Description</div>
      <p className="text-sm text-zinc-400 mb-4">
        Paste the JD. We'll extract skills and compare.
      </p>
      <textarea
        value={jd}
        onChange={(e) => onJdChange(e.target.value)}
        placeholder="Paste the job description here..."
        className="w-full min-h-[200px] rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-700 resize-none"
      />
      <Button
        onClick={onAnalyze}
        disabled={!canAnalyze}
        className={cn(
          "mt-4 w-full",
          canAnalyze ? "" : "opacity-60 cursor-not-allowed"
        )}
        variant="primary"
        size="lg"
      >
        {loading ? "Analyzing..." : "Analyze Alignment"}
      </Button>
      <div className="mt-3 text-xs text-zinc-500">
        Tip: JD must be at least 20 characters.
      </div>
      {analyzeError && (
        <div className="mt-4 rounded-2xl border border-red-900 bg-red-950/60 p-3 text-sm text-red-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-red-200">
                Could not analyze resume
              </div>
              <div className="mt-1 text-xs text-red-200/80">{analyzeError}</div>
            </div>
            <Button
              type="button"
              onClick={onRetry}
              disabled={!canAnalyze || loading}
              variant="danger"
              size="sm"
            >
              Try again
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
