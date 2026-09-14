import { useState, useEffect } from "react";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { badgePrimary } from "../../../lib/ui";
import { toast } from "../../../components/ui/toast";
import { useProfile } from "../../../lib/profile";
import { supabase } from "../../../lib/supabaseClient";
import type { PlanInfo } from "../hooks/usePlanUsage";

/**
 * Shared Profile forms/panels used by both:
 *  - the Profile page (src/routes/Profile.tsx)
 *  - the independent account menu (src/components/layout/TopNav.tsx)
 *
 * Kept in their own leaf module (no AppShell/page dependency) so the top-nav
 * — which AppShell renders on every page — can import these directly without
 * a circular import through the Profile page. Only components are exported
 * from this file (the usePlanUsage/useBillingActions hooks it relies on live
 * in ../hooks) so Fast Refresh keeps working.
 */

export function PlanPanelBody({
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

/**
 * `onSaved` is optional so this can be embedded standalone (the independent
 * account menu in src/components/layout/TopNav.tsx uses it to auto-close its
 * modal) without affecting the Profile page's own usage, which omits it.
 */
export function ChangePasswordForm({ onSaved }: { onSaved?: () => void } = {}) {
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
    onSaved?.();
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

/** `onSaved` — see the note on ChangePasswordForm above; same optional
 * auto-close hook for the independent account menu, unused by the Profile
 * page's own usage. */
export function OnboardingForm({ onSaved }: { onSaved?: () => void } = {}) {
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
    onSaved?.();
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
 * Automated weekly career report opt-in (Phase 7 Task 7) — a single toggle
 * on `profiles.weekly_reports_enabled`, saved instantly on change (no
 * separate "Save" button needed for one boolean), same direct-Supabase
 * RLS-scoped write pattern as every other profile field in this file
 * (via useProfile's updateProfile). The actual generation + send happens
 * server-side on a schedule (server/lib/weeklyReport.js, triggered weekly by
 * .github/workflows/weekly-report.yml) — this toggle only controls whether
 * that job includes this user at all.
 */
export function NotificationPreferencesForm() {
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
