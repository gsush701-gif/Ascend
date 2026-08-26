import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { pageHeader, pageTitle, pageSubtitle, badgePrimary } from "../lib/ui";
import { toast } from "../components/ui/toast";
import { useAuth } from "../context/AuthContext";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { useProfile } from "../lib/profile";
import { supabase } from "../lib/supabaseClient";
import { API_BASE } from "../config/api";
import { getApiErrorMessage } from "../lib/apiError";
import {
  getStoredSharePayload,
  getStoredShareSlug,
  setStoredShareSlug,
  buildShareUrl,
} from "../lib/shareProfile";

export function Profile() {
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const tracker = useTracker(undefined);
  const items = tracker.tracker;
  const [shareSlug, setShareSlugState] = useState(() => getStoredShareSlug());
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const planInfo = usePlanUsage(session?.user?.id);
  const [searchParams, setSearchParams] = useSearchParams();

  const applicationsTracked = items.length;
  const rolesAnalyzed = items.filter((i) => i.reportSnapshot).length;
  const payload = getStoredSharePayload();

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

  const handleExportData = async () => {
    try {
      const { data: resumeImprovements, error } = await supabase
        .from("resume_improvements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const data = {
        exportedAt: new Date().toISOString(),
        roles: tracker.tracker,
        resumeImprovements: resumeImprovements ?? [],
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

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
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
      setConfirmDelete(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className={pageHeader}>
          <div>
            <h1 className={pageTitle}>Profile</h1>
            <p className={pageSubtitle}>
              Your identity, plan, and account settings.
            </p>
          </div>
        </header>

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

        <Panel
          title="Shareable link"
          subtitle="Share top skills, resume strength, and alignment history with mentors or peers."
        >
          <Input
            type="text"
            value={shareSlug}
            onChange={(e) =>
              setShareSlugState(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))
            }
            placeholder="username (e.g. sushil)"
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

        <Panel title="Plan" subtitle="Your current plan and usage this month.">
          <PlanPanelBody
            planInfo={planInfo}
            billingBusy={billingBusy}
            onUpgrade={handleUpgrade}
            onManageBilling={handleManageBilling}
          />
        </Panel>

        <Panel
          title="Change password"
          subtitle="Update the password for your account."
        >
          <ChangePasswordForm />
        </Panel>

        <Panel
          title="Export data"
          subtitle="Download all your tracked roles and resume improvements as JSON."
        >
          <p className="text-sm text-slate-600">
            Includes applications, alignment history, and resume improvement history.
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
          {confirmDelete ? (
            <div className="space-y-3">
              <p className="text-sm text-rose-700/90">
                Are you sure? Your account, tracked roles, and resume history will be permanently deleted.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleDeleteAccount}
                  variant="danger"
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Yes, delete everything"}
                </Button>
                <Button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  variant="secondary"
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              onClick={handleDeleteAccount}
              variant="dangerOutline"
            >
              Delete account & data
            </Button>
          )}
        </Panel>
      </div>
    </AppShell>
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
      .catch(() => {})
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
