import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { EmptyState } from "../components/ui/EmptyState";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { getCompanyList, getCompanyDetail } from "../features/companies/stats";
import { pageHeader, pageTitle, pageSubtitle, card } from "../lib/ui";

/**
 * "Your history with this company" — deliberately not a company database.
 * Shows only the user's own real aggregated data across their own tracked
 * roles at a company: how many they've tracked, average fit score, current
 * statuses, and notes. No fabricated "company overview", tech stack, or
 * interview-process info — there's no trustworthy third-party data source
 * wired up for that, and inventing it would violate the anti-fabrication
 * principle this product is built around.
 */
export function Companies() {
  const { companyName } = useParams<{ companyName?: string }>();
  const navigate = useNavigate();
  const { tracker: items } = useTracker(undefined);

  const decodedCompany = companyName ? decodeURIComponent(companyName) : null;

  const companyList = useMemo(() => getCompanyList(items), [items]);
  const detail = useMemo(
    () => (decodedCompany ? getCompanyDetail(items, decodedCompany) : null),
    [items, decodedCompany]
  );

  if (decodedCompany) {
    return (
      <AppShell>
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => navigate("/companies")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            All companies
          </button>

          <header className={pageHeader}>
            <div>
              <h1 className={pageTitle}>{detail?.company ?? decodedCompany}</h1>
              <p className={pageSubtitle}>
                Your history with this company — not a company database. Everything below comes
                only from roles you've tracked yourself.
              </p>
            </div>
          </header>

          {!detail ? (
            <EmptyState
              title="No tracked roles at this company yet"
              subtitle="Track a role at this company to start building your history here."
              primaryAction={{ label: "Go to Roles", onClick: () => navigate("/roles") }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Panel title="Summary" subtitle="Your own aggregate data at this company.">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <span className="text-slate-500">Roles tracked </span>
                    <span className="font-semibold text-slate-900">{detail.count}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Average fit score </span>
                    <span className="font-semibold text-slate-900">
                      {detail.avgAlignment != null ? `${detail.avgAlignment}%` : "Not analyzed yet"}
                    </span>
                  </div>
                </div>
              </Panel>

              <Panel title="Current statuses" subtitle="Where each of your roles here stands.">
                <ul className="space-y-1.5 text-sm">
                  {detail.statusCounts.map((s) => (
                    <li key={s.status} className="flex items-center justify-between text-slate-600">
                      <span>{s.status}</span>
                      <span className="font-medium text-slate-900">{s.count}</span>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel
                title="Your tracked roles here"
                subtitle="Click through to see full details and notes for each."
              >
                <div className="space-y-2">
                  {detail.roles.map((r) => (
                    <Link
                      key={r.id}
                      to={`/roles/${r.id}`}
                      className="block rounded-xl border border-slate-200 bg-slate-900/[0.02] px-4 py-3 text-sm transition hover:bg-slate-900/[0.05]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-900">{r.role}</span>
                        <span className="shrink-0 text-xs text-slate-500">{r.status}</span>
                      </div>
                      {r.notes && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{r.notes}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </Panel>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className={pageHeader}>
          <div>
            <h1 className={pageTitle}>Companies</h1>
            <p className={pageSubtitle}>
              Your history with the companies you've tracked roles at — not a company database.
            </p>
          </div>
        </header>

        {companyList.length === 0 ? (
          <EmptyState
            title="No companies tracked yet"
            subtitle="Once you track roles, this page groups them by company so you can see your own history at a glance."
            primaryAction={{ label: "Go to Roles", onClick: () => navigate("/roles") }}
          />
        ) : (
          <div className={`${card} divide-y divide-slate-200 p-0`}>
            {companyList.map((c) => (
              <Link
                key={c.company}
                to={`/companies/${encodeURIComponent(c.company)}`}
                className="flex items-center justify-between px-5 py-3.5 text-sm transition hover:bg-slate-900/[0.03]"
              >
                <span className="font-medium text-slate-900">{c.company}</span>
                <span className="flex items-center gap-4 text-slate-500">
                  <span>
                    {c.count} role{c.count !== 1 ? "s" : ""}
                  </span>
                  <span>{c.avgAlignment != null ? `${c.avgAlignment}% avg fit` : "Not analyzed"}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
