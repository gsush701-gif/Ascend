import { SatelliteDish } from "lucide-react";
import { card } from "../../lib/ui";

/**
 * The honest "not connected" state for GET /api/jobs/search
 * (`providerConfigured: false` — server/lib/jobProviders/, always true today
 * since no compliant job-listing data provider is configured). Deliberately
 * NOT a generic "no results" empty state: that phrasing would incorrectly
 * imply the search ran and simply didn't match anything, when in fact no
 * search happened against any real listings at all. This appears regardless
 * of what filters were entered.
 */
export function ProviderNotConfiguredBanner() {
  return (
    <div className={`${card} flex flex-col items-center gap-3 py-12 text-center`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/[0.06]">
        <SatelliteDish className="h-6 w-6 text-slate-400" strokeWidth={1.75} />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">Job search isn't connected to a live listings provider yet</h3>
      <p className="max-w-md text-sm text-slate-500">
        Ascend's job search is built and ready, but it has no real job-listing data source wired in right now — so
        it can't return real postings. This isn't a bug and it isn't "no results for your search": no search has
        run against any live listings at all yet. Once a provider is connected, this same search and every filter
        above will work as-is.
      </p>
    </div>
  );
}
