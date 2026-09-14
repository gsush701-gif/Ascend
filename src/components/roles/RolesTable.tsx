import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { DarkSelect } from "../ui/DarkSelect";
import { Tooltip } from "../ui/Tooltip";
import { ProgressCell } from "./ProgressCell";
import { cn } from "../../lib/cn";
import type { TrackerItem, TrackerStatus } from "../../types/tracker";
import { TRACKER_STATUS_ORDER } from "../../types/tracker";

const STATUS_OPTIONS: TrackerStatus[] = TRACKER_STATUS_ORDER;

/**
 * Muted pill styles for status dropdown. Border/background keep a per-status
 * tint; the text color is a single readable slate for every status so the
 * label stays legible on the light table background.
 */
const STATUS_SELECT_STYLES: Record<TrackerStatus, string> = {
  Wishlist: "border-slate-300 bg-slate-900/[0.04] text-slate-700",
  Analyzed: "border-indigo-500/40 bg-indigo-500/20 text-slate-700",
  "Ready to Apply": "border-cyan-400/40 bg-cyan-400/20 text-slate-700",
  Applied: "border-slate-500/40 bg-slate-500/20 text-slate-700",
  "Recruiter Contact": "border-violet-400/40 bg-violet-400/20 text-slate-700",
  Interview: "border-slate-400/40 bg-slate-400/20 text-slate-700",
  "Technical Interview": "border-violet-500/40 bg-violet-500/20 text-slate-700",
  "Final Interview": "border-purple-500/40 bg-purple-500/20 text-slate-700",
  Offer: "border-cyan-500/50 bg-cyan-500/20 text-slate-700",
  Accepted: "border-emerald-500/50 bg-emerald-500/20 text-slate-700",
  Rejected: "border-slate-600/40 bg-slate-600/20 text-slate-700",
  Withdrawn: "border-slate-600/30 bg-slate-600/15 text-slate-700",
};

export type SortKey =
  | "role"
  | "company"
  | "alignment"
  | "status"
  | "conversion"
  | "deadline"
  | "nextStep"
  | "updatedAt"
  | "createdAt";

type RolesTableProps = {
  items: TrackerItem[];
  filteredAndSorted: TrackerItem[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  editingCell: { id: string; field: string } | null;
  onEditingCellChange: (cell: { id: string; field: string } | null) => void;
  onRowClick: (id: string, e: React.MouseEvent) => void;
  onOpenRole: (id: string) => void;
  updateStatus: (id: string, status: TrackerStatus) => void;
  updateNotes: (id: string, notes: string) => void;
  updateRole: (id: string, role: string) => void;
  updateCompany: (id: string, company: string) => void;
};

export function RolesTable({
  items,
  filteredAndSorted,
  sortKey,
  sortDir,
  onSort,
  editingCell,
  onEditingCellChange,
  onRowClick,
  onOpenRole,
  updateStatus,
  updateNotes,
  updateRole,
  updateCompany,
}: RolesTableProps) {
  return (
    <div className="animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-dash-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-[#F4F5FA]/95 backdrop-blur-sm">
            <tr>
              <SortableTh
                label="Role"
                sortKey="role"
                currentSort={sortKey}
                sortDir={sortDir}
                onSort={() => onSort("role")}
                className="min-w-[140px] py-3 pl-4 pr-3"
              />
              <SortableTh
                label="Company"
                sortKey="company"
                currentSort={sortKey}
                sortDir={sortDir}
                onSort={() => onSort("company")}
                className="min-w-[110px] py-3 px-3"
              />
              <SortableTh
                label="Preparedness"
                sortKey="alignment"
                currentSort={sortKey}
                sortDir={sortDir}
                onSort={() => onSort("alignment")}
                className="hidden min-w-[90px] py-3 px-3 md:table-cell"
              />
              <SortableTh
                label="Status"
                sortKey="status"
                currentSort={sortKey}
                sortDir={sortDir}
                onSort={() => onSort("status")}
                className="min-w-[100px] py-3 px-3"
              />
              <th className="min-w-[124px] py-3 px-3 font-medium text-slate-500">
                Actions
              </th>
              <th className="hidden min-w-[120px] py-3 px-3 font-medium text-slate-500 xl:table-cell">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-12 text-center text-sm text-slate-500"
                >
                  {items.length === 0
                    ? "No roles yet. Add your first role to get started."
                    : "No roles match your filters."}
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((item, index) => (
                <tr
                  key={item.id}
                  onClick={(e) => onRowClick(item.id, e)}
                  className={`group cursor-pointer border-b border-slate-200 transition-colors duration-150 hover:bg-slate-900/[0.04] ${
                    index % 2 === 1 ? "bg-white/[0.02]" : ""
                  }`}
                >
                  <RoleCell
                    item={item}
                    editingCell={editingCell}
                    onEditingChange={onEditingCellChange}
                    updateRole={updateRole}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <CompanyCell
                    item={item}
                    editingCell={editingCell}
                    onEditingChange={onEditingCellChange}
                    updateCompany={updateCompany}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <td className="hidden py-2.5 px-3 align-middle md:table-cell">
                    <ProgressCell
                      value={
                        item.reportSnapshot?.alignment ?? item.alignment ?? 0
                      }
                      variant="alignment"
                    />
                  </td>
                  <td
                    className="py-2.5 px-3 align-middle"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex">
                      <DarkSelect
                        value={item.status}
                        onChange={(v) =>
                          updateStatus(item.id, v as TrackerStatus)
                        }
                        options={STATUS_OPTIONS.map((s) => ({
                          value: s,
                          label: s,
                        }))}
                        buttonClassName={`h-8 rounded-md border px-2 py-1 text-xs font-medium ${STATUS_SELECT_STYLES[item.status]}`}
                      />
                    </div>
                  </td>
                  <td className="py-2.5 px-3 align-middle">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRole(item.id);
                      }}
                      className="btn-press inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-900/[0.04] hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1"
                      aria-label={`View actions for ${item.role} at ${item.company}`}
                    >
                      View Actions
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                  <NotesCell
                    item={item}
                    editingCell={editingCell}
                    onEditingChange={onEditingCellChange}
                    updateNotes={updateNotes}
                    onClick={(e) => e.stopPropagation()}
                  />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableTh({
  label,
  sortKey,
  currentSort,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  sortDir: "asc" | "desc";
  onSort: () => void;
  className?: string;
}) {
  const isActive = currentSort === sortKey;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={onSort}
        className="flex items-center gap-1.5 font-medium text-slate-500 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-[#F4F5FA]"
      >
        {label}
        {isActive && (
          <span className="text-slate-400">{sortDir === "asc" ? "↑" : "↓"}</span>
        )}
      </button>
    </th>
  );
}

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-400";

function RoleCell({
  item,
  editingCell,
  onEditingChange,
  updateRole,
  onClick,
}: {
  item: TrackerItem;
  editingCell: { id: string; field: string } | null;
  onEditingChange: (c: { id: string; field: string } | null) => void;
  updateRole: (id: string, role: string) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const editing = editingCell?.id === item.id && editingCell?.field === "role";
  return (
    <td
      className="py-2.5 pl-4 pr-3 align-middle"
      onDoubleClick={() => onEditingChange({ id: item.id, field: "role" })}
    >
      {editing ? (
        <input
          autoFocus
          value={item.role}
          onChange={(e) => updateRole(item.id, e.target.value)}
          onBlur={() => onEditingChange(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEditingChange(null);
          }}
          onClick={onClick}
          className={INPUT_CLASS}
        />
      ) : (
        <span
          className="block max-w-[160px] truncate font-medium text-slate-800"
          title={item.role}
        >
          {item.role}
        </span>
      )}
    </td>
  );
}

function CompanyCell({
  item,
  editingCell,
  onEditingChange,
  updateCompany,
  onClick,
}: {
  item: TrackerItem;
  editingCell: { id: string; field: string } | null;
  onEditingChange: (c: { id: string; field: string } | null) => void;
  updateCompany: (id: string, company: string) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const editing =
    editingCell?.id === item.id && editingCell?.field === "company";
  return (
    <td
      className="py-2.5 px-3 align-middle"
      onDoubleClick={() => onEditingChange({ id: item.id, field: "company" })}
    >
      {editing ? (
        <input
          autoFocus
          value={item.company}
          onChange={(e) => updateCompany(item.id, e.target.value)}
          onBlur={() => onEditingChange(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEditingChange(null);
          }}
          onClick={onClick}
          className={INPUT_CLASS}
        />
      ) : (
        <Link
          to={`/companies/${encodeURIComponent(item.company)}`}
          onClick={(e) => e.stopPropagation()}
          className="block max-w-[120px] truncate text-slate-700 hover:text-cyan-600 hover:underline"
          title={`${item.company} — view your history with this company`}
        >
          {item.company}
        </Link>
      )}
    </td>
  );
}

function NotesCell({
  item,
  editingCell,
  onEditingChange,
  updateNotes,
  onClick,
}: {
  item: TrackerItem;
  editingCell: { id: string; field: string } | null;
  onEditingChange: (c: { id: string; field: string } | null) => void;
  updateNotes: (id: string, notes: string) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const editing =
    editingCell?.id === item.id && editingCell?.field === "notes";
  const notes = item.notes ?? "";
  const display = notes || "Add note";
  const isEmpty = !notes;

  return (
    <td
      className="hidden py-2.5 px-3 align-middle xl:table-cell"
      onDoubleClick={() => onEditingChange({ id: item.id, field: "notes" })}
    >
      {editing ? (
        <textarea
          autoFocus
          value={notes}
          onChange={(e) => updateNotes(item.id, e.target.value)}
          onBlur={() => onEditingChange(null)}
          onClick={onClick}
          placeholder="Notes..."
          rows={2}
          className={`${INPUT_CLASS} max-w-[180px] resize-none placeholder:text-slate-400`}
        />
      ) : (
        <Tooltip content={isEmpty ? "Double-click to add" : notes} disabled={false}>
          <span
            className={cn(
              "block max-w-[160px] truncate transition-colors duration-150",
              isEmpty ? "italic text-slate-400 group-hover:text-slate-500" : "text-slate-500"
            )}
          >
            {display}
          </span>
        </Tooltip>
      )}
    </td>
  );
}
