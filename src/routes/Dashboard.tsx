import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { OnboardingModal } from "../components/onboarding/OnboardingModal";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { isOnboardingDone } from "../lib/onboarding";

export function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { tracker: items } = useTracker(undefined);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading && !isOnboardingDone()) setShowOnboarding(true);
  }, [loading]);

  const lastRole = items[0] ?? null;
  const rolesToImprove = items.filter(
    (i) => (i.reportSnapshot?.missingSignals?.length ?? 0) > 0
  ).length;
  const withNextStep = items.filter((i) => i.nextStep && i.nextStep !== "Apply today").length;

  return (
    <AppShell>
      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}

      <div className="space-y-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              Control center
            </h1>
            <p className="mt-1 text-sm text-white/60">
              What to do next.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/analyzer")}
            className="btn-press card-hover-lift inline-flex w-full justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90 sm:w-auto"
          >
            New role
          </button>
        </header>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/5"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {lastRole && (
            <ActionCard
              title="Continue last analysis"
              body={`${lastRole.role} at ${lastRole.company}`}
              cta="Open role"
              onClick={() => navigate(`/roles/${lastRole.id}`)}
            />
            )}
            <ActionCard
              title={rolesToImprove > 0 ? "Roles to improve" : "No gaps yet"}
              body={
                rolesToImprove > 0
                  ? `You have ${rolesToImprove} role${rolesToImprove !== 1 ? "s" : ""} with skill gaps.`
                  : "All your roles are analyzed. Add more to improve."
              }
              cta="View roles"
              onClick={() => navigate("/roles")}
            />
            <ActionCard
              title={withNextStep > 0 ? "Follow-ups" : "Next steps"}
              body={
                withNextStep > 0
                  ? `${withNextStep} application${withNextStep !== 1 ? "s" : ""} with a next step.`
                  : "Set next steps on your roles to stay on track."
              }
              cta="View roles"
              onClick={() => navigate("/roles")}
            />
          </div>
        )}

        {!loading && items.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <span className="text-white/60">
                Applications tracked{" "}
                <span className="font-semibold text-white">{items.length}</span>
              </span>
              <span className="text-white/60">
                Roles analyzed{" "}
                <span className="font-semibold text-white">
                  {items.filter((i) => i.reportSnapshot).length}
                </span>
              </span>
            </div>
          </section>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
            <p className="text-white/80">
              Manage every internship role from analysis to outcome.
            </p>
            <p className="mt-2 text-sm text-white/55">
              Paste a job description, get your alignment and gaps, then track
              the application—all in one place.
            </p>
            <button
              type="button"
              onClick={() => navigate("/analyzer")}
              className="btn-press mt-6 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Add your first role
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ActionCard({
  title,
  body,
  cta,
  onClick,
}: {
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-hover-lift btn-press w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition hover:bg-white/[0.07]"
    >
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm text-white/60 line-clamp-2">{body}</p>
      <span className="mt-4 inline-block text-xs font-medium text-white/80">
        {cta} →
      </span>
    </button>
  );
}

