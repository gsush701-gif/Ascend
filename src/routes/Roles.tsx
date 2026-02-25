import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { useTracker } from "../features/tracker/hooks/useTracker";
import type { TrackerItem, TrackerStatus, RolePriority } from "../types/tracker";

const STATUS_OPTIONS: TrackerStatus[] = [
  "Wishlist",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
];

const PRIORITY_OPTIONS: (RolePriority | "")[] = ["", "high", "medium", "low"];

type SortKey =
  | "role"
  | "company"
  | "alignment"
  | "status"
  | "deadline"
  | "priority"
  | "nextStep";

const STATUS_STYLES: Record<TrackerStatus, string> = {
  Wishlist: "bg-white/15 text-white/90",
  Applied: "bg-sky-500/25 text-sky-200",
  Interview: "bg-amber-500/25 text-amber-200",
  Offer: "bg-emerald-500/25 text-emerald-200",
  Rejected: "bg-rose-500/20 text-rose-200",
};

export function Roles() {
  const navigate = useNavigate();
  const {
    tracker: items,
    updateStatus,
    updateNextStep,
    updateNotes,
    updateRole,
    updateCompany,
    updateDeadline,
    updatePriority,
  } = useTracker(undefined);

  const [sortKey, setSortKey] = useState<SortKey>("role");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<TrackerStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: string;
  } | null>(null);

  const filteredAndSorted = useMemo(() => {
    let list = items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const match =
          item.role.toLowerCase().includes(q) ||
          item.company.toLowerCase().includes(q) ||
          (item.notes ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "role":
          cmp = a.role.localeCompare(b.role);
          break;
        case "company":
          cmp = a.company.localeCompare(b.company);
          break;
        case "alignment":
          cmp =
            (a.reportSnapshot?.alignment ?? a.alignment) -
            (b.reportSnapshot?.alignment ?? b.alignment);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "deadline":
          cmp = (a.deadline ?? "").localeCompare(b.deadline ?? "");
          break;
        case "priority":
          cmp = (a.priority ?? "").localeCompare(b.priority ?? "");
          break;
        case "nextStep":
          cmp = a.nextStep.localeCompare(b.nextStep);
          break;
        default:
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [items, statusFilter, searchQuery, sortKey, sortDir]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(key);
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }, []);

  const handleRowClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("input") ||
        target.closest("select") ||
        target.closest("textarea") ||
        target.closest("button")
      )
        return;
      navigate(`/roles/${id}`);
    },
    [navigate]
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-white">Roles</h1>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search roles, company, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-w-[180px] max-w-xs rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none sm:w-auto"
            />
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value === "all" ? "all" : (e.target.value as TrackerStatus)
                )
              }
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => navigate("/analyzer")}
              className="btn-press inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              <Plus size={18} />
              Add role
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-white/10 bg-[#07090D]/80 backdrop-blur-xl">
                <tr>
                  <SortableTh
                    label="Role"
                    sortKey="role"
                    currentSort={sortKey}
                    sortDir={sortDir}
                    onSort={() => handleSort("role")}
                    className="w-[18%] py-4 pl-5 pr-3 font-medium text-white/70"
                  />
                  <SortableTh
                    label="Company"
                    sortKey="company"
                    currentSort={sortKey}
                    sortDir={sortDir}
                    onSort={() => handleSort("company")}
                    className="w-[14%] py-4 px-3 font-medium text-white/70"
                  />
                  <SortableTh
                    label="Alignment"
                    sortKey="alignment"
                    currentSort={sortKey}
                    sortDir={sortDir}
                    onSort={() => handleSort("alignment")}
                    className="w-[12%] py-4 px-3 font-medium text-white/70"
                  />
                  <SortableTh
                    label="Status"
                    sortKey="status"
                    currentSort={sortKey}
                    sortDir={sortDir}
                    onSort={() => handleSort("status")}
                    className="w-[14%] py-4 px-3 font-medium text-white/70"
                  />
                  <SortableTh
                    label="Deadline"
                    sortKey="deadline"
                    currentSort={sortKey}
                    sortDir={sortDir}
                    onSort={() => handleSort("deadline")}
                    className="w-[12%] py-4 px-3 font-medium text-white/70"
                  />
                  <SortableTh
                    label="Priority"
                    sortKey="priority"
                    currentSort={sortKey}
                    sortDir={sortDir}
                    onSort={() => handleSort("priority")}
                    className="w-[10%] py-4 px-3 font-medium text-white/70"
                  />
                  <th className="w-[20%] py-4 px-3 font-medium text-white/70">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-16 text-center text-white/50"
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
                      onClick={(e) => handleRowClick(item.id, e)}
                      className={`cursor-pointer border-b border-white/5 transition hover:bg-white/[0.06] hover:shadow-[inset_3px_0_0_0_rgba(255,255,255,0.15)] ${
                        index % 2 === 1 ? "bg-white/[0.02]" : ""
                      }`}
                    >
                      <td
                        className="py-3 pl-5 pr-3 align-middle"
                        onDoubleClick={() =>
                          setEditingCell({ id: item.id, field: "role" })
                        }
                      >
                        {editingCell?.id === item.id &&
                        editingCell?.field === "role" ? (
                          <input
                            autoFocus
                            value={item.role}
                            onChange={(e) =>
                              updateRole(item.id, e.target.value)
                            }
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") setEditingCell(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                          />
                        ) : (
                          <span className="font-medium text-white/90">
                            {item.role}
                          </span>
                        )}
                      </td>
                      <td
                        className="py-3 px-3 align-middle"
                        onDoubleClick={() =>
                          setEditingCell({ id: item.id, field: "company" })
                        }
                      >
                        {editingCell?.id === item.id &&
                        editingCell?.field === "company" ? (
                          <input
                            autoFocus
                            value={item.company}
                            onChange={(e) =>
                              updateCompany(item.id, e.target.value)
                            }
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") setEditingCell(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                          />
                        ) : (
                          <span className="text-white/80">{item.company}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 align-middle">
                        <AlignmentCell
                          value={
                            item.reportSnapshot?.alignment ?? item.alignment
                          }
                        />
                      </td>
                      <td
                        className="py-3 px-3 align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={item.status}
                          onChange={(e) =>
                            updateStatus(
                              item.id,
                              e.target.value as TrackerStatus
                            )
                          }
                          className={`rounded-lg border-0 px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-white/30 ${STATUS_STYLES[item.status]}`}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td
                        className="py-3 px-3 align-middle"
                        onDoubleClick={() =>
                          setEditingCell({ id: item.id, field: "deadline" })
                        }
                      >
                        {editingCell?.id === item.id &&
                        editingCell?.field === "deadline" ? (
                          <input
                            autoFocus
                            value={item.deadline ?? ""}
                            onChange={(e) =>
                              updateDeadline(item.id, e.target.value)
                            }
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") setEditingCell(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="e.g. Feb 15"
                            className="w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/30"
                          />
                        ) : (
                          <span className="text-white/70">
                            {item.deadline || "—"}
                          </span>
                        )}
                      </td>
                      <td
                        className="py-3 px-3 align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={item.priority ?? ""}
                          onChange={(e) =>
                            updatePriority(
                              item.id,
                              e.target.value as RolePriority | ""
                            )
                          }
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80 focus:border-white/20 focus:outline-none"
                        >
                          {PRIORITY_OPTIONS.map((p) => (
                            <option key={p || "none"} value={p}>
                              {p || "—"}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td
                        className="py-3 px-3 align-middle"
                        onDoubleClick={() =>
                          setEditingCell({ id: item.id, field: "notes" })
                        }
                      >
                        {editingCell?.id === item.id &&
                        editingCell?.field === "notes" ? (
                          <textarea
                            autoFocus
                            value={item.notes ?? ""}
                            onChange={(e) =>
                              updateNotes(item.id, e.target.value)
                            }
                            onBlur={() => setEditingCell(null)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Notes..."
                            rows={2}
                            className="w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/30 resize-none"
                          />
                        ) : (
                          <span
                            className="block max-w-[200px] truncate text-white/60"
                            title={item.notes ?? ""}
                          >
                            {item.notes || "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
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
        className="flex items-center gap-1.5 transition hover:text-white"
      >
        {label}
        {isActive && (
          <span className="text-white/50">
            {sortDir === "asc" ? "↑" : "↓"}
          </span>
        )}
      </button>
    </th>
  );
}

function AlignmentCell({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct >= 70
      ? "bg-emerald-500/80"
      : pct >= 50
        ? "bg-amber-500/70"
        : "bg-white/50";

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-white/90">{pct}%</span>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
