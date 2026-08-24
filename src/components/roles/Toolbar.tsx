import { Plus, Search, Zap, X } from "lucide-react";
import { Select } from "../ui/Select";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { pageHeader, pageTitle, pageSubtitle, pageHeaderActions } from "../../lib/ui";
import type { TrackerStatus } from "../../types/tracker";
import type { SortKey } from "./RolesTable";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "Wishlist", label: "Wishlist" },
  { value: "Applied", label: "Applied" },
  { value: "Interview", label: "Interview" },
  { value: "Offer", label: "Offer" },
  { value: "Rejected", label: "Rejected" },
];

/** 5 sort presets: key + direction. Max 5 options per user request. */
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "updatedAt:desc", label: "Last updated" },
  { value: "createdAt:desc", label: "Date added" },
  { value: "deadline:asc", label: "Deadline (soonest)" },
  { value: "alignment:desc", label: "Preparedness (highest)" },
  { value: "role:asc", label: "Role (A–Z)" },
];

type ToolbarProps = {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  statusFilter: TrackerStatus | "all";
  onStatusFilterChange: (v: TrackerStatus | "all") => void;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSortChange: (key: SortKey, dir: "asc" | "desc") => void;
  onAddRole: () => void;
  onAnalyze: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  isEmpty?: boolean;
};

export function Toolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortKey,
  sortDir,
  onSortChange,
  onAddRole,
  onAnalyze,
  searchInputRef,
  isEmpty = false,
}: ToolbarProps) {
  return (
    <div className={pageHeader}>
      <div>
        <h1 className={pageTitle}>Roles</h1>
        <p className={pageSubtitle}>
          Capture roles quickly, update status in seconds.
        </p>
      </div>
      <div className={pageHeaderActions}>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={2}
          />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search company, role, notes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full min-w-[160px] max-w-[200px] pl-9 pr-8 sm:w-48"
            autoFocus={isEmpty}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:bg-slate-900/[0.06] hover:text-slate-900"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={`${sortKey}:${sortDir}`}
          onChange={(v) => {
            const raw = v || "updatedAt:desc";
            const [k, d] = raw.split(":") as [SortKey, "asc" | "desc"];
            onSortChange(k, d || "desc");
          }}
          options={SORT_OPTIONS}
          buttonClassName="min-w-[130px]"
        />
        <Select
          value={statusFilter}
          onChange={(v) =>
            onStatusFilterChange(v === "all" ? "all" : (v as TrackerStatus))
          }
          options={STATUS_OPTIONS}
          buttonClassName="min-w-[120px]"
        />
        <Button variant="secondary" onClick={onAnalyze}>
          <Zap className="h-4 w-4" />
          Analyze
        </Button>
        <Button variant="primary" onClick={onAddRole}>
          <Plus className="h-4 w-4" />
          Add role
        </Button>
      </div>
    </div>
  );
}
