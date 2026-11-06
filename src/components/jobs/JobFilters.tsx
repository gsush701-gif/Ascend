import { Search, X } from "lucide-react";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";
import { EMPTY_JOB_SEARCH_FILTERS, REMOTE_TYPE_OPTIONS, type JobSearchFilters } from "../../types/jobs";

/**
 * Filter bar for the /jobs Search tab. It offers only what the job feed can
 * filter on: words, place, level, work style, company and skills. (The feed's
 * postings carry no salary or visa-sponsorship data, so those filters are not
 * offered.) Picking a level or work style searches straight away; the text
 * fields search when the form is submitted.
 */
type JobFiltersProps = {
  filters: JobSearchFilters;
  onChange: (filters: JobSearchFilters) => void;
  /** Called with the new filters when a chip or select changed them, so the search uses them at once. */
  onSearch: (filters?: JobSearchFilters) => void;
  loading?: boolean;
};

const LEVELS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "Internship", label: "Internships" },
  { value: "Entry", label: "New grad" },
];

const workStyleOptions = [{ value: "", label: "Any work style" }, ...REMOTE_TYPE_OPTIONS.map((o) => ({ value: o, label: o }))];

export function JobFilters({ filters, onChange, onSearch, loading = false }: JobFiltersProps) {
  function set<K extends keyof JobSearchFilters>(key: K, value: JobSearchFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  /** A chip or select: update the filters and search with the new values straight away. */
  function setAndSearch<K extends keyof JobSearchFilters>(key: K, value: JobSearchFilters[K]) {
    const next = { ...filters, [key]: value };
    onChange(next);
    onSearch(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch();
  }

  const hasAnyFilter = JSON.stringify(filters) !== JSON.stringify(EMPTY_JOB_SEARCH_FILTERS);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <Input
            type="text"
            placeholder="Job title, keywords or skills"
            value={filters.keywords}
            onChange={(e) => set("keywords", e.target.value)}
            className="w-full pl-9"
          />
        </div>
        {/* Width goes on a wrapper: the shared Input is always full width. */}
        <div className="sm:w-48">
          <Input
            type="text"
            placeholder="City or state"
            value={filters.location}
            onChange={(e) => set("location", e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" disabled={loading} className="sm:w-28">
          {loading ? "Searching…" : "Search"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Level">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setAndSearch("experienceLevel", l.value)}
              aria-pressed={filters.experienceLevel === l.value}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition",
                filters.experienceLevel === l.value
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-900/[0.05]",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        <Select
          value={filters.remoteType}
          onChange={(v) => setAndSearch("remoteType", v)}
          options={workStyleOptions}
          placeholder="Work style"
          buttonClassName="min-w-[150px]"
        />
        <div className="w-full sm:w-40">
          <Input
            type="text"
            placeholder="Company"
            value={filters.company}
            onChange={(e) => set("company", e.target.value)}
          />
        </div>
        <div className="w-full sm:w-56">
          <Input
            type="text"
            placeholder="Skills, comma-separated"
            value={filters.skills}
            onChange={(e) => set("skills", e.target.value)}
          />
        </div>
        {hasAnyFilter && (
          <button
            type="button"
            onClick={() => {
              onChange(EMPTY_JOB_SEARCH_FILTERS);
              onSearch(EMPTY_JOB_SEARCH_FILTERS);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-900/[0.06] hover:text-slate-900"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
