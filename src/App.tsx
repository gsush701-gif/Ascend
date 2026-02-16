import { useMemo, useState } from "react";

type Skill = { name: string; status: "hit" | "miss" };

type Report = {
  alignment: number;
  coverage: number;
  roleTitle: string;
  skills: Skill[];
  missingSignals: string[];
  actions: string[];
};

const mockReport: Report = {
  alignment: 64,
  coverage: 66,
  roleTitle: "Software Engineer Internship",
  skills: [
    { name: "Python", status: "hit" },
    { name: "REST APIs", status: "miss" },
    { name: "SQL", status: "hit" },
    { name: "AWS", status: "miss" },
    { name: "Data Structures", status: "hit" },
    { name: "Git", status: "hit" },
  ],
  missingSignals: [
    "No deployment experience mentioned",
    "No quantified backend impact",
  ],
  actions: [
    "Build one REST API project",
    "Deploy to AWS or Render",
    "Add metrics to backend bullet points",
  ],
};

export default function App() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [report, setReport] = useState<Report | null>(null);

  const canAnalyze = useMemo(
    () => !!resumeFile && jd.trim().length > 20,
    [resumeFile, jd],
  );

  async function onAnalyze() {
    if (!resumeFile) return;

    try {
      setReport(null);

      const formData = new FormData();
      formData.append("resume", resumeFile);
      formData.append("jd", jd);

      const res = await fetch("http://localhost:5050/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Analyze failed");
        return;
      }

      setReport(data);
    } catch (err) {
      console.error(err);
      alert("Could not reach backend. Is server running on :5050?");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <TopBar />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Inputs */}
          <section className="lg:col-span-4 space-y-4">
            <Panel title="Your Resume">
              <label className="block">
                <div className="text-sm text-zinc-300 mb-2">Upload PDF</div>
                <input
                  type="file"
                  accept="application/pdf"
                  className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200 hover:file:bg-zinc-700"
                  onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                />
              </label>

              <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="text-xs text-zinc-400">Selected</div>
                <div className="text-sm mt-1">
                  {resumeFile ? resumeFile.name : "No file selected"}
                </div>
              </div>
            </Panel>

            <Panel title="Job Description">
              <textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the job description here…"
                className="min-h-44 w-full rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm outline-none focus:ring-2 focus:ring-zinc-600"
              />
              <button
                onClick={onAnalyze}
                disabled={!canAnalyze}
                className="mt-3 w-full rounded-xl bg-zinc-200 px-4 py-2 text-zinc-900 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Analyze Alignment
              </button>
              <div className="mt-2 text-xs text-zinc-500">
                V1 shows a demo report. Next we’ll connect a backend.
              </div>
            </Panel>
          </section>

          {/* Report */}
          <section className="lg:col-span-8">
            <Panel title="InternOS Alignment Report">
              {!report ? (
                <EmptyState />
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <div className="text-zinc-400 text-sm">
                        Overall Alignment
                      </div>
                      <div className="text-4xl font-semibold tracking-tight">
                        {report.alignment}%
                      </div>
                    </div>

                    <div className="min-w-[260px]">
                      <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                        <span>Skill Coverage</span>
                        <span>{report.coverage}%</span>
                      </div>
                      <ProgressBar value={report.coverage} />
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                      <div className="text-sm font-medium mb-3">
                        Core Skills Match
                      </div>
                      <ul className="space-y-2">
                        {report.skills.map((s) => (
                          <li
                            key={s.name}
                            className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-950/30 px-3 py-2"
                          >
                            <span className="text-sm">{s.name}</span>
                            <Badge status={s.status} />
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                      <div className="text-sm font-medium mb-2">
                        {report.roleTitle}
                      </div>
                      <div className="text-sm text-zinc-400 leading-relaxed">
                        This panel will later show extracted requirements from
                        the job description (required skills, preferred skills,
                        responsibilities).
                      </div>

                      <div className="mt-4">
                        <div className="text-sm font-medium mb-2">
                          Recommended Actions
                        </div>
                        <ul className="space-y-2 text-sm">
                          {report.actions.map((a) => (
                            <li
                              key={a}
                              className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 px-3 py-2"
                            >
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                    <div className="text-sm font-medium mb-2">
                      Missing High-Priority Signals
                    </div>
                    <ul className="space-y-2 text-sm text-zinc-200">
                      {report.missingSignals.map((m) => (
                        <li key={m} className="flex items-start gap-2">
                          <span className="mt-0.5 text-amber-300">⚠</span>
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </Panel>
          </section>
        </div>
      </main>
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-900 bg-zinc-950/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-zinc-800 grid place-items-center text-zinc-100 font-semibold">
            ⬡
          </div>
          <div>
            <div className="font-semibold leading-none">InternOS</div>
            <div className="text-xs text-zinc-400">
              Job-Alignment Intelligence
            </div>
          </div>
        </div>

        <div className="text-sm text-zinc-300">
          <span className="rounded-lg border border-zinc-800 px-3 py-1.5">
            Analyzer
          </span>
        </div>
      </div>
    </header>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-zinc-900 bg-zinc-950/30 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="border-b border-zinc-900 px-5 py-4">
        <div className="text-sm font-medium text-zinc-200">{title}</div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/20 p-10 text-center">
      <div className="text-xl font-semibold">
        Upload a resume + paste a job description
      </div>
      <div className="mt-2 text-sm text-zinc-400">
        InternOS will generate an alignment report and action plan.
      </div>
    </div>
  );
}

function Badge({ status }: { status: "hit" | "miss" }) {
  return status === "hit" ? (
    <span className="inline-flex items-center gap-2 text-emerald-300">
      <span className="h-5 w-5 rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/40 grid place-items-center">
        ✓
      </span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 text-rose-300">
      <span className="h-5 w-5 rounded-full bg-rose-500/15 ring-1 ring-rose-500/40 grid place-items-center">
        ✕
      </span>
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
      <div className="h-full bg-zinc-200/80" style={{ width: `${value}%` }} />
    </div>
  );
}
