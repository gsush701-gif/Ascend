import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { AdminTable } from "../components/admin/AdminTable";
import { useAuth } from "../context/AuthContext";
import { pageHeader, pageTitle, pageSubtitle, card, sectionTitle } from "../lib/ui";
import {
  AdminApiError,
  fetchAdminOverview,
  fetchAdminApplications,
  fetchAdminAiUsage,
  fetchAdminBilling,
  fetchAdminSystem,
  type AdminOverview,
  type AdminApplications,
  type AdminAiUsage,
  type AdminBilling,
  type AdminSystem,
} from "../features/admin/api";

const PAGE_SIZE = 10;

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtNumber(n: number) {
  return n.toLocaleString();
}

function shortId(id: string | null | undefined) {
  if (!id) return "—";
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

type AuthState = "checking" | "unauthenticated" | "forbidden" | "error" | "ready";

/** Simple {value: count} breakdown rendered as a row of badges. */
function CountBadges({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return <span className="text-sm text-slate-500">No data yet.</span>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {entries
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => (
          <Badge key={key}>
            {key}: {fmtNumber(count)}
          </Badge>
        ))}
    </div>
  );
}

export function Admin() {
  const { session, loading: authLoading } = useAuth();
  const accessToken = session?.access_token;

  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const [applications, setApplications] = useState<AdminApplications | null>(null);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsPage, setApplicationsPage] = useState(1);

  const [aiUsage, setAiUsage] = useState<AdminAiUsage | null>(null);
  const [aiUsageLoading, setAiUsageLoading] = useState(true);

  const [billing, setBilling] = useState<AdminBilling | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingPage, setBillingPage] = useState(1);

  const [system, setSystem] = useState<AdminSystem | null>(null);
  const [systemLoading, setSystemLoading] = useState(true);
  const [systemPage, setSystemPage] = useState(1);

  // The real authorization check: GET /api/admin/overview either succeeds
  // (this user is in ADMIN_EMAILS) or 401/403s (server/middleware/
  // requireAdmin.js). Every other section below only ever fetches once this
  // has succeeded, since a 403 here means every other /api/admin/* route
  // will 403 identically.
  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      setAuthState("unauthenticated");
      return;
    }
    let cancelled = false;
    setOverviewLoading(true);
    fetchAdminOverview(accessToken)
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        setAuthState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof AdminApiError && err.status === 401) {
          setAuthState("unauthenticated");
        } else if (err instanceof AdminApiError && err.status === 403) {
          setAuthState("forbidden");
        } else {
          setAuthState("error");
          setAuthErrorMessage(err instanceof Error ? err.message : "Failed to load admin data");
        }
      })
      .finally(() => {
        if (!cancelled) setOverviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, accessToken]);

  const loadApplications = useCallback(
    (page: number) => {
      if (!accessToken) return;
      setApplicationsLoading(true);
      fetchAdminApplications(accessToken, page, PAGE_SIZE)
        .then(setApplications)
        .catch(() => {
          /* section-level failures are shown per-panel, not fatal to the page */
        })
        .finally(() => setApplicationsLoading(false));
    },
    [accessToken],
  );

  const loadBilling = useCallback(
    (page: number) => {
      if (!accessToken) return;
      setBillingLoading(true);
      fetchAdminBilling(accessToken, page, PAGE_SIZE)
        .then(setBilling)
        .catch(() => {})
        .finally(() => setBillingLoading(false));
    },
    [accessToken],
  );

  const loadSystem = useCallback(
    (page: number) => {
      if (!accessToken) return;
      setSystemLoading(true);
      fetchAdminSystem(accessToken, page, PAGE_SIZE)
        .then(setSystem)
        .catch(() => {})
        .finally(() => setSystemLoading(false));
    },
    [accessToken],
  );

  useEffect(() => {
    if (authState !== "ready" || !accessToken) return;
    loadApplications(1);
    loadBilling(1);
    loadSystem(1);
    setAiUsageLoading(true);
    fetchAdminAiUsage(accessToken)
      .then(setAiUsage)
      .catch(() => {})
      .finally(() => setAiUsageLoading(false));
    // Only re-run when we first become "ready" for this session's token —
    // per-section pagination is handled by the page-change handlers below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, accessToken]);

  function handleApplicationsPageChange(page: number) {
    setApplicationsPage(page);
    loadApplications(page);
  }
  function handleBillingPageChange(page: number) {
    setBillingPage(page);
    loadBilling(page);
  }
  function handleSystemPageChange(page: number) {
    setSystemPage(page);
    loadSystem(page);
  }

  if (authState === "checking" || authLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <AppShell>
        <div className={`mx-auto max-w-md space-y-3 p-10 text-center ${card}`}>
          <h1 className="text-xl font-semibold text-slate-900">Login required</h1>
          <p className="text-sm text-slate-500">Sign in to continue.</p>
        </div>
      </AppShell>
    );
  }

  if (authState === "forbidden") {
    return (
      <AppShell>
        <div className={`mx-auto max-w-md space-y-3 p-10 text-center ${card}`}>
          <ShieldAlert className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="text-xl font-semibold text-slate-900">Not authorized</h1>
          <p className="text-sm text-slate-500">
            Your account doesn&apos;t have access to the admin dashboard.
          </p>
        </div>
      </AppShell>
    );
  }

  if (authState === "error") {
    return (
      <AppShell>
        <div className={`mx-auto max-w-md space-y-3 p-10 text-center ${card}`}>
          <h1 className="text-xl font-semibold text-slate-900">Couldn&apos;t load admin data</h1>
          <p className="text-sm text-slate-500">{authErrorMessage || "Please try again."}</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className={pageHeader}>
          <div>
            <h1 className={pageTitle}>Admin</h1>
            <p className={pageSubtitle}>Internal dashboard — users, applications, AI usage, billing, and system health.</p>
          </div>
        </header>

        {/* --- Users --- */}
        <Panel title="Users" subtitle="Account and engagement overview.">
          {overviewLoading || !overview ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total users" value={fmtNumber(overview.totalUsers)} />
                <StatCard
                  label="Active users"
                  value={fmtNumber(overview.activeUsers)}
                  hint={`Had at least one usage event in the last ${overview.activeUserWindowDays} days`}
                />
              </div>
              <div>
                <div className={`mb-2 ${sectionTitle}`}>Subscriptions by plan</div>
                <CountBadges counts={overview.subscriptions.byPlan} />
              </div>
              <div>
                <div className={`mb-2 ${sectionTitle}`}>Subscriptions by status</div>
                <CountBadges counts={overview.subscriptions.byStatus} />
                <p className="mt-1 text-xs text-slate-500">
                  Users with no subscription row are implicitly on the free plan and aren&apos;t counted
                  above ({overview.subscriptions.totalRowsWithSubscription.toLocaleString()} explicit
                  subscription rows total).
                </p>
              </div>
              <div>
                <div className={`mb-2 ${sectionTitle}`}>Recent signups</div>
                {overview.recentSignups.length === 0 ? (
                  <p className="text-sm text-slate-500">No signups yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {overview.recentSignups.map((u) => (
                      <li key={u.id} className="flex items-center justify-between py-1.5">
                        <span className="text-slate-700">{u.email || shortId(u.id)}</span>
                        <span className="text-xs text-slate-500">{fmtDateTime(u.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Panel>

        {/* --- Applications --- */}
        <Panel title="Applications" subtitle="Rows in the roles/application tracker across all users.">
          {applicationsLoading && !applications ? (
            <Skeleton className="h-40" />
          ) : !applications ? (
            <p className="text-sm text-slate-500">Couldn&apos;t load application data.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total applications" value={fmtNumber(applications.total)} />
              </div>
              <div>
                <div className={`mb-2 ${sectionTitle}`}>By status</div>
                <CountBadges counts={applications.byStatus} />
              </div>
              <AdminTable
                rowKey={(r) => r.id}
                page={applicationsPage}
                total={applications.recent.total}
                totalPages={applications.recent.totalPages}
                loading={applicationsLoading}
                onPageChange={handleApplicationsPageChange}
                emptyMessage="No applications yet."
                rows={applications.recent.items}
                columns={[
                  { header: "Company", render: (r) => r.company },
                  { header: "Role", render: (r) => r.role },
                  { header: "Status", render: (r) => <Badge>{r.status}</Badge> },
                  { header: "Alignment", render: (r) => `${r.alignment}%` },
                  { header: "User", render: (r) => shortId(r.user_id) },
                  { header: "Created", render: (r) => fmtDate(r.created_at) },
                ]}
              />
            </div>
          )}
        </Panel>

        {/* --- AI Usage --- */}
        <Panel title="AI usage" subtitle="Metered ai.* usage_events, last 30 days.">
          {aiUsageLoading && !aiUsage ? (
            <Skeleton className="h-40" />
          ) : !aiUsage ? (
            <p className="text-sm text-slate-500">Couldn&apos;t load AI usage data.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total AI requests" value={fmtNumber(aiUsage.totalAiRequests)} hint={`Last ${aiUsage.windowDays} days`} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-4">Event type</th>
                      <th className="py-2 pr-4">Requests</th>
                      <th className="py-2 pr-4">Success</th>
                      <th className="py-2 pr-4">Failures</th>
                      <th className="py-2 pr-4">Error rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(aiUsage.byEventType)
                      .sort((a, b) => b[1].requestCount - a[1].requestCount)
                      .map(([type, stat]) => (
                        <tr key={type} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 pr-4 text-slate-700">{type}</td>
                          <td className="py-2 pr-4 text-slate-700">{fmtNumber(stat.requestCount)}</td>
                          <td className="py-2 pr-4 text-slate-700">{fmtNumber(stat.successCount)}</td>
                          <td className="py-2 pr-4 text-slate-700">{fmtNumber(stat.failureCount)}</td>
                          <td className="py-2 pr-4 text-slate-700">
                            {type === "ai.ats_check" ? (
                              <span title={aiUsage.errorRateReliable.note}>not tracked*</span>
                            ) : stat.errorRatePct === null ? (
                              "—"
                            ) : (
                              `${stat.errorRatePct}%`
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">* {aiUsage.errorRateReliable.note}</p>
              <div>
                <div className={`mb-2 ${sectionTitle}`}>Top users by request count</div>
                {aiUsage.topUsers.length === 0 ? (
                  <p className="text-sm text-slate-500">No AI usage yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {aiUsage.topUsers.map((u) => (
                      <li key={u.userId} className="flex items-center justify-between py-1.5">
                        <span className="text-slate-700">{u.email || shortId(u.userId)}</span>
                        <span className="text-xs text-slate-500">{fmtNumber(u.requestCount)} requests</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Panel>

        {/* --- Billing --- */}
        <Panel
          title="Billing"
          subtitle="From the subscriptions table (webhook-synced Stripe state) — not a live Stripe API call."
        >
          {billingLoading && !billing ? (
            <Skeleton className="h-40" />
          ) : !billing ? (
            <p className="text-sm text-slate-500">Couldn&apos;t load billing data.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className={`mb-2 ${sectionTitle}`}>Active subscriptions by plan</div>
                <CountBadges counts={billing.activeByPlan} />
              </div>
              <div>
                <div className={`mb-2 ${sectionTitle}`}>All rows by plan + status</div>
                <CountBadges counts={billing.byPlanStatus} />
              </div>
              <AdminTable
                rowKey={(r) => r.id}
                page={billingPage}
                total={billing.recent.total}
                totalPages={billing.recent.totalPages}
                loading={billingLoading}
                onPageChange={handleBillingPageChange}
                emptyMessage="No subscription rows yet."
                rows={billing.recent.items}
                columns={[
                  { header: "User", render: (r) => shortId(r.user_id) },
                  { header: "Plan", render: (r) => <Badge variant="primary">{r.plan}</Badge> },
                  { header: "Status", render: (r) => <Badge>{r.status}</Badge> },
                  { header: "Period end", render: (r) => fmtDate(r.current_period_end) },
                  { header: "Updated", render: (r) => fmtDate(r.updated_at) },
                ]}
              />
            </div>
          )}
        </Panel>

        {/* --- System / Errors --- */}
        <Panel title="System" subtitle="Recent server errors (5xx responses only).">
          {systemLoading && !system ? (
            <Skeleton className="h-40" />
          ) : !system ? (
            <p className="text-sm text-slate-500">Couldn&apos;t load system data.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Errors (24h)" value={fmtNumber(system.errorsLast24h)} />
                <StatCard label="Errors (7d)" value={fmtNumber(system.errorsLast7d)} />
                <StatCard
                  label="Sentry"
                  value={system.sentryConfigured ? "Configured" : "Not configured"}
                  hint={
                    system.sentryConfigured
                      ? "Complementary source for full stack traces."
                      : "Set SENTRY_DSN to enable (server/.env.example)."
                  }
                />
              </div>
              {system.topRoutes7d.length > 0 && (
                <div>
                  <div className={`mb-2 ${sectionTitle}`}>Top error routes (7d)</div>
                  <div className="flex flex-wrap gap-2">
                    {system.topRoutes7d.map((r) => (
                      <Badge key={r.key}>
                        {r.key}: {r.count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <AdminTable
                rowKey={(r) => r.id}
                page={systemPage}
                total={system.recent.total}
                totalPages={system.recent.totalPages}
                loading={systemLoading}
                onPageChange={handleSystemPageChange}
                emptyMessage="No errors logged yet."
                rows={system.recent.items}
                columns={[
                  { header: "Time", render: (r) => fmtDateTime(r.created_at) },
                  { header: "Status", render: (r) => r.status_code },
                  { header: "Code", render: (r) => r.error_code || "—" },
                  { header: "Route", render: (r) => r.route || "—" },
                  { header: "Message", render: (r) => <span className="line-clamp-2 max-w-xs">{r.message || "—"}</span> },
                ]}
              />
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
