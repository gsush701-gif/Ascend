import type { SharedProfileData } from "../types/analyzer";
import { AscendLogo } from "./layout/AscendLogo";
import { BackgroundFX } from "./layout/BackgroundFX";
import { card, badge } from "../lib/ui";
import { cn } from "../lib/cn";

type ProfileViewProps = {
  username: string;
  data: SharedProfileData;
  onBack: () => void;
};

export function ProfileView({ username, data, onBack }: ProfileViewProps) {
  const baseUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${username}`
      : "";

  return (
    <div className="min-h-screen bg-[#F4F5FA] text-slate-900">
      <BackgroundFX />
      <header className="relative border-b border-slate-200 bg-[#F4F5FA]/95 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onBack();
            }}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <AscendLogo className="h-6 w-auto" />
            Ascend
          </a>
          <span className="text-xs text-slate-500">{baseUrl}</span>
        </div>
      </header>
      <main className="relative mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
          {username}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Shared resume profile</p>

        <div className="mt-8 space-y-6">
          <section className={cn("p-5", card)}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Top skills
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.skills.length > 0 ? (
                data.skills.map((s, i) => (
                  <span key={i} className={badge}>
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">None shared yet</span>
              )}
            </div>
          </section>

          <section className={cn("p-5", card)}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Resume strength
            </h2>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-2xl font-semibold text-slate-900">
                {data.strength}/100
              </span>
            </div>
          </section>

          <section className={cn("p-5", card)}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Alignment history
            </h2>
            <div className="mt-3 space-y-2">
              {data.history.length > 0 ? (
                data.history.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-dash-surface px-3 py-2 text-sm"
                  >
                    <span className="text-slate-500">
                      {new Date(h.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {h.alignment}%
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-sm text-slate-500">No analyses yet</span>
              )}
            </div>
          </section>
        </div>

        <div className="mt-10 text-center">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onBack();
            }}
            className="btn-press inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-900/[0.04] px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-900/[0.06]"
          >
            Create your own →
          </a>
        </div>
      </main>
    </div>
  );
}
