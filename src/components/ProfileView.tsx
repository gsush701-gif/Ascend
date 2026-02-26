import type { SharedProfileData } from "../types/analyzer";

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/60 px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onBack();
            }}
            className="text-sm font-semibold text-zinc-400 hover:text-zinc-200"
          >
            ← Ascend
          </a>
          <span className="text-xs text-zinc-500">{baseUrl}</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold text-zinc-100">{username}</h1>
        <p className="mt-1 text-sm text-zinc-500">Shared resume profile</p>

        <div className="mt-8 space-y-6">
          <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Top skills
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.skills.length > 0 ? (
                data.skills.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-sm text-zinc-200"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-sm text-zinc-500">None shared yet</span>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Resume strength
            </h2>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-100">
                {data.strength}/100
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Alignment history
            </h2>
            <div className="mt-3 space-y-2">
              {data.history.length > 0 ? (
                data.history.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm"
                  >
                    <span className="text-zinc-300">
                      {new Date(h.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="font-semibold text-zinc-100">
                      {h.alignment}%
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-sm text-zinc-500">No analyses yet</span>
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
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800/60"
          >
            Create your own →
          </a>
        </div>
      </main>
    </div>
  );
}
