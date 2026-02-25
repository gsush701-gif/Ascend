import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { LS_KEY } from "../types/tracker";
import {
  getOnboardingData,
  saveOnboardingData,
  type OnboardingData,
} from "../lib/onboarding";
import { useState } from "react";

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
      a.download = `internos-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
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
      <div className="space-y-8">
        <Panel
          title="Settings"
          subtitle="Manage your account and data."
        />

        <Panel
          title="Update resume"
          subtitle="Re-upload or replace your resume for analysis."
        >
          <p className="text-sm text-white/70">
            Use the Analyzer to upload a new resume. Each analysis uses the
            resume you upload there.
          </p>
          <button
            type="button"
            onClick={() => navigate("/analyzer")}
            className="btn-press mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Go to Analyzer
          </button>
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
          <button
            type="button"
            onClick={handleExportData}
            className="btn-press mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10"
          >
            Export data
          </button>
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
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="btn-press rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
                >
                  Yes, delete everything
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="btn-press rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="btn-press rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
            >
              Delete account & data
            </button>
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
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-white/60">Major / Field</label>
        <input
          type="text"
          value={major}
          onChange={(e) => setMajor(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        />
      </div>
      <div>
        <label className="block text-xs text-white/60">Target role</label>
        <input
          type="text"
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        />
      </div>
      <div>
        <label className="block text-xs text-white/60">Graduation year</label>
        <input
          type="text"
          value={graduationYear}
          onChange={(e) => setGraduationYear(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        />
      </div>
      <button
        type="button"
        onClick={handleSave}
        className="btn-press rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
      >
        {saved ? "Saved" : "Save profile"}
      </button>
    </div>
  );
}
