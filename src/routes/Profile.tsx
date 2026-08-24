import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { pageHeader, pageTitle, pageSubtitle } from "../lib/ui";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { useProfile } from "../lib/profile";
import {
  getStoredSharePayload,
  getStoredShareSlug,
  setStoredShareSlug,
  buildShareUrl,
} from "../lib/shareProfile";

export function Profile() {
  const navigate = useNavigate();
  const tracker = useTracker(undefined);
  const items = tracker.tracker;
  const { profile } = useProfile();
  const hasOnboardingData =
    profile && (profile.major || profile.targetRole || profile.graduationYear);
  const [shareSlug, setShareSlugState] = useState(() => getStoredShareSlug());
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  const applicationsTracked = items.length;
  const rolesAnalyzed = items.filter((i) => i.reportSnapshot).length;
  const payload = getStoredSharePayload();

  const handleGenerateShareLink = () => {
    const slug = shareSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "") || "profile";
    setStoredShareSlug(slug);
    if (!payload) return;
    const url = buildShareUrl(slug, payload);
    navigator.clipboard.writeText(url).then(() => {
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
    });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className={pageHeader}>
          <div>
            <h1 className={pageTitle}>Profile</h1>
            <p className={pageSubtitle}>
              Your identity and share link.
            </p>
          </div>
        </header>
        <Panel
          title="Identity"
          subtitle="Shareable profile and onboarding data."
        >
          <div className="space-y-4">
            {hasOnboardingData && (
              <div className="rounded-xl border border-slate-200 bg-dash-surface p-4 text-sm">
                <div className="text-xs text-slate-500">From onboarding</div>
                <div className="mt-2 text-slate-700">
                  {profile!.major || "—"} · {profile!.targetRole || "—"} ·{" "}
                  {profile!.graduationYear || "—"}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-slate-500">Shareable profile</div>
              <p className="mt-1 text-sm text-slate-600">
                Share top skills, resume strength, and alignment history with mentors or peers.
              </p>
              <Input
                type="text"
                value={shareSlug}
                onChange={(e) =>
                  setShareSlugState(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))
                }
                placeholder="username (e.g. sushil)"
                className="mt-3"
              />
              <Button
                type="button"
                onClick={handleGenerateShareLink}
                disabled={!payload}
                variant="primary"
                className="mt-3"
              >
                {shareLinkCopied ? "Copied!" : "Generate & copy link"}
              </Button>
              {!payload && (
                <p className="mt-2 text-xs text-slate-500">
                  Run an analysis first to generate your share link.
                </p>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Your stats" subtitle="Usage so far.">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-slate-500">Applications tracked </span>
              <span className="font-semibold text-slate-900">{applicationsTracked}</span>
            </div>
            <div>
              <span className="text-slate-500">Roles analyzed </span>
              <span className="font-semibold text-slate-900">{rolesAnalyzed}</span>
            </div>
          </div>
        </Panel>

        <Panel
          title="Account"
          subtitle="Manage settings and data."
        >
          <p className="text-sm text-slate-600">
            Update profile, export data, or delete account.
          </p>
          <Button
            type="button"
            onClick={() => navigate("/settings")}
            variant="primary"
            className="mt-4"
          >
            Open Settings
          </Button>
        </Panel>
      </div>
    </AppShell>
  );
}
