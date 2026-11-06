import { SatelliteDish } from "lucide-react";
import { card } from "../../lib/ui";

/**
 * Shown when GET /api/jobs/search reports `providerConfigured: false`: job
 * search is switched off, or the listings database could not be reached. It is
 * deliberately NOT a generic "no results" state, which would wrongly suggest the
 * search ran and found nothing.
 */
export function ProviderNotConfiguredBanner() {
  return (
    <div className={`${card} flex flex-col items-center gap-3 py-12 text-center`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/[0.06]">
        <SatelliteDish className="h-6 w-6 text-slate-400" strokeWidth={1.75} />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">Job search isn't available right now</h3>
      <p className="max-w-md text-sm text-slate-500">
        We couldn't reach the listings just now, so no search was run. This isn't "no results for your search".
        Please try again in a minute.
      </p>
    </div>
  );
}
