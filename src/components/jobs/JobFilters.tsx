import { Search, X } from "lucide-react";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import {
  EMPTY_JOB_SEARCH_FILTERS,
  REMOTE_TYPE_OPTIONS,
  SPONSORSHIP_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  JOB_TYPE_OPTIONS,
  type JobSearchFilters,
} from "../../types/jobs";

/**
 * Full filter bar for the /jobs Search tab — every field the provider
 * interface supports (server/lib/jobProviders/types.js's JobSearchParams),
 * so this UI genuinely works once a real provider is wired in server-side,
 * even though every combination returns nothing today. Layout/interaction
 * pattern (search input with clear button, Select dropdowns, primary action
 * button) adapted from src/components/roles/Toolbar.tsx, this app's existing
 * filter-bar convention.
 */
type JobFiltersProps = {
  filters: JobSearchFilters;
  onChange: (filters: JobSearchFilters) => void;
  onSearch: () => void;
  loading?: boolean;
};

const withAny = (options: string[]) => [{ value: "", label: "Any" }, ...options.map((o) => ({ value: o, label: o }))];

export function JobFilters({ filters, onChange, onSearch, loading = false }: JobFiltersProps) {
  function set<K extends keyof JobSearchFilters>(key: K, value: JobSearchFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch();
  }

  const hasAnyFilter = JSON.stringify(filters) !== JSON.stringify(EMPTY_JOB_SEARCH_FILTERS);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={2}
          />
          <Input
            type="text"
            placeholder="Title, keywords, or skills…"
            value={filters.keywords}
            onChange={(e) => set("keywords", e.target.value)}
            className="w-full pl-9"
          />
        </div>
        <Input
          type="text"
          placeholder="Location"
          value={filters.location}
          onChange={(e) => set("location", e.target.value)}
          className="w-40"
        />
        <Select
          value={filters.remoteType}
          onChange={(v) => set("remoteType", v)}
          options={withAny(REMOTE_TYPE_OPTIONS)}
          placeholder="Remote type"
          buttonClassName="min-w-[130px]"
        />
        <Button type="submit" variant="primary" disabled={loading}>
          <Search className="h-4 w-4" />
          {loading ? "Searching…" : "Search"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          placeholder="Salary min"
          value={filters.salaryMin}
          onChange={(e) => set("salaryMin", e.target.value)}
          className="w-32"
          min={0}
        />
        <Input
          type="number"
          placeholder="Salary max"
          value={filters.salaryMax}
          onChange={(e) => set("salaryMax", e.target.value)}
          className="w-32"
          min={0}
        />
        <Select
          value={filters.sponsorship}
          onChange={(v) => set("sponsorship", v)}
          options={withAny(SPONSORSHIP_OPTIONS)}
          placeholder="Sponsorship"
          buttonClassName="min-w-[130px]"
        />
        <Select
          value={filters.experienceLevel}
          onChange={(v) => set("experienceLevel", v)}
          options={withAny(EXPERIENCE_LEVEL_OPTIONS)}
          placeholder="Experience level"
          buttonClassName="min-w-[150px]"
        />
        <Select
          value={filters.jobType}
          onChange={(v) => set("jobType", v)}
          options={withAny(JOB_TYPE_OPTIONS)}
          placeholder="Job type"
          buttonClassName="min-w-[130px]"
        />
        <Input
          type="text"
          placeholder="Company"
          value={filters.company}
          onChange={(e) => set("company", e.target.value)}
          className="w-40"
        />
        <Input
          type="text"
          placeholder="Skills (comma-separated)"
          value={filters.skills}
          onChange={(e) => set("skills", e.target.value)}
          className="w-56"
        />
        {hasAnyFilter && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_JOB_SEARCH_FILTERS)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-900/[0.06] hover:text-slate-900"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
      </div>
    </form>
  );
}
