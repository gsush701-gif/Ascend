import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../../lib/profile";

type OnboardingModalProps = {
  onComplete: () => void;
};

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const navigate = useNavigate();
  const { updateProfile } = useProfile();
  const [major, setMajor] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [graduationYear, setGraduationYear] = useState("");

  const handleSkip = () => {
    updateProfile({ major: "Skipped", targetRole: "Skipped", graduationYear: "Skipped" });
    onComplete();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        updateProfile({ major: "Skipped", targetRole: "Skipped", graduationYear: "Skipped" });
        onComplete();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onComplete]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      major: major.trim() || "Not specified",
      targetRole: targetRole.trim() || "Not specified",
      graduationYear: graduationYear.trim() || "Not specified",
    });
    onComplete();
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-modal-backdrop">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-[#FFFFFF] p-8 shadow-2xl animate-modal-content">
        <h2 className="text-2xl font-semibold text-slate-900">
          Welcome to Ascend
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          A few details help us personalize your experience.
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-500">
              Major / Field
            </label>
            <input
              type="text"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              placeholder="e.g. Computer Science"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">
              Target role
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. SWE Intern, Data Analyst"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">
              Graduation year
            </label>
            <input
              type="text"
              value={graduationYear}
              onChange={(e) => setGraduationYear(e.target.value)}
              placeholder="e.g. 2026"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-900/[0.04] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="btn-press flex-1 rounded-xl bg-cyan-500 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400"
            >
              Get started
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="btn-press rounded-xl border border-slate-300 bg-slate-900/[0.04] py-3 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-900/[0.06]"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
