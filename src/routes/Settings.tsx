import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { pageHeader, pageTitle, pageSubtitle } from "../lib/ui";
import { LS_KEY } from "../types/tracker";
import { getOnboardingData, saveOnboardingData } from "../lib/onboarding";
import { useState } from "react";
import { toast } from "../components/ui/toast";

export function Settings() {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleExportData = () => {
    try {
      const trackerRaw = localStorage.getItem(LS_KEY);
      const onboarding = getOnboardingData();
      const data = {
        exportedAt: new Date().toISOString(),
        tracker: trackerRaw ? JSON.parse(trackerRaw) : [],
        onboarding: onboarding ?? undefined,
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

  const handleDeleteAccount = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem("internos_onboarding_done_v1");
      localStorage.removeItem("internos_onboarding_v1");
      localStorage.removeItem("internos_alignment_history_v1");
      setConfirmDelete(false);
      navigate("/", { replace: true });
    } catch {
      // ignore
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className={pageHeader}>
          <div>
            <h1 className={pageTitle}>Settings</h1>
            <p className={pageSubtitle}>
              Manage your account and data.
            </p>
          </div>
        </header>
        <Panel
          title="General"
          subtitle="Export, resume, and account management."
        >
          <p className="text-sm text-white/60">
            Export data, update your resume, or delete your account.
          </p>
        </Panel>

        <Panel
          title="Update resume"
          subtitle="Re-upload or replace your resume for analysis."
        >
          <p className="text-sm text-white/70">
            Use the Analyzer to upload a new resume. Each analysis uses the
            resume you upload there.
          </p>
          <Button
            type="button"
            onClick={() => navigate("/analyzer")}
            variant="primary"
            className="mt-4"
          >
            Go to Analyzer
          </Button>
        </Panel>

        <Panel
          title="Manage account"
          subtitle="Profile and preferences."
        >
          <OnboardingForm />
        </Panel>

        <Panel
          title="Export data"
          subtitle="Download all your tracker and profile data as JSON."
        >
          <p className="text-sm text-white/70">
            Includes applications, alignment history, and onboarding answers.
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
          subtitle="Permanently remove all local data. This cannot be undone."
        >
          {confirmDelete ? (
            <div className="space-y-3">
              <p className="text-sm text-rose-200/90">
                Are you sure? All tracker items and settings will be deleted.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleDeleteAccount}
                  variant="danger"
                >
                  Yes, delete everything
                </Button>
                <Button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              onClick={() => setConfirmDelete(true)}
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

function OnboardingForm() {
  const existing = getOnboardingData();
  const [major, setMajor] = useState(existing?.major ?? "");
  const [targetRole, setTargetRole] = useState(existing?.targetRole ?? "");
  const [graduationYear, setGraduationYear] = useState(
    existing?.graduationYear ?? ""
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveOnboardingData({
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
        <label className="block text-xs text-white/50">Major / Field</label>
        <Input
          type="text"
          value={major}
          onChange={(e) => setMajor(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <label className="block text-xs text-white/50">Target role</label>
        <Input
          type="text"
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <label className="block text-xs text-white/50">Graduation year</label>
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
