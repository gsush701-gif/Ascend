import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Target,
  ListChecks,
  Sparkles,
  ClipboardList,
  LineChart,
  Share2,
} from "lucide-react";
import { PublicShell } from "../components/layout/PublicShell";
import { Reveal } from "../components/ui/Reveal";
import { Button } from "../components/ui/Button";
import { AlignmentChart } from "../components/ui/AlignmentChart";
import { AnimatedBar } from "../components/ui/AnimatedBar";
import { card } from "../lib/ui";
import { cn } from "../lib/cn";

export function Landing() {
  return (
    <PublicShell>
      <div className="space-y-28 pb-10">
        {/* HERO */}
        <section className="pt-6 text-center">
          <Reveal>
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-900/[0.04] px-4 py-2 text-xs text-slate-600">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              Ascend
              <span className="ml-2 rounded-full border border-slate-200 bg-slate-900/5 px-2 py-0.5 text-[10px] text-slate-500">
                Beta
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="font-display mx-auto mt-6 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Your career, <span className="gradient-text">elevated</span>
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
              Manage every internship role from analysis to outcome. Score your
              fit, close skill gaps, rewrite weak resume bullets with AI, and
              track every application in one place.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/signup" className="w-full sm:w-auto">
                <Button variant="primary" className="w-full">
                  Start free
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
            <HeroPreview />
          </Reveal>
        </section>

        {/* PROBLEM → SOLUTION */}
        <section className="grid gap-6 md:grid-cols-2 md:gap-10">
          <Reveal>
            <div className={cn("p-8", card)}>
              <h2 className="font-display text-2xl font-semibold tracking-tight">The problem</h2>
              <ul className="mt-6 space-y-4 text-slate-600">
                <li>• Applying without knowing if your resume matches the role</li>
                <li>• No clear feedback on missing skills or priorities</li>
                <li>• Weak, generic resume bullets that undersell your work</li>
                <li>• Applications scattered across emails, notes, and tabs</li>
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className={cn("p-8", card)}>
              <h2 className="font-display text-2xl font-semibold tracking-tight">The system</h2>
              <ul className="mt-6 space-y-4 text-slate-600">
                <li>• Score alignment against real job descriptions</li>
                <li>• Identify skill gaps and what to improve first</li>
                <li>• Rewrite bullets with AI — add metrics, clarity, impact</li>
                <li>• Track status, deadlines, and outcomes in one place</li>
              </ul>
            </div>
          </Reveal>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="text-center">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight">How it works</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">
              Four steps. Clear output. No fluff.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Reveal>
              <StepCard
                title="1. Analyze a role"
                desc="Upload your resume and paste a job description."
              />
            </Reveal>
            <Reveal delay={0.06}>
              <StepCard
                title="2. See your fit score"
                desc="Get an alignment score plus the missing skills holding it back."
              />
            </Reveal>
            <Reveal delay={0.12}>
              <StepCard
                title="3. Rewrite with AI"
                desc="Turn weak bullets into clear, metric-driven ones in Resume Lab."
              />
            </Reveal>
            <Reveal delay={0.18}>
              <StepCard
                title="4. Track applications"
                desc="Manage deadlines, status, and notes for every role."
              />
            </Reveal>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="text-center">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Everything in one place
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">
              Every feature below is live in the product today.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Reveal>
              <FeatureCard
                icon={Target}
                title="Fit score analysis"
                desc="Upload a resume and a job description to get an alignment score based on real requirements — not a guess."
              />
            </Reveal>
            <Reveal delay={0.05}>
              <FeatureCard
                icon={ListChecks}
                title="Skill gap detection"
                desc="See exactly which core and preferred skills are missing, plus a short list of actions to close the gap."
              />
            </Reveal>
            <Reveal delay={0.1}>
              <FeatureCard
                icon={Sparkles}
                title="AI resume rewriting"
                desc="Resume Lab rewrites a single bullet or critiques a full resume — adding metrics, clarity, and technical depth."
              />
            </Reveal>
            <Reveal delay={0.15}>
              <FeatureCard
                icon={ClipboardList}
                title="Role tracker"
                desc="Log every application, track status from Wishlist to Offer, and keep notes and deadlines in one table."
              />
            </Reveal>
            <Reveal delay={0.2}>
              <FeatureCard
                icon={LineChart}
                title="Dashboard & readiness"
                desc="Fit score trend, interview outlook, and a readiness breakdown across resume, projects, and interview prep."
              />
            </Reveal>
            <Reveal delay={0.25}>
              <FeatureCard
                icon={Share2}
                title="Shareable profile"
                desc="Generate a link to share your top skills and resume strength with a mentor or peer."
              />
            </Reveal>
          </div>
        </section>

        {/* PRODUCT PREVIEW MOCKUP */}
        <section id="preview" className="space-y-8">
          <Reveal>
            <div className="text-center">
              <h2 className="font-display text-2xl font-semibold tracking-tight">Product preview</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500">
                This is the experience: dashboard overview, alignment
                intelligence, and tracking in one platform.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <ProductMock />
          </Reveal>
        </section>

        {/* WHO IT'S FOR */}
        <section className="text-center">
          <Reveal>
            <div className={cn("mx-auto max-w-3xl p-8", card)}>
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Built for students actively job hunting
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-slate-600">
                Ascend is for students and new grads applying to internships and
                entry-level roles who want a structured way to check fit, close
                gaps, and keep track of every application — instead of guessing
                and juggling spreadsheets.
              </p>
              <div className="mx-auto mt-6 grid max-w-xl gap-4 sm:grid-cols-3">
                <WhoForItem text="Applying to multiple internships" />
                <WhoForItem text="Rewriting a resume for each role" />
                <WhoForItem text="Tracking outcomes across companies" />
              </div>
            </div>
          </Reveal>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl">
          <Reveal>
            <div className="text-center">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Frequently asked questions
              </h2>
            </div>
          </Reveal>

          <div className="mt-10 space-y-4">
            <Reveal>
              <FaqItem
                q="Is Ascend free?"
                a="Yes. Every feature — fit scoring, skill gap detection, AI resume rewriting, and role tracking — is free during the beta. There's no paid tier yet."
              />
            </Reveal>
            <Reveal delay={0.05}>
              <FaqItem
                q="Do I need to upload a resume to use it?"
                a="No. You can paste a job description alone to see core skills, preferred skills, and preparation signals. Adding a resume unlocks your fit score."
              />
            </Reveal>
            <Reveal delay={0.1}>
              <FaqItem
                q="How is the fit score calculated?"
                a="It compares your resume against the skills and requirements parsed from the job description you paste in — the same signals shown in the skill gap breakdown."
              />
            </Reveal>
            <Reveal delay={0.15}>
              <FaqItem
                q="What does Resume Lab actually do?"
                a="It uses AI to rewrite a single bullet — or critique a full uploaded resume — adding measurable impact, clarity, and technical detail. Nothing is uploaded until you click Improve."
              />
            </Reveal>
            <Reveal delay={0.2}>
              <FaqItem
                q="Is my data tied to my account?"
                a="Yes — your tracked roles, resume improvements, and analysis history are saved to your account and available whenever you log back in."
              />
            </Reveal>
          </div>
        </section>

        {/* FINAL CTA */}
        <section id="cta" className="text-center">
          <Reveal>
            <div className={cn("p-10", card)}>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                Manage every internship role from analysis to outcome.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-slate-500">
                One place for each role: alignment, skill gaps, AI-rewritten
                bullets, and tracking.
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
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </PublicShell>
  );
}

/* ---------------------------------------------------------------------- */
/* Hero preview: bigger animated visual, built from real product pieces   */
/* ---------------------------------------------------------------------- */

const HERO_TREND: { alignment: number; createdAt: string }[] = [
  { alignment: 41, createdAt: "2026-06-02" },
  { alignment: 48, createdAt: "2026-06-16" },
  { alignment: 55, createdAt: "2026-06-30" },
  { alignment: 61, createdAt: "2026-07-14" },
  { alignment: 69, createdAt: "2026-07-28" },
  { alignment: 78, createdAt: "2026-08-11" },
];

function HeroPreview() {
  const fit = useCountUp(78, 1100, 250);
  const apps = useCountUp(14, 1100, 250);
  const rate = useCountUp(21, 1100, 250);
  const interviews = useCountUp(3, 1100, 250);

  return (
    <div className={cn("mx-auto mt-10 max-w-3xl p-6 text-left", card)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="h-2 w-2 rounded-full bg-cyan-400" />
          Ascend • Live preview
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-900/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
          Sample data
        </span>
      </div>

      <div className="mt-5 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Fit score</div>
          <div className="mt-1 flex items-end gap-2">
            <span className="font-display gradient-text text-5xl font-semibold tracking-tight">
              {fit}%
            </span>
            <span className="pb-1.5 text-sm text-slate-500">Strong</span>
          </div>
          <div className="mt-3 w-40">
            <AnimatedBar pct={fit} gradient="linear-gradient(90deg, #22d3ee, #a78bfa)" />
          </div>
        </div>

        <div>
          <AlignmentChart points={HERO_TREND} height={128} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-200 pt-5">
        <HeroStat label="Apps sent" value={String(apps)} />
        <HeroStat label="Interview rate" value={`${rate}%`} />
        <HeroStat label="Interviews" value={String(interviews)} />
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-dash-surface p-3 text-center shadow-sm">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

/** Counts up to `target` with ease-out on mount, after an optional delay. No new deps — plain interval ticks. */
function useCountUp(target: number, duration = 1000, delay = 0) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const stepMs = 30;
    let elapsed = 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    const timer = setTimeout(() => {
      interval = setInterval(() => {
        elapsed += stepMs;
        const p = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(Math.round(target * eased));
        if (p >= 1 && interval) {
          clearInterval(interval);
        }
      }, stepMs);
    }, delay);
    return () => {
      clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [target, duration, delay]);

  return value;
}

/* ---------------------------------------------------------------------- */

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
      <div className="mt-4 text-sm text-slate-600">{desc}</div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
}) {
  return (
    <div className={cn("h-full p-6 text-left transition hover:bg-white/[0.07]", card)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600">
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <div className="mt-4 text-base font-semibold text-slate-900">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</div>
    </div>
  );
}

function WhoForItem({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-dash-surface px-3 py-3 text-sm text-slate-700">
      {text}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className={cn("p-5 text-left", card)}>
      <div className="text-sm font-semibold text-slate-900">{q}</div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{a}</p>
    </div>
  );
}

function ProductMock() {
  return (
    <div className={card}>
      {/* Top bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-dash-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-slate-400" />
          <div className="h-2 w-2 rounded-full bg-slate-300" />
          <div className="h-2 w-2 rounded-full bg-slate-900/10" />
          <div className="ml-3 text-xs text-slate-500">Ascend • Dashboard</div>
        </div>
        <div className="text-xs text-slate-500">Preview</div>
      </div>

      {/* Mock content */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-dash-surface p-6 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Fit score</div>
            <div className="mt-3 flex items-end gap-4">
              <div className="text-5xl font-semibold tracking-tight text-cyan-600">72%</div>
              <div className="pb-2 text-sm text-slate-900">Strong</div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
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

          <div className="rounded-xl border border-slate-200 bg-dash-surface p-6">
            <div className="text-sm font-semibold text-slate-900">Fit score trend</div>
            <div className="mt-4">
              <AlignmentChart points={HERO_TREND} height={100} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-dash-surface p-6">
            <div className="text-sm font-semibold text-slate-900">Upcoming deadlines</div>
            <div className="mt-4 space-y-3">
              <Row left="Google SWE Intern" right="3 days" />
              <Row left="Backend Intern" right="6 days" />
              <Row left="Data Analyst Intern" right="10 days" />
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-dash-surface p-6">
            <div className="text-sm font-semibold text-slate-900">By status</div>
            <div className="mt-4 space-y-3">
              <StatusRow label="Applied" count={4} pct={29} />
              <StatusRow label="Interview" count={9} pct={64} />
              <StatusRow label="Rejected" count={1} pct={7} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-dash-surface p-6">
            <div className="text-sm font-semibold text-slate-900">Readiness breakdown</div>
            <div className="mt-4 space-y-3">
              <ReadinessRow label="Resume strength" pct={72} />
              <ReadinessRow label="Projects" pct={58} />
              <ReadinessRow label="Interview prep" pct={40} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-dash-surface p-6">
            <div className="text-sm font-semibold text-slate-900">Next actions</div>
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
    <div className="rounded-xl border border-slate-200 bg-dash-surface p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-dash-surface p-4 text-sm">
      <span className="text-slate-900">{left}</span>
      <span className="text-slate-500">{right}</span>
    </div>
  );
}

function StatusRow({ label, count, pct }: { label: string; count: number; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500">
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

function ReadinessRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-dash-card">
        <div
          className="h-2 rounded-full bg-violet-500"
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
    <div className="rounded-xl border border-slate-200 bg-dash-surface p-4 shadow-sm transition hover:bg-white/[0.04]">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{desc}</div>
    </div>
  );
}
