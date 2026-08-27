import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PublicShell } from "../components/layout/PublicShell";
import { Button } from "../components/ui/Button";
import { card, badge } from "../lib/ui";
import { cn } from "../lib/cn";
import { API_BASE } from "../config/api";
import type { PublicProfileData } from "../types/publicProfile";

/**
 * Public, unauthenticated profile view at /u/:slug (App.tsx). Fetches from
 * GET /api/public-profile/:slug (server/index.js) — never queries Supabase
 * directly, since that endpoint is the only thing allowed to read across
 * user boundaries. Renders identically for "no such slug" and "slug exists
 * but is private" (both are a plain 404 from the API — see the security
 * comment above that route in server/index.js), so this page never leaks
 * which case it is.
 *
 * Replaces the old /{slug}?d=<base64> mechanism (src/components/ProfileView.tsx
 * + src/lib/shareProfile.ts, both deleted) — this reads live current data
 * from the backend on every visit instead of decoding a stale snapshot
 * embedded in the URL itself.
 */
export function PublicProfile() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicProfileData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setData(null);

    fetch(`${API_BASE}/api/public-profile/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as PublicProfileData;
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setNotFound(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-2xl py-10 text-center text-sm text-slate-500">Loading profile…</div>
      </PublicShell>
    );
  }

  if (notFound || !data) {
    return (
      <PublicShell>
        <div className={cn("mx-auto max-w-md space-y-4 p-10 text-center", card)}>
          <h1 className="text-xl font-semibold text-slate-900">Profile not found</h1>
          <p className="text-sm text-slate-500">
            This link doesn&apos;t point to a public profile. It may not exist, or the owner may have made it
            private.
          </p>
          <Link to="/" className="block">
            <Button variant="primary" className="w-full">
              Back to Ascend
            </Button>
          </Link>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">@{data.slug}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {data.targetRole ? `Aiming for ${data.targetRole}` : "Shared career profile"}
        </p>

        <div className="mt-8 space-y-6">
          {data.skills && (
            <section className={cn("p-5", card)}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Top skills</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.skills.length > 0 ? (
                  data.skills.map((s) => (
                    <span key={s} className={badge}>
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">None shared yet</span>
                )}
              </div>
            </section>
          )}

          <section className={cn("p-5", card)}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Resume strength</h2>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-2xl font-semibold text-slate-900">
                {data.resumeStrength != null ? `${data.resumeStrength}/100` : "Not analyzed yet"}
              </span>
            </div>
          </section>

          {data.alignmentHistory && (
            <section className={cn("p-5", card)}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Alignment history
              </h2>
              <div className="mt-3 space-y-2">
                {data.alignmentHistory.length > 0 ? (
                  data.alignmentHistory.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-dash-surface px-3 py-2 text-sm"
                    >
                      <span className="text-slate-500">
                        {new Date(h.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="font-semibold text-slate-900">{h.alignment}%</span>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No analyses yet</span>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/"
            className="btn-press inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-900/[0.04] px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-900/[0.06]"
          >
            Create your own →
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
