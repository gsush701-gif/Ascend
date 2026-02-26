import { Link } from "react-router-dom";
import { PublicShell } from "../components/layout/PublicShell";
import { Reveal } from "../components/ui/Reveal";
import { Button } from "../components/ui/Button";
import { card } from "../lib/ui";
import { cn } from "../lib/cn";

export function Landing() {
  return (
    <PublicShell>
      <div className="space-y-28 pb-10">
        {/* HERO */}
        <section className="pt-6 text-center">
          <Reveal>
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-4 py-2 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              Ascend
              <span className="ml-2 rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-white/60">
                Beta
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight">
              Your career, <span className="gradient-text">elevated</span>
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/65">
              Manage every internship role from analysis to outcome. One place
              for alignment, gaps, and tracking.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/signup" className="w-full sm:w-auto">
                <Button variant="primary" className="w-full">
                  Start free
                </Button>
              </Link>
              <Link to="/dashboard" className="w-full sm:w-auto">
                <Button variant="secondary" className="w-full">
                  View Demo
                </Button>
              </Link>
              <a href="#preview" className="w-full sm:w-auto">
                <Button variant="secondary" className="w-full">
                  See product preview
                </Button>
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.24}>
            <div className={cn("mx-auto mt-10 max-w-3xl p-4", card)}>
              <div className="rounded-xl border border-white/5 bg-dash-surface p-4">
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/70">
                  <Badge>Alignment score</Badge>
                  <Badge>Skill gaps</Badge>
                  <Badge>Action plan</Badge>
                  <Badge>Application tracker</Badge>
                  <Badge>Deadlines</Badge>
                </div>
                <div className="shimmer-line mt-4 h-[2px] w-full rounded-full opacity-70" />
                <div className="mt-4 text-center text-xs text-white/55">
                  Built for students who want structure, not guesswork.
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* PROBLEM → SOLUTION */}
        <section className="grid gap-6 md:grid-cols-2 md:gap-10">
          <Reveal>
            <div className={cn("p-8", card)}>
              <h2 className="text-2xl font-semibold">The problem</h2>
              <ul className="mt-6 space-y-4 text-white/70">
                <li>• Applying without knowing if your resume matches the role</li>
                <li>• No clear feedback on missing skills or priorities</li>
                <li>• Applications scattered across emails, notes, and tabs</li>
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className={cn("p-8", card)}>
              <h2 className="text-2xl font-semibold">The system</h2>
              <ul className="mt-6 space-y-4 text-white/70">
                <li>• Score alignment against real job descriptions</li>
                <li>• Identify skill gaps and what to improve first</li>
                <li>• Track status, deadlines, and outcomes in one place</li>
              </ul>
            </div>
          </Reveal>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="text-center">
          <Reveal>
            <h2 className="text-2xl font-semibold">How it works</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/60">
              Three steps. Clear output. No fluff.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Reveal>
              <StepCard
                title="1. Analyze a role"
                desc="Upload your resume and paste a job description."
              />
            </Reveal>
            <Reveal delay={0.06}>
              <StepCard
                title="2. Improve alignment"
                desc="See missing skills and a short action plan."
              />
            </Reveal>
            <Reveal delay={0.12}>
              <StepCard
                title="3. Track applications"
                desc="Manage deadlines, status, and notes."
              />
            </Reveal>
          </div>
        </section>

        {/* PRODUCT PREVIEW MOCKUP */}
        <section id="preview" className="space-y-8">
          <Reveal>
            <div className="text-center">
              <h2 className="text-2xl font-semibold">Product preview</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-white/60">
                This is the experience: dashboard overview, alignment
                intelligence, and tracking in one platform.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <ProductMock />
          </Reveal>
        </section>

        {/* FINAL CTA */}
        <section id="cta" className="text-center">
          <Reveal>
            <div className={cn("p-10", card)}>
              <h2 className="text-2xl font-semibold text-white md:text-3xl">
                Manage every internship role from analysis to outcome.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-white/50">
                One place for each role: alignment, skill gaps, improvements,
                and tracking.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/signup" className="w-full sm:w-auto">
                  <Button variant="primary" className="w-full">
                    Get started
                  </Button>
                </Link>
                <Link to="/login" className="w-full sm:w-auto">
                  <Button variant="secondary" className="w-full">
                    I already have an account
                  </Button>
                </Link>
                <Link to="/dashboard" className="w-full sm:w-auto">
                  <Button variant="secondary" className="w-full">
                    View Demo
                  </Button>
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </PublicShell>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-white/70">
      {children}
    </span>
  );
}

function StepCard({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className={cn("p-8 transition hover:bg-white/[0.07]", card)}>
      <div className="text-lg font-semibold">{title}</div>
      <div className="mt-4 text-sm text-white/65">{desc}</div>
    </div>
  );
}

function ProductMock() {
  return (
    <div className={card}>
      {/* Top bar */}
      <div className="flex items-center justify-between rounded-xl border border-white/5 bg-dash-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-white/50" />
          <div className="h-2 w-2 rounded-full bg-white/30" />
          <div className="h-2 w-2 rounded-full bg-white/20" />
          <div className="ml-3 text-xs text-white/50">Ascend • Dashboard</div>
        </div>
        <div className="text-xs text-white/50">Preview</div>
      </div>

      {/* Mock content */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-xl border border-white/5 bg-dash-surface p-6 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-white/50">Fit score</div>
            <div className="mt-3 flex items-end gap-4">
              <div className="text-5xl font-semibold tracking-tight text-cyan-400">72%</div>
              <div className="pb-2 text-sm text-white">Strong</div>
            </div>
            <p className="mt-1 text-xs text-white/50">
              Based on resume vs job requirements
            </p>
            <div className="mt-4 h-2 rounded-full bg-dash-card">
              <div className="h-2 w-[72%] rounded-full bg-cyan-500" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <MiniStat label="Apps sent" value="14" />
            <MiniStat label="Interview rate" value="21%" />
            <MiniStat label="Interviews" value="3" />
          </div>

          <div className="rounded-xl border border-white/5 bg-dash-surface p-6">
            <div className="text-sm font-semibold text-white">Upcoming deadlines</div>
            <div className="mt-4 space-y-3">
              <Row left="Google SWE Intern" right="3 days" />
              <Row left="Backend Intern" right="6 days" />
              <Row left="Data Analyst Intern" right="10 days" />
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border border-white/5 bg-dash-surface p-6">
            <div className="text-sm font-semibold text-white">By status</div>
            <div className="mt-4 space-y-3">
              <StatusRow label="Applied" count={4} pct={29} />
              <StatusRow label="Interview" count={9} pct={64} />
              <StatusRow label="Rejected" count={1} pct={7} />
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-dash-surface p-6">
            <div className="text-sm font-semibold text-white">Next actions</div>
            <div className="mt-4 space-y-3">
              <ActionItem
                title="Analyze a new job"
                desc="Get missing skills + score"
              />
              <ActionItem
                title="Add an application"
                desc="Track status and deadlines"
              />
              <ActionItem
                title="Upgrade bullets"
                desc="Add impact + metrics"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-dash-surface p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-wide text-white/50">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-dash-surface p-4 text-sm">
      <span className="text-white">{left}</span>
      <span className="text-white/50">{right}</span>
    </div>
  );
}

function StatusRow({ label, count, pct }: { label: string; count: number; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-white/50">
        <span>{label}</span>
        <span>{count}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-dash-card">
        <div
          className="h-2 rounded-full bg-cyan-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ActionItem({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-dash-surface p-4 shadow-sm transition hover:bg-white/[0.04]">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-xs text-white/50">{desc}</div>
    </div>
  );
}
