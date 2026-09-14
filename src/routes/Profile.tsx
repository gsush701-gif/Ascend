import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Pencil, X } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { pageHeader, pageTitle, pageSubtitle, cardHeader } from "../lib/ui";
import { toast } from "../components/ui/toast";
import { useAuth } from "../context/AuthContext";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { useProfile } from "../lib/profile";
import { supabase } from "../lib/supabaseClient";
import { API_BASE } from "../config/api";
import { getApiErrorMessage } from "../lib/apiError";
// import { usePublicProfile } from "../features/publicProfile/hooks/usePublicProfile";
// import { GithubPanel } from "../features/integrations/components/GithubPanel";
import { MfaSettingsPanel } from "../features/mfa/components/MfaSettingsPanel";
import { useMfaFactors } from "../features/mfa/hooks/useMfaFactors";
import {
  PlanPanelBody,
  ChangePasswordForm,
  OnboardingForm,
  NotificationPreferencesForm,
} from "../features/profile/components/ProfileSharedForms";
import { usePlanUsage } from "../features/profile/hooks/usePlanUsage";
import { useBillingActions } from "../features/profile/hooks/useBillingActions";

export function Profile() {
  const navigate = useNavigate();
  const { user, session, signOut } = useAuth();
  const tracker = useTracker(undefined);
  const items = tracker.tracker;
  const { profile } = useProfile();
  // const publicProfile = usePublicProfile(profile?.fullName);
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
  const { billingBusy, handleUpgrade, handleManageBilling } = useBillingActions(session);
  const planInfo = usePlanUsage(session?.user?.id);
  const [searchParams, setSearchParams] = useSearchParams();

  // The profile menu in the top nav deep-links here:
  //   ?edit=1           -> open the identity editor (OnboardingForm) straight away
  //   ?section=password -> scroll to the Change password panel (effect below)
  // `edit` is read directly so it works even when already on this page; the
  // in-page Edit/Close button also flips `identityEditManual`.
  const editParam = searchParams.get("edit") === "1";
  const [identityEditManual, setIdentityEditManual] = useState(false);
  const identityEditOpen = identityEditManual || editParam;

  const toggleIdentityEdit = () => {
    if (identityEditOpen) {
      setIdentityEditManual(false);
      if (editParam) {
        const next = new URLSearchParams(searchParams);
        next.delete("edit");
        setSearchParams(next, { replace: true });
      }
    } else {
      setIdentityEditManual(true);
    }
  };

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

  // See the deep-link note above — ?section=<id> jumps to any SettingsSection
  // below by its `id` (change-password, plan, notifications, data), then
  // strips the param (same one-shot pattern as the redirect handlers above).
  useEffect(() => {
    const section = searchParams.get("section");
    if (!section) return;
    document.getElementById(section)?.scrollIntoView({ block: "start" });
    const next = new URLSearchParams(searchParams);
    next.delete("section");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {profileChips.length > 0 && (
                  <p className="truncate text-xs text-slate-500">
                    {profileChips.join(" · ")}
                  </p>
                )}
                <button
                  type="button"
                  onClick={toggleIdentityEdit}
                  aria-label={identityEditOpen ? "Close edit" : "Edit identity"}
                  className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:text-cyan-800"
                >
                  {identityEditOpen ? (
                    <>
                      <X size={12} /> Close
                    </>
                  ) : (
                    <>
                      <Pencil size={12} /> Edit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {identityEditOpen && (
            <div className="mt-5 border-t border-slate-200 pt-5">
              <OnboardingForm />
            </div>
          )}
        </Panel>

        {/* <SettingsSection label="Public profile">
          <Panel
            title="Shareable profile"
            subtitle="A public page showing your current skills, resume strength, and alignment history — always live, never a stale snapshot."
          >
            <PublicProfilePanel publicProfile={publicProfile} />
          </Panel>
        </SettingsSection> */}

        {/* <SettingsSection label="Integrations">
          <Panel
            title="GitHub"
            subtitle="Connect your GitHub account to link real projects to your skill gaps."
          >
            <GithubPanel />
          </Panel>
        </SettingsSection> */}

        <SettingsSection label="Plan & usage" id="plan">
          <Panel title="Plan" subtitle="Your current plan and usage this month.">
            <PlanPanelBody
              planInfo={planInfo}
              billingBusy={billingBusy}
              onUpgrade={handleUpgrade}
              onManageBilling={handleManageBilling}
            />
          </Panel>
        </SettingsSection>

        <SettingsSection label="Security" id="change-password">
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

        <SettingsSection label="Notifications & activity" id="notifications">
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

        <SettingsSection label="Data" id="data">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
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
  id,
  children,
}: {
  label: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-4 scroll-mt-24">
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
/*
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
*/

