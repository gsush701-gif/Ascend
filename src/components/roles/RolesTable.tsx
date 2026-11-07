import { ChevronRight } from "lucide-react";
import { DarkSelect } from "../ui/DarkSelect";
import { ProgressCell } from "./ProgressCell";
import { cn } from "../../lib/cn";
import { parseDeadline } from "../../lib/dates";
import { STATUS_SELECT_STYLES } from "../../lib/ui";
import type { TrackerItem, TrackerStatus } from "../../types/tracker";
import { TRACKER_STATUS_ORDER } from "../../types/tracker";

const STATUS_OPTIONS: TrackerStatus[] = TRACKER_STATUS_ORDER;

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
  updateRole,
  updateCompany,
}: RolesTableProps) {
  return (
    <div className="animate-fade-in overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70">
            <tr>
              <SortableTh
                label="Role"
                sortKey="role"
                currentSort={sortKey}
                sortDir={sortDir}
                onSort={() => onSort("role")}
                className="min-w-[140px] py-3 pl-5 pr-3"
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
              <th className="min-w-[90px] py-3 px-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Actions
              </th>
              <th className="hidden min-w-[110px] py-3 px-3 text-xs font-medium uppercase tracking-wide text-slate-500 lg:table-cell">
                Deadline
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
              filteredAndSorted.map((item) => (
                <tr
                  key={item.id}
                  onClick={(e) => onRowClick(item.id, e)}
                  className="group cursor-pointer border-b border-slate-100 transition-colors duration-150 last:border-0 hover:bg-slate-50"
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
                  <td className="hidden py-3.5 px-3 align-middle md:table-cell">
                    {(item.reportSnapshot?.alignment ?? item.alignment ?? 0) > 0 ? (
                      <ProgressCell
                        value={item.reportSnapshot?.alignment ?? item.alignment ?? 0}
                        variant="alignment"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">Not analyzed</span>
                    )}
                  </td>
                  <td
                    className="py-3.5 px-3 align-middle"
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
                  <td className="py-3.5 px-3 align-middle">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRole(item.id);
                      }}
                      className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      aria-label={`View actions for ${item.role} at ${item.company}`}
                    >
                      Open
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                  <DeadlineCell item={item} />
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
        className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-white"
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
      className="py-3.5 pl-5 pr-3 align-middle"
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
          className="block max-w-[260px] truncate font-medium text-slate-900"
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
      className="py-3.5 px-3 align-middle"
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
        <span
          className="block max-w-[180px] truncate text-slate-600"
          title={item.company}
        >
          {item.company}
        </span>
      )}
    </td>
  );
}

/** Free-text `deadline` field (see types/tracker.ts) — read-only here.
 * Clicking anywhere on the row (this cell included — nothing here stops
 * that click) opens the role's detail sidebar, which is the one place
 * it's actually set (RoleDetailDrawer.tsx), one click to open + pick.
 * Same field Dashboard's "Upcoming deadlines" and "Overdue" pill already
 * read (src/lib/dashboardStats.ts's getUpcomingDeadlines), so a deadline
 * set there shows up here too. */
function DeadlineCell({ item }: { item: TrackerItem }) {
  const parsed = parseDeadline(item.deadline);
  const isValidDate = parsed != null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = isValidDate && parsed.getTime() < today.getTime();

  return (
    <td className="hidden py-3.5 px-3 align-middle lg:table-cell">
      {isValidDate ? (
        <span
          className={cn(
            "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
            isOverdue ? "bg-rose-50 text-rose-700" : "text-slate-600",
          )}
        >
          {parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          {isOverdue ? " · Overdue" : ""}
        </span>
      ) : (
        <>
          <span className="text-xs text-slate-300 group-hover:hidden">—</span>
          <span className="hidden text-xs text-slate-500 group-hover:inline">Add deadline</span>
        </>
      )}
    </td>
  );
}
