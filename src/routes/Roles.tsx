import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "../lib/cn";
import { AppShell } from "../components/layout/AppShell";
import { QuickAddModal } from "../components/QuickAddModal";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { getRecentCompanies, getRecentRoles } from "../lib/dashboardStats";
import type { TrackerStatus } from "../types/tracker";
import { Toolbar } from "../components/roles/Toolbar";
import {
  RolesTable,
  type SortKey,
} from "../components/roles/RolesTable";
import { RolesTableSkeleton } from "../components/roles/RolesTableSkeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { RoleDetailDrawer } from "../components/roles/RoleDetailDrawer";
import { toast } from "../components/ui/toast";

const CONVERSION_PCT: Record<TrackerStatus, number> = {
  Wishlist: 0,
  Applied: 25,
  Interview: 50,
  Offer: 100,
  Rejected: 0,
};

export function Roles() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    tracker: items,
    addManualTrackerItem,
    updateStatus,
    updateNotes,
    updateNextStep,
    updateRole,
    updateCompany,
    updateDeadline,
    updateCoverLetter,
    removeItem,
  } = useTracker(undefined);

  const [sortKey, setSortKey] = useState<SortKey>(() => {
    try {
      const v = localStorage.getItem("internos_roles_sort");
      if (v) {
        const [k] = v.split(":");
        if (k && ["updatedAt","createdAt","deadline","alignment","role","company","status"].includes(k))
          return k as SortKey;
      }
    } catch {}
    return "updatedAt";
  });
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() => {
    try {
      const v = localStorage.getItem("internos_roles_sort");
      if (v && v.endsWith(":asc")) return "asc";
    } catch {}
    return "desc";
  });
  const [statusFilter, setStatusFilter] = useState<TrackerStatus | "all">(() => {
    try {
      const v = localStorage.getItem("internos_roles_status_filter");
      if (v && (v === "all" || ["Wishlist","Applied","Interview","Offer","Rejected"].includes(v)))
        return v as TrackerStatus | "all";
    } catch {}
    return "all";
  });
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: string;
  } | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showExample, setShowExample] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  useEffect(() => {
    const state = location.state as { openRoleId?: string } | null;
    if (state?.openRoleId && items.some((i) => i.id === state.openRoleId)) {
      setSelectedRoleId(state.openRoleId);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, items, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("internos_roles_status_filter", statusFilter);
      localStorage.setItem("internos_roles_sort", `${sortKey}:${sortDir}`);
    } catch {}
  }, [statusFilter, sortKey, sortDir]);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleQuickAdd = useCallback(
    (company: string, role: string) => {
      addManualTrackerItem(
        () => {},
        undefined,
        { company, role, status: "Applied", nextStep: "Applied" }
      );
      setQuickAddOpen(false);
      toast.success({
        title: "Role added",
        description: `${role} at ${company}`,
      });
    },
    [addManualTrackerItem]
  );

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
        case "conversion":
          cmp =
            (CONVERSION_PCT[a.status] ?? 0) - (CONVERSION_PCT[b.status] ?? 0);
          break;
        case "deadline":
          cmp = (a.deadline ?? "").localeCompare(b.deadline ?? "");
          break;
        case "nextStep":
          cmp = a.nextStep.localeCompare(b.nextStep);
          break;
        case "updatedAt":
          cmp =
            new Date(a.updatedAt ?? a.createdAt).getTime() -
            new Date(b.updatedAt ?? b.createdAt).getTime();
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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
        target.closest("button") ||
        target.closest("textarea") ||
        target.closest("select")
      )
        return;
      setSelectedRoleId(id);
    },
    []
  );

  const selectedItem = selectedRoleId
    ? items.find((i) => i.id === selectedRoleId)
    : null;

  const wrappedUpdateStatus = useCallback(
    (id: string, status: TrackerStatus) => {
      updateStatus(id, status);
      toast.success({
        title: "Status updated",
        groupId: "status-update",
      });
    },
    [updateStatus]
  );

  const notesToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (notesToastTimeoutRef.current) clearTimeout(notesToastTimeoutRef.current);
    },
    []
  );
  const wrappedUpdateNotes = useCallback(
    (id: string, notes: string) => {
      updateNotes(id, notes);
      if (notesToastTimeoutRef.current) clearTimeout(notesToastTimeoutRef.current);
      notesToastTimeoutRef.current = setTimeout(() => {
        notesToastTimeoutRef.current = null;
        toast.success({ title: "Note saved", groupId: "notes-update" });
      }, 600);
    },
    [updateNotes]
  );

  return (
    <AppShell>
      {selectedItem && (
        <RoleDetailDrawer
          item={selectedItem}
          onClose={() => setSelectedRoleId(null)}
          updateStatus={wrappedUpdateStatus}
          updateNextStep={updateNextStep}
          updateNotes={wrappedUpdateNotes}
          updateDeadline={updateDeadline}
          updateCoverLetter={updateCoverLetter}
          removeItem={removeItem}
        />
      )}
      <QuickAddModal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onAdd={handleQuickAdd}
        recentCompanies={getRecentCompanies(items)}
        recentRoles={getRecentRoles(items)}
      />
      <div
        className={cn(
          "space-y-6 transition-[padding] duration-200 ease-out",
          selectedItem && "pr-[400px]"
        )}
      >
        {!loading && (
          <Toolbar
            searchQuery={searchInput}
            onSearchChange={setSearchInput}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortChange={(k, d) => {
              setSortKey(k);
              setSortDir(d);
            }}
            onAddRole={() => setQuickAddOpen(true)}
            onAnalyze={() => navigate("/analyzer")}
            isEmpty={items.length === 0}
          />
        )}
        {loading ? (
          <RolesTableSkeleton />
        ) : items.length === 0 && !showExample ? (
          <EmptyState
            title="Add your first role"
            subtitle="Track applications, status, and follow-ups in one place."
            bullets={[
              "Track status",
              "See preparedness",
              "Stay on top of next steps",
            ]}
            primaryAction={{
              label: "Add role",
              onClick: () => setQuickAddOpen(true),
            }}
            secondaryAction={{
              label: "Analyze a role",
              onClick: () => navigate("/analyzer"),
            }}
            tertiaryAction={{
              label: "See example",
              onClick: () => setShowExample(true),
            }}
          />
        ) : items.length === 0 && showExample ? (
          <div className="animate-fade-in rounded-xl border border-slate-200 bg-dash-card p-6 shadow-sm">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              Example row (not saved)
            </p>
            <div className="flex flex-wrap items-center gap-6 rounded-lg border border-slate-200 bg-dash-surface p-4">
              <div>
                <div className="text-[10px] uppercase text-slate-500">Role</div>
                <div className="text-sm font-medium text-slate-900">SWE Intern</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-500">Company</div>
                <div className="text-sm text-slate-700">Acme Corp</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-500">Preparedness</div>
                <div className="text-sm text-slate-700">High</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-500">Status</div>
                <span className="inline-flex rounded-md border border-cyan-500/50 bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-700">
                  Interview
                </span>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setQuickAddOpen(true)}
                className="btn-press inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-500 px-4 text-sm font-medium text-black transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-[#F4F5FA]"
              >
                Add role
              </button>
              <button
                type="button"
                onClick={() => setShowExample(false)}
                className="btn-press inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-transparent px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-900/[0.04] focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 focus:ring-offset-[#F4F5FA]"
              >
                Close example
              </button>
            </div>
          </div>
        ) : (
        <RolesTable
          items={items}
          filteredAndSorted={filteredAndSorted}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          editingCell={editingCell}
          onEditingCellChange={setEditingCell}
          onRowClick={handleRowClick}
          updateStatus={wrappedUpdateStatus}
          updateNotes={wrappedUpdateNotes}
          updateRole={updateRole}
          updateCompany={updateCompany}
          updateDeadline={updateDeadline}
        />
        )}
      </div>
    </AppShell>
  );
}
