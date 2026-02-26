import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  saveOnboardingData,
  type OnboardingData,
} from "../../lib/onboarding";

type OnboardingModalProps = {
  onComplete: () => void;
};

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const navigate = useNavigate();
  const [major, setMajor] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [graduationYear, setGraduationYear] = useState("");

  const handleSkip = () => {
    saveOnboardingData({ major: "Skipped", targetRole: "Skipped", graduationYear: "Skipped" });
    onComplete();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        saveOnboardingData({ major: "Skipped", targetRole: "Skipped", graduationYear: "Skipped" });
        onComplete();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onComplete]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: OnboardingData = {
      major: major.trim() || "Not specified",
      targetRole: targetRole.trim() || "Not specified",
      graduationYear: graduationYear.trim() || "Not specified",
    };
    saveOnboardingData(data);
    onComplete();
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0c0e12] p-8 shadow-2xl">
        <h2 className="text-2xl font-semibold text-white">
          Welcome to Ascend
        </h2>
        <p className="mt-2 text-sm text-white/60">
          A few details help us personalize your experience.
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="block text-xs font-medium text-white/60">
              Major / Field
            </label>
            <input
              type="text"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              placeholder="e.g. Computer Science"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60">
              Target role
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. SWE Intern, Data Analyst"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60">
              Graduation year
            </label>
            <input
              type="text"
              value={graduationYear}
              onChange={(e) => setGraduationYear(e.target.value)}
              placeholder="e.g. 2026"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="btn-press flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Get started
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="btn-press rounded-xl border border-white/20 bg-white/5 py-3 px-4 text-sm font-medium text-white/70 transition hover:bg-white/10"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
