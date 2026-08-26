import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
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

        <Panel title="Plan" subtitle="Your current plan.">
          <div className="flex items-center gap-3">
            <span className={badgePrimary}>Free plan</span>
            <span className="text-sm text-slate-500">All features included — no paid tiers yet.</span>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
            <li>• Unlimited role tracking</li>
            <li>• AI-powered resume analysis and rewriting</li>
            <li>• Data synced across devices</li>
          </ul>
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
