import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { pageHeader, pageTitle, pageSubtitle, badgePrimary, cardHeader } from "../lib/ui";
import { toast } from "../components/ui/toast";
import { useAuth } from "../context/AuthContext";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { useProfile } from "../lib/profile";
import { supabase } from "../lib/supabaseClient";
import { API_BASE } from "../config/api";
import { getApiErrorMessage } from "../lib/apiError";
import { usePublicProfile } from "../features/publicProfile/hooks/usePublicProfile";
import { GithubPanel } from "../features/integrations/components/GithubPanel";
import { MfaSettingsPanel } from "../features/mfa/components/MfaSettingsPanel";
import { useMfaFactors } from "../features/mfa/hooks/useMfaFactors";

/**
 * Reads one table for the "Export data" panel, RLS-scoped like every other
 * direct Supabase read in this file. Deliberately never throws: several of
 * the tables it reads (job_analyses, contacts, career_goals, notifications,
 * resumes) were only added in migrations 005+ (see supabase/migrations/),
 * which may not be applied yet in every environment — a missing table
 * should degrade to an empty array in the export, not abort the whole
 * download for the other sections that do have data.
 */
async function fetchExportTable<T = Record<string, unknown>>(
  table: string,
  columns: string,
): Promise<T[]> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn(`[export] could not read "${table}": ${error.message}`);
      return [];
    }
    return (data as T[] | null) ?? [];
  } catch (e) {
    console.warn(`[export] could not read "${table}":`, e);
    return [];
  }
}

export function Profile() {
  const navigate = useNavigate();
  const { user, session, signOut } = useAuth();
  const tracker = useTracker(undefined);
  const items = tracker.tracker;
  const { profile } = useProfile();
  const publicProfile = usePublicProfile(profile?.fullName);
  const { mfaEnabled, verifiedFactorId } = useMfaFactors();
  // Delete-account flow, gated behind a re-authentication step before the
  // irreversible backend call: 'idle' -> (click) -> 'confirm' -> (click Yes)
  // -> 'password' -> (correct password) -> 'mfa' (only if 2FA is enabled) ->
  // (correct code) -> actually calls DELETE. Re-entering the password (via
  // signInWithPassword, same approach used to disable 2FA in
  // MfaSettingsPanel) confirms identity within a short window rather than
  // trusting the existing session alone for something this permanent; a
  // fresh TOTP challenge is required in addition when 2FA is on, since
  // knowing the password alone is exactly what 2FA exists to not be enough.
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm" | "password" | "mfa">("idle");
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthCode, setReauthCode] = useState("");
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const planInfo = usePlanUsage(session?.user?.id);
  const [searchParams, setSearchParams] = useSearchParams();

  const applicationsTracked = items.length;
  const rolesAnalyzed = items.filter((i) => i.reportSnapshot).length;

  // Identity-summary presentation only — every value below comes from data
  // already loaded above (`profile` via useProfile, `user` via useAuth,
  // `planInfo` via usePlanUsage). No new data source, state, or request.
  const displayName =
    profile?.fullName?.trim() || user?.email?.split("@")[0] || "Your account";
  const avatarInitial = (displayName.trim().charAt(0) || "A").toUpperCase();
  const profileChips = [profile?.major, profile?.targetRole, profile?.graduationYear]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v && v !== "Not specified");
  const plansMap = planInfo.plansData?.plans;
  const planName =
    plansMap?.[planInfo.planKey]?.name ??
    plansMap?.[planInfo.plansData?.defaultPlan ?? ""]?.name ??
    "Free";

  // Stripe Checkout redirects back here with ?checkout=success|cancelled
  // (server/index.js's /api/billing/create-checkout-session success_url /
  // cancel_url). Surface it once as a toast, then strip the param so a
  // refresh or back-navigation doesn't re-show it.
  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout");
    if (!checkoutStatus) return;
    if (checkoutStatus === "success") {
      toast.success({
        title: "You're on Pro",
        description: "Your subscription is active — thanks for upgrading!",
      });
    } else if (checkoutStatus === "cancelled") {
      toast.info({ title: "Checkout cancelled", description: "No charge was made." });
    }
    const next = new URLSearchParams(searchParams);
    next.delete("checkout");
    setSearchParams(next, { replace: true });
    // Only ever run this in response to the URL actually carrying the
    // param — re-running on every searchParams identity change would loop
    // (setSearchParams itself changes searchParams).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // GET /api/github/callback (server/index.js) redirects back here with
  // ?github=connected|denied|invalid_state|not_configured|error once the
  // OAuth flow (or an attempted one) completes — surface it once, then
  // strip the param, same pattern as the Stripe checkout redirect above.
  useEffect(() => {
    const githubStatus = searchParams.get("github");
    if (!githubStatus) return;
    if (githubStatus === "connected") {
      toast.success({ title: "GitHub connected" });
    } else if (githubStatus === "denied") {
      toast.info({ title: "GitHub connection cancelled" });
    } else if (githubStatus === "not_configured") {
      toast.error({
        title: "GitHub isn't configured yet",
        description: "This Ascend deployment hasn't set up a GitHub OAuth App yet.",
      });
    } else if (githubStatus === "invalid_state" || githubStatus === "error") {
      toast.error({
        title: "Couldn't connect GitHub",
        description: "Something went wrong completing the connection — please try again.",
      });
    }
    const next = new URLSearchParams(searchParams);
    next.delete("github");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleUpgrade = async () => {
    if (!session?.access_token) return;
    setBillingBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing/create-checkout-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "Failed to start checkout"));
      }
      if (typeof data.url !== "string") {
        throw new Error("Failed to start checkout");
      }
      window.location.href = data.url;
    } catch (e) {
      toast.error({
        title: "Couldn't start checkout",
        description: e instanceof Error ? e.message : "Please try again.",
      });
      setBillingBusy(false);
    }
  };

  const handleManageBilling = async () => {
    if (!session?.access_token) return;
    setBillingBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing/create-portal-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "Failed to open billing portal"));
      }
      if (typeof data.url !== "string") {
        throw new Error("Failed to open billing portal");
      }
      window.location.href = data.url;
    } catch (e) {
      toast.error({
        title: "Couldn't open billing portal",
        description: e instanceof Error ? e.message : "Please try again.",
      });
      setBillingBusy(false);
    }
  };

  const handleExportData = async () => {
    try {
      const [resumeImprovements, resumes, jobAnalyses, contacts, careerGoals, notifications] =
        await Promise.all([
          fetchExportTable("resume_improvements", "*"),
          // Metadata only — deliberately excludes `storage_path` (an internal
          // Storage bucket key) and `extracted_text` (the full resume body).
          // A "download all my resume files" affordance is a separate,
          // future feature; this export stays JSON-only.
          fetchExportTable(
            "resumes",
            "id, name, version, is_default, created_at, updated_at, deleted_at",
          ),
          fetchExportTable(
            "job_analyses",
            "id, resume_id, role_id, job_description, result, created_at",
          ),
          fetchExportTable("contacts", "*"),
          fetchExportTable("career_goals", "*"),
          fetchExportTable("notifications", "*"),
        ]);

      const data = {
        exportedAt: new Date().toISOString(),
        roles: tracker.tracker,
        resumeImprovements,
        resumes,
        jobAnalyses,
        contacts,
        careerGoals,
        notifications,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ascend-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success({ title: "Data exported", description: "Your data has been downloaded." });
    } catch {
      toast.error({ title: "Export failed", description: "Could not export your data." });
    }
  };

  const performAccountDeletion = async () => {
    if (!session?.access_token) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/account/delete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(data, "Failed to delete account"));
      }
      await signOut();
      navigate("/login", { replace: true });
    } catch (e) {
      toast.error({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Could not delete your account.",
      });
      setDeleting(false);
      setDeleteStep("idle");
    }
  };

  const handleReauthPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (!reauthPassword) {
      setReauthError("Enter your password to confirm.");
      return;
    }
    setReauthError(null);
    setDeleting(true);
    // Re-authentication step (task spec): re-confirm identity by calling
    // signInWithPassword again immediately before an irreversible action,
    // rather than trusting the existing session alone. If the account also
    // has 2FA enabled, that alone isn't treated as sufficient — a stolen or
    // idle-but-unlocked session already satisfies "is logged in", so we
    // still require a fresh MFA challenge next in that case, same principle
    // as re-entering a password.
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: reauthPassword });
    setDeleting(false);
    if (error) {
      setReauthError("Incorrect password.");
      return;
    }
    setReauthPassword("");
    if (mfaEnabled) {
      setDeleteStep("mfa");
      return;
    }
    await performAccountDeletion();
  };

  const handleReauthMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedFactorId) return;
    if (!reauthCode.trim()) {
      setReauthError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setReauthError(null);
    setDeleting(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: verifiedFactorId,
      code: reauthCode.trim(),
    });
    if (error) {
      setDeleting(false);
      setReauthError(error.message);
      return;
    }
    setReauthCode("");
    await performAccountDeletion();
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <header className={pageHeader}>
          <div>
            <h1 className={pageTitle}>Profile</h1>
            <p className={pageSubtitle}>
              Your identity, plan, and account settings.
            </p>
          </div>
        </header>

        {/* Identity summary — reflects data already loaded elsewhere on this page */}
        <Panel>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div
              aria-hidden
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-900 font-display text-lg font-semibold text-white"
            >
              {avatarInitial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-display text-base font-semibold text-slate-900">
                  {displayName}
                </span>
                <Badge variant="primary">{planName} plan</Badge>
              </div>
              {user?.email && (
                <p className="mt-0.5 truncate text-sm text-slate-500">{user.email}</p>
              )}
              {profileChips.length > 0 && (
                <p className="mt-1 truncate text-xs text-slate-500">
                  {profileChips.join(" · ")}
                </p>
              )}
            </div>
          </div>
        </Panel>

        <SettingsSection label="Account">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <Panel
              title="Identity"
              subtitle="Your major, target role, and graduation year."
            >
              <OnboardingForm />
            </Panel>

            <Panel
              title="Career preferences"
              subtitle="Work authorization and location preferences, used for an honest compatibility note on tracked roles."
            >
              <CareerPreferencesForm />
            </Panel>
          </div>
        </SettingsSection>

        <SettingsSection label="Public profile">
          <Panel
            title="Shareable profile"
            subtitle="A public page showing your current skills, resume strength, and alignment history — always live, never a stale snapshot."
          >
            <PublicProfilePanel publicProfile={publicProfile} />
          </Panel>
        </SettingsSection>

        <SettingsSection label="Integrations">
          <Panel
            title="GitHub"
            subtitle="Connect your GitHub account to link real projects to your skill gaps."
          >
            <GithubPanel />
          </Panel>
        </SettingsSection>

        <SettingsSection label="Plan & usage">
          <Panel title="Plan" subtitle="Your current plan and usage this month.">
            <PlanPanelBody
              planInfo={planInfo}
              billingBusy={billingBusy}
              onUpgrade={handleUpgrade}
              onManageBilling={handleManageBilling}
            />
          </Panel>
        </SettingsSection>

        <SettingsSection label="Security">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <Panel
              title="Change password"
              subtitle="Update the password for your account."
            >
              <ChangePasswordForm />
            </Panel>

            <Panel
              title="Two-factor authentication"
              subtitle="Add a code from an authenticator app as a second step when logging in."
            >
              <MfaSettingsPanel />
            </Panel>
          </div>
        </SettingsSection>

        <SettingsSection label="Notifications & activity">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <Panel
              title="Notifications"
              subtitle="Control what Ascend emails you."
            >
              <NotificationPreferencesForm />
            </Panel>

            <Panel title="Your stats" subtitle="Usage so far.">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-200 bg-dash-surface p-4">
                  <div className="font-display text-2xl font-semibold text-slate-900">
                    {applicationsTracked}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Applications tracked
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-dash-surface p-4">
                  <div className="font-display text-2xl font-semibold text-slate-900">
                    {rolesAnalyzed}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">Roles analyzed</div>
                </div>
              </div>
            </Panel>
          </div>
        </SettingsSection>

        <SettingsSection label="Data">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <Panel
              title="Export data"
              subtitle="Download all your Ascend data as a single JSON file."
            >
              <p className="text-sm text-slate-600">
                Includes tracked applications, resume improvement history, resume metadata (not the
                PDF files themselves), past analyses, contacts, career goals, and notifications.
              </p>
              <Button
                type="button"
                onClick={handleExportData}
                variant="secondary"
                className="mt-4"
              >
                Export data
              </Button>
            </Panel>

            <Panel
              title="Delete account"
              subtitle="Permanently remove your account and all your data. This cannot be undone."
            >
              {deleteStep === "confirm" && (
                <div className="space-y-3">
                  <p className="text-sm text-rose-700/90">
                    Are you sure? Your account, tracked roles, and resume history will be permanently deleted.
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => setDeleteStep("password")} variant="danger">
                      Yes, delete everything
                    </Button>
                    <Button type="button" onClick={() => setDeleteStep("idle")} variant="secondary">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {deleteStep === "password" && (
                <form onSubmit={handleReauthPassword} className="space-y-3">
                  <p className="text-sm text-slate-600">
                    For your security, confirm your password before we delete your account.
                  </p>
                  {reauthError && (
                    <div className="animate-fade-in rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                      {reauthError}
                    </div>
                  )}
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={reauthPassword}
                    onChange={(e) => setReauthPassword(e.target.value)}
                    placeholder="Current password"
                    className="max-w-xs"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" variant="danger" disabled={deleting}>
                      {deleting ? "Confirming…" : "Confirm password"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setDeleteStep("idle");
                        setReauthError(null);
                        setReauthPassword("");
                      }}
                      variant="secondary"
                      disabled={deleting}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              {deleteStep === "mfa" && (
                <form onSubmit={handleReauthMfa} className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Your account has two-factor authentication enabled — enter a code from your authenticator
                    app to finish deleting your account.
                  </p>
                  {reauthError && (
                    <div className="animate-fade-in rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                      {reauthError}
                    </div>
                  )}
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={reauthCode}
                    onChange={(e) => setReauthCode(e.target.value)}
                    placeholder="123456"
                    className="max-w-[160px]"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" variant="danger" disabled={deleting}>
                      {deleting ? "Deleting…" : "Verify & delete everything"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setDeleteStep("idle");
                        setReauthError(null);
                        setReauthCode("");
                      }}
                      variant="secondary"
                      disabled={deleting}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              {deleteStep === "idle" && (
                // SAFETY (temporary): `disabled` added so account deletion — which is
                // irreversible, and this dev build points at a shared Supabase
                // project — can't be triggered by accident. To revert, delete the
                // `disabled` prop on the <Button> below.
                <Button
                  type="button"
                  onClick={() => setDeleteStep("confirm")}
                  disabled
                  variant="dangerOutline"
                  title="Temporarily disabled during development"
                >
                  Delete account & data
                </Button>
              )}
            </Panel>
          </div>
        </SettingsSection>
      </div>
    </AppShell>
  );
}

/**
 * Presentational-only section wrapper: a muted uppercase eyebrow label
 * (reusing the `cardHeader` token, same treatment Dashboard uses for its
 * section labels) above a group of related panels. No state, no logic.
 */
function SettingsSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className={cardHeader}>{label}</h2>
      {children}
    </section>
  );
}

/**
 * Controls for the database-backed shareable profile (Phase 7 Task 5) — see
 * src/features/publicProfile/hooks/usePublicProfile.ts and
 * supabase/migrations/017_public_profiles.sql. Replaces the old
 * "Generate & copy link" flow that base64-encoded a generate-time snapshot
 * directly into the URL.
 */
function PublicProfilePanel({ publicProfile }: { publicProfile: ReturnType<typeof usePublicProfile> }) {
  const { settings, loading, error, saving, shareUrl, updateSlug, regenerateSlug, setIsPublic, setVisibilityField } =
    publicProfile;
  const [slugInput, setSlugInput] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (settings && !initialized) {
      setSlugInput(settings.slug);
      setInitialized(true);
    }
  }, [settings, initialized]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (!settings) {
    return <p className="text-sm text-rose-600">{error ?? "Could not load your shareable profile."}</p>;
  }

  const handleSaveSlug = async () => {
    setSlugError(null);
    const { error: err } = await updateSlug(slugInput);
    if (err) {
      setSlugError(err);
      return;
    }
    toast.success({ title: "Slug updated" });
  };

  const handleRegenerate = async () => {
    const { error: err, slug } = await regenerateSlug();
    if (err) {
      toast.error({ title: "Couldn't regenerate slug", description: err });
      return;
    }
    if (slug) setSlugInput(slug);
    setSlugError(null);
    toast.success({ title: "New slug generated", description: "Your old link no longer works." });
  };

  const handleTogglePublic = async () => {
    const { error: err } = await setIsPublic(!settings.isPublic);
    if (err) toast.error({ title: "Couldn't update visibility", description: err });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-dash-surface px-4 py-3">
        <div>
          <div className="text-sm font-medium text-slate-900">{settings.isPublic ? "Public" : "Private"}</div>
          <div className="text-xs text-slate-500">
            {settings.isPublic
              ? "Anyone with the link below can view this profile."
              : "Only you can see this — the link won't work for anyone else yet."}
          </div>
        </div>
        <Button
          type="button"
          variant={settings.isPublic ? "secondary" : "primary"}
          onClick={handleTogglePublic}
          disabled={saving}
        >
          {settings.isPublic ? "Make private" : "Make public"}
        </Button>
      </div>

      <div>
        <label className="block text-xs text-slate-500">Slug</label>
        <div className="mt-1 flex gap-2">
          <Input
            type="text"
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
            placeholder="your-name"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleSaveSlug}
            disabled={saving || slugInput.trim() === settings.slug}
          >
            Save
          </Button>
        </div>
        {slugError && <p className="mt-1 text-xs text-rose-600">{slugError}</p>}
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={saving}
          className="mt-2 text-xs font-medium text-slate-500 underline decoration-dotted hover:text-slate-800"
        >
          Regenerate slug (invalidates the old link)
        </button>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-500">Shown on your public profile</div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={settings.showSkills}
            onChange={(e) => setVisibilityField("showSkills", e.target.checked)}
          />
          Top skills
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={settings.showAlignmentHistory}
            onChange={(e) => setVisibilityField("showAlignmentHistory", e.target.checked)}
          />
          Alignment history
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={settings.showTargetRole}
            onChange={(e) => setVisibilityField("showTargetRole", e.target.checked)}
          />
          Target role
        </label>
        <p className="text-xs text-slate-500">Resume strength is always shown when your profile is public.</p>
      </div>

      <div>
        <label className="block text-xs text-slate-500">Your link</label>
        <div className="mt-1 flex gap-2">
          <Input type="text" value={shareUrl} readOnly className="text-slate-500" />
          <Button type="button" variant="secondary" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type PlanConfig = {
  name: string;
  priceMonthly: number;
  limits: Record<string, number>;
};

type PlansResponse = {
  plans: Record<string, PlanConfig>;
  defaultPlan: string;
  usageLabels: Record<string, string>;
};

type PlanInfo = {
  loading: boolean;
  plansData: PlansResponse | null;
  planKey: string;
  usageByType: Record<string, number>;
};

/**
 * Loads the central plan config (server/lib/plans.js, via GET /api/plans —
 * static, no auth required) plus this user's current plan and this month's
 * usage per AI operation, so the Plan panel below can show real numbers
 * instead of hardcoded prose.
 *
 * Plan lookup mirrors server/lib/usage.js's getUserPlanKey(): no
 * `subscriptions` row, or a non-'active' status, both mean 'free' — there's
 * no billing yet, so in practice this is always 'free' today, but reading
 * the user's own row (RLS-scoped, same read-only pattern as the rest of
 * this app) keeps the display correct once a later task starts writing
 * real rows there.
 */
function usePlanUsage(userId: string | undefined): PlanInfo {
  const [plansData, setPlansData] = useState<PlansResponse | null>(null);
  const [planKey, setPlanKey] = useState("free");
  const [usageByType, setUsageByType] = useState<Record<string, number>>({});
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [usageLoaded, setUsageLoaded] = useState(!userId);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/plans`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PlansResponse | null) => {
        if (cancelled || !data) return;
        setPlansData(data);
        setPlanKey((prev) => prev || data.defaultPlan);
      })
      .catch(() => { })
      .finally(() => {
        if (!cancelled) setPlansLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setUsageLoaded(false);

    supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        if (data.status === "active" && data.plan) setPlanKey(data.plan);
      });

    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    supabase
      .from("usage_events")
      .select("event_type")
      .eq("user_id", userId)
      .gte("created_at", startOfMonth.toISOString())
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          const counts: Record<string, number> = {};
          for (const row of data as { event_type: string }[]) {
            counts[row.event_type] = (counts[row.event_type] || 0) + 1;
          }
          setUsageByType(counts);
        }
        setUsageLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { loading: !plansLoaded || !usageLoaded, plansData, planKey, usageByType };
}

function PlanPanelBody({
  planInfo,
  billingBusy,
  onUpgrade,
  onManageBilling,
}: {
  planInfo: PlanInfo;
  billingBusy: boolean;
  onUpgrade: () => void;
  onManageBilling: () => void;
}) {
  const { loading, plansData, planKey, usageByType } = planInfo;

  if (!plansData) {
    return <p className="text-sm text-slate-500">{loading ? "Loading plan…" : "Plan info unavailable."}</p>;
  }

  const plan = plansData.plans[planKey] ?? plansData.plans[plansData.defaultPlan];
  const priceLabel =
    plan.priceMonthly === 0 ? "Free — no paid tiers active yet." : `$${(plan.priceMonthly / 100).toFixed(2)}/month`;
  const isPro = planKey === "pro";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className={badgePrimary}>{plan.name} plan</span>
        <span className="text-sm text-slate-500">{priceLabel}</span>
        {!loading && (
          <Button
            type="button"
            onClick={isPro ? onManageBilling : onUpgrade}
            variant={isPro ? "secondary" : "primary"}
            disabled={billingBusy}
            className="ml-auto"
          >
            {billingBusy ? "Redirecting…" : isPro ? "Manage billing" : "Upgrade to Pro"}
          </Button>
        )}
      </div>
      <ul className="mt-4 space-y-1.5 text-sm">
        {Object.entries(plan.limits).map(([eventType, limit]) => {
          const used = usageByType[eventType] || 0;
          const label = plansData.usageLabels[eventType] || eventType;
          const overLimit = used >= limit;
          return (
            <li key={eventType} className="flex items-center justify-between gap-4 text-slate-600">
              <span>{label}</span>
              <span className={overLimit ? "font-medium text-rose-600" : "font-medium text-slate-900"}>
                {used}/{limit} this month
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (password.length < 6) {
      toast.error({ title: "Password too short", description: "Use at least 6 characters." });
      return;
    }
    if (password !== confirmPassword) {
      toast.error({ title: "Passwords don't match" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast.error({ title: "Could not update password", description: error.message });
      return;
    }
    setPassword("");
    setConfirmPassword("");
    toast.success({ title: "Password updated" });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-slate-500">New password</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          className="mt-1"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Confirm new password</label>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1"
        />
      </div>
      <Button type="button" onClick={handleSave} variant="primary" disabled={submitting}>
        {submitting ? "Saving…" : "Update password"}
      </Button>
    </div>
  );
}

function OnboardingForm() {
  const { profile, loading, updateProfile } = useProfile();
  const [major, setMajor] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!loading && profile && !initialized) {
      setMajor(profile.major);
      setTargetRole(profile.targetRole);
      setGraduationYear(profile.graduationYear);
      setInitialized(true);
    }
  }, [loading, profile, initialized]);

  const handleSave = async () => {
    await updateProfile({
      major: major.trim() || "Not specified",
      targetRole: targetRole.trim() || "Not specified",
      graduationYear: graduationYear.trim() || "Not specified",
    });
    setSaved(true);
    toast.success({ title: "Profile saved", description: "Your preferences have been updated." });
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-slate-500">Major / Field</label>
        <Input
          type="text"
          value={major}
          onChange={(e) => setMajor(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Target role</label>
        <Input
          type="text"
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Graduation year</label>
        <Input
          type="text"
          value={graduationYear}
          onChange={(e) => setGraduationYear(e.target.value)}
          className="mt-1"
        />
      </div>
      <Button type="button" onClick={handleSave} variant="primary">
        {saved ? "Saved" : "Save profile"}
      </Button>
    </div>
  );
}

/**
 * Career preferences (Phase 5, Task 3) — work authorization and location
 * preferences, used only to render an honest textual compatibility note on
 * a role's own sponsorship/location/remote-type fields (RoleDetailDrawer).
 * Never used to fabricate a numeric "match score", and never immigration or
 * legal advice — this is purely pattern-matching against employer-stated
 * fields the user already sees on each tracked role.
 */
function CareerPreferencesForm() {
  const { profile, loading, updateProfile } = useProfile();
  const [workAuthorization, setWorkAuthorization] = useState("");
  const [requiresSponsorship, setRequiresSponsorship] = useState("");
  const [preferredLocations, setPreferredLocations] = useState("");
  const [remotePreference, setRemotePreference] = useState("");
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!loading && profile && !initialized) {
      setWorkAuthorization(profile.workAuthorization);
      setRequiresSponsorship(
        profile.requiresSponsorship === true ? "yes" : profile.requiresSponsorship === false ? "no" : ""
      );
      setPreferredLocations(profile.preferredLocations);
      setRemotePreference(profile.remotePreference);
      setInitialized(true);
    }
  }, [loading, profile, initialized]);

  const handleSave = async () => {
    const { error } = await updateProfile({
      workAuthorization: workAuthorization.trim(),
      requiresSponsorship:
        requiresSponsorship === "yes" ? true : requiresSponsorship === "no" ? false : undefined,
      preferredLocations: preferredLocations.trim(),
      remotePreference,
    });
    if (error) {
      toast.error({ title: "Couldn't save preferences", description: error });
      return;
    }
    setSaved(true);
    toast.success({ title: "Preferences saved" });
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-slate-500">Work authorization (optional)</label>
        <Input
          type="text"
          value={workAuthorization}
          onChange={(e) => setWorkAuthorization(e.target.value)}
          placeholder="e.g. US Citizen, F-1 OPT, H-1B"
          className="mt-1"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Do you require visa sponsorship?</label>
        <Select
          value={requiresSponsorship}
          onChange={setRequiresSponsorship}
          placeholder="Not specified"
          options={[
            { value: "", label: "Not specified" },
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Preferred location(s)</label>
        <Input
          type="text"
          value={preferredLocations}
          onChange={(e) => setPreferredLocations(e.target.value)}
          placeholder="e.g. Seattle, WA; New York, NY"
          className="mt-1"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Remote preference</label>
        <Select
          value={remotePreference}
          onChange={setRemotePreference}
          placeholder="Not specified"
          options={[
            { value: "", label: "Not specified" },
            { value: "Remote", label: "Remote" },
            { value: "Hybrid", label: "Hybrid" },
            { value: "Onsite", label: "Onsite" },
            { value: "No preference", label: "No preference" },
          ]}
        />
      </div>
      <Button type="button" onClick={handleSave} variant="primary">
        {saved ? "Saved" : "Save preferences"}
      </Button>
    </div>
  );
}

/**
 * Automated weekly career report opt-in (Phase 7 Task 7) — a single toggle
 * on `profiles.weekly_reports_enabled`, saved instantly on change (no
 * separate "Save" button needed for one boolean), same direct-Supabase
 * RLS-scoped write pattern as every other profile field in this file
 * (via useProfile's updateProfile). The actual generation + send happens
 * server-side on a schedule (server/lib/weeklyReport.js, triggered weekly by
 * .github/workflows/weekly-report.yml) — this toggle only controls whether
 * that job includes this user at all.
 */
function NotificationPreferencesForm() {
  const { profile, loading, updateProfile } = useProfile();
  const [saving, setSaving] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    const { error } = await updateProfile({ weeklyReportsEnabled: checked });
    setSaving(false);
    if (error) {
      toast.error({ title: "Couldn't save preference", description: error });
      return;
    }
    toast.success({
      title: checked ? "Weekly reports enabled" : "Weekly reports disabled",
      description: checked
        ? "You'll get an email summarizing your week's activity, once a week."
        : undefined,
    });
  };

  if (loading || !profile) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={profile.weeklyReportsEnabled}
          disabled={saving}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        Email me a weekly career report
      </label>
      <p className="text-xs text-slate-500">
        A short summary of your applications, interviews, and offers from the past week, plus
        the same recommendations shown on the Report page — sent once a week if you're opted in.
      </p>
    </div>
  );
}
