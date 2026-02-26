import type {
  Report,
  ResumeStrength,
  ResumeStrengthSignals,
  SignalState,
  ConfidenceLevel,
  RoleDifficulty,
} from "../../types/analyzer";

export function getSignalWhyItMatters(sig: string): string {
  const t = sig.toLowerCase();
  if (t.includes("deployment") || t.includes("hosting"))
    return "Recruiters expect production exposure.";
  if (t.includes("quantified") || t.includes("numbers") || t.includes("metrics"))
    return "Numbers show impact and get you past screens.";
  if (t.includes("github"))
    return "GitHub proves you can ship real code.";
  return "Addressing this strengthens your profile.";
}

export function getRoleDifficulty(
  report: Report | null,
  jd: string
): RoleDifficulty | null {
  if (!report) return null;
  const skillsCount = report.skills.length;
  const jdLength = jd.trim().length;
  const requirementsCount = skillsCount + report.missingSignals.length;
  if (skillsCount <= 6 && jdLength < 2000) return "Entry-level";
  if (skillsCount >= 12 || jdLength > 4000 || requirementsCount >= 15)
    return "Highly competitive";
  return "Competitive";
}

export function getFixPlanForSignal(sig: string): { action: string; days: number } {
  const t = sig.toLowerCase();
  if (t.includes("rest") || t.includes("api") || t.includes("backend"))
    return { action: "1 project (e.g. small REST API)", days: 5 };
  if (t.includes("testing") || t.includes("unit") || t.includes("test"))
    return { action: "Add unit tests to existing project", days: 2 };
  if (t.includes("deployment") || t.includes("hosting") || t.includes("deploy"))
    return { action: "Deploy to Render / Vercel / Netlify", days: 1 };
  if (t.includes("github") || t.includes("version control"))
    return { action: "Add repo link + clean README", days: 1 };
  if (t.includes("quantified") || t.includes("metrics") || t.includes("numbers"))
    return { action: "Add % and numbers to 3+ bullets", days: 2 };
  if (t.includes("project") || t.includes("portfolio"))
    return { action: "1 portfolio project with live demo", days: 5 };
  if (t.includes("react") || t.includes("frontend"))
    return { action: "1 small React project or component", days: 4 };
  if (t.includes("database") || t.includes("sql"))
    return { action: "Add DB to existing project or mini CRUD", days: 3 };
  return { action: "Address in resume and 1 concrete example", days: 3 };
}

export function getTangibleResumeExample(actionOrSignal: string): string {
  const t = actionOrSignal.toLowerCase();
  if (t.includes("deploy") || t.includes("hosting") || t.includes("production"))
    return "Deployed Express API to Render, handled 2k+ requests/day";
  if (t.includes("rest") || t.includes("api") || t.includes("backend"))
    return "Built REST API with Node/Express; 3 endpoints, JWT auth, used by 500+ users";
  if (t.includes("testing") || t.includes("unit") || t.includes("test"))
    return "Added unit tests (Jest); coverage 85%, caught 4 regressions pre-merge";
  if (t.includes("github") || t.includes("version") || t.includes("repo"))
    return "Open-sourced on GitHub (120+ stars); README, contributing guide, CI with GitHub Actions";
  if (t.includes("quantified") || t.includes("metrics") || t.includes("numbers") || t.includes("%"))
    return "Reduced load time by 40%; improved sign-up conversion from 2% to 5%";
  if (t.includes("react") || t.includes("frontend"))
    return "Shipped React dashboard; 8 reusable components, state with Context + hooks";
  if (t.includes("database") || t.includes("sql"))
    return "Designed PostgreSQL schema and migrations; 5 tables, indexes for main queries";
  if (t.includes("project") || t.includes("portfolio"))
    return "Side project: full-stack app (auth, CRUD, deploy); 200+ weekly active users";
  return "Added measurable outcome: e.g. 'Shipped X that led to Y result'";
}

const BULLET_VARIATIONS: Record<string, string[]> = {
  rest_api: [
    "Built REST API using Express and MongoDB, serving 2k+ monthly requests with 99% uptime.",
    "Developed RESTful API with Express/Node.js; handled 2k+ requests/month, 99% uptime.",
    "Built REST API (Express, MongoDB) serving 2k+ requests/month with 99% uptime.",
    "Created REST API using Node/Express; 2k+ monthly requests, JWT auth, error handling.",
    "Built scalable REST API (Express + MongoDB); 99% uptime, 2k+ requests/month.",
    "Developed REST API with Express; 2k+ monthly requests, 99% uptime, documented endpoints.",
    "Built REST API (Node/Express, MongoDB); 2k+ requests/month, rate limiting, 99% uptime.",
  ],
  react_frontend: [
    "Built React frontend with 12+ reusable components and Context state, improving page load by 30%.",
    "Developed React UI with 12+ components; Context state, 30% faster load, responsive design.",
    "Built React app with reusable components and hooks; reduced initial load by 30%.",
    "Created React dashboard with 12+ components; Context + custom hooks, 30% page load improvement.",
    "Developed React frontend; component library, state management, 30% performance gain.",
    "Built React SPA with 12+ components; lazy loading, 30% load improvement.",
    "Developed React UI (hooks, Context); 12+ components, 30% faster load time.",
  ],
  deploy: [
    "Deployed app to Render/Vercel with CI/CD; 99% uptime, 2k+ requests/month.",
    "Deployed to Vercel/Render with GitHub Actions; 99% uptime, 2k+ monthly requests.",
    "Set up deployment (Vercel/Render) with CI/CD; 99% uptime, 2k+ requests/month.",
    "Deployed app via Vercel; CI/CD from main, 99% uptime, 2k+ requests/month.",
    "Configured deployment (Render/Vercel) with CI/CD pipeline; 99% uptime.",
    "Deployed to production (Vercel/Render); automated builds, 2k+ requests/month.",
    "Set up Vercel/Render deployment with CI/CD; 99% uptime, 2k+ requests/month.",
  ],
  test: [
    "Added unit tests with Jest; 85% coverage, caught 4 regressions before production.",
    "Implemented Jest unit tests; 85% coverage, prevented 4 regressions pre-merge.",
    "Wrote unit tests (Jest); 85% coverage, caught 4 bugs before release.",
    "Added Jest tests for critical paths; 85% coverage, 4 regressions caught.",
    "Built test suite with Jest; 85% coverage, regression prevention.",
    "Implemented Jest unit tests; 85% coverage, 4 regressions caught pre-deploy.",
    "Added Jest tests; 85% coverage, 4 regressions prevented before production.",
  ],
  database: [
    "Designed and queried database (PostgreSQL/MongoDB); 5 tables, indexed for main flows.",
    "Built database layer (PostgreSQL); 5 tables, indexes, optimized main queries.",
    "Designed PostgreSQL schema and migrations; 5 tables, indexed for core flows.",
    "Implemented database layer (MongoDB/PostgreSQL); 5 tables, query optimization.",
    "Designed and maintained DB schema (PostgreSQL); 5 tables, indexes for key queries.",
    "Built database models and migrations; 5 tables, indexed for performance.",
    "Designed PostgreSQL schema; 5 tables, indexes for main access patterns.",
  ],
  fullstack: [
    "Built full-stack feature (API + UI + DB); shipped in 2 sprints, used by 500+ users.",
    "Developed full-stack feature end-to-end; API, UI, DB; 2 sprints, 500+ users.",
    "Shipped full-stack feature (API + frontend + DB); 2 sprints, 500+ active users.",
    "Built full-stack feature from DB to UI; shipped in 2 sprints, 500+ users.",
    "Developed full-stack feature (API, UI, DB); 2 sprints, used by 500+ users.",
    "Implemented full-stack feature; API + React + DB; 2 sprints, 500+ users.",
    "Built end-to-end feature (API, UI, DB); 2 sprints, 500+ users.",
  ],
  built_generic: [
    "{base} using modern stack, serving 1k+ users with measurable impact.",
    "{base}; shipped to 1k+ users, measurable impact.",
    "{base} with modern stack; 1k+ users, quantified results.",
    "{base}; scale (1k+ users), measurable outcomes.",
    "{base} — modern stack, 1k+ users, clear impact.",
    "{base}; deployed to 1k+ users with measurable impact.",
  ],
  implemented: [
    "{base}; reduced latency by 25% and improved reliability.",
    "{base}; 25% latency reduction, improved reliability.",
    "{base}; improved performance (25% faster) and reliability.",
    "{base}; 25% latency improvement, reliability gains.",
    "{base}; performance and reliability improvements.",
    "{base}; 25% faster, more reliable.",
  ],
  fallback: [
    "{base} — add tech stack, scale (e.g. 2k+ requests), and outcome (e.g. 99% uptime).",
    "{base}; consider adding tech stack, scale (2k+ requests), and measurable outcome.",
    "{base} — strengthen with: stack, scale (2k+ requests), impact (99% uptime).",
    "{base}; add: technology, scale metrics, outcome (e.g. 99% uptime).",
    "{base} — enhance with tech details, numbers, and impact.",
    "{base}; add quantified impact and tech stack.",
  ],
};

export function improveResumeBullet(bullet: string): string {
  const variations = getBulletImprovementVariations(bullet);
  return variations[0] ?? bullet;
}

export type BulletImprovementResult = {
  improved: string;
  why: string;
  stack: string;
  impact: string;
};

function getBulletImprovementVariations(bullet: string): string[] {
  const t = bullet.trim().toLowerCase();
  const base = bullet.trim();
  if (!t) return ["Add a bullet to improve (e.g. \"Built REST API\")."];

  if (t.includes("rest") || t.includes("api")) return BULLET_VARIATIONS.rest_api;
  if (t.includes("react") || t.includes("frontend")) return BULLET_VARIATIONS.react_frontend;
  if (t.includes("deploy") || t.includes("host")) return BULLET_VARIATIONS.deploy;
  if (t.includes("test") || t.includes("jest") || t.includes("unit")) return BULLET_VARIATIONS.test;
  if (t.includes("database") || t.includes("sql") || t.includes("mongodb") || t.includes("postgres"))
    return BULLET_VARIATIONS.database;
  if (t.includes("full-stack") || t.includes("full stack")) return BULLET_VARIATIONS.fullstack;

  if (t.includes("built") && t.length < 40)
    return BULLET_VARIATIONS.built_generic.map((s) => s.replace("{base}", base));
  if (t.includes("implemented") || t.includes("developed"))
    return BULLET_VARIATIONS.implemented.map((s) => s.replace("{base}", base));

  return BULLET_VARIATIONS.fallback.map((s) => s.replace("{base}", base));
}

export function getBulletImprovementDetails(bullet: string): BulletImprovementResult {
  const t = bullet.trim().toLowerCase();
  const all = getBulletImprovementVariations(bullet);
  const idx = Math.floor(Math.random() * all.length);
  const improved = all[idx] ?? bullet.trim();

  let stack = "—";
  let impact = "—";
  if (t.includes("rest") || t.includes("api")) {
    stack = "Express, MongoDB";
    impact = "2k+ requests, 99% uptime";
  } else if (t.includes("react") || t.includes("frontend")) {
    stack = "React, Context";
    impact = "30% page load improvement";
  } else if (t.includes("deploy") || t.includes("host")) {
    stack = "Render / Vercel, CI/CD";
    impact = "99% uptime, 2k+ requests/month";
  } else if (t.includes("test") || t.includes("jest")) {
    stack = "Jest";
    impact = "85% coverage, regressions caught";
  } else if (t.includes("database") || t.includes("sql") || t.includes("mongodb")) {
    stack = "PostgreSQL / MongoDB";
    impact = "Indexed queries, main flows";
  } else if (t.includes("full-stack") || t.includes("full stack")) {
    stack = "API + UI + DB";
    impact = "500+ users, 2 sprints";
  } else if (all[0] !== bullet.trim()) {
    stack = "Tech stack suggested";
    impact = "Scale + outcome suggested";
  }

  const why =
    improved === bullet.trim()
      ? "Add tech stack, scale (e.g. 2k+ requests), and a measurable outcome (e.g. 99% uptime) so recruiters see impact."
      : "Added clarity, technical depth, and quantified impact so the bullet stands out to ATS and recruiters.";

  return { improved, why, stack, impact };
}

export function getApplicationConfidence(
  report: Report,
  resumeStrength: ResumeStrength | null
): ConfidenceLevel {
  const alignmentScore =
    report.alignment >= 70 ? 2 : report.alignment >= 50 ? 1 : 0;
  const resumeScore =
    resumeStrength == null
      ? 1
      : resumeStrength.score >= 80
        ? 2
        : resumeStrength.score >= 60
          ? 1
          : 0;
  const missingPenalty =
    report.missingSignals.length === 0
      ? 2
      : report.missingSignals.length <= 2
        ? 1
        : 0;
  const total = alignmentScore + resumeScore + missingPenalty;
  if (total >= 5) return "High";
  if (total >= 3) return "Medium";
  return "Low";
}

export function getInterviewProbability(
  report: Report,
  resumeStrength: ResumeStrength | null,
  alignmentHistory: { alignment: number; createdAt: string }[]
): number {
  const alignmentComponent = report.alignment * 0.35;
  const strengthComponent =
    ((resumeStrength?.score ?? 50) / 100) * 25;
  const missingPenalty = Math.min(
    report.missingSignals.length * 5,
    25
  );
  let trendBonus = 0;
  if (alignmentHistory.length >= 2) {
    const latest = alignmentHistory[0].alignment;
    const prev = alignmentHistory[1].alignment;
    if (latest > prev) trendBonus = 10;
    else if (latest < prev) trendBonus = -5;
    else trendBonus = 2;
  }
  const raw =
    alignmentComponent +
    strengthComponent -
    missingPenalty +
    trendBonus;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function getRecruiterScan(
  report: Report,
  resumeStrength: ResumeStrength | null
): { notices: string[]; weaknesses: string[] } {
  const hits = report.skills.filter((s) => s.status === "hit");
  const notices: string[] = [];
  if (report.alignment >= 70) {
    notices.push(`${report.alignment}% alignment — strong fit at a glance.`);
  } else if (report.alignment >= 50) {
    notices.push(`${report.alignment}% alignment — maybe pile; skills need to pop more.`);
  } else {
    notices.push(`${report.alignment}% alignment — easy to pass unless keywords are obvious.`);
  }
  if (hits.length > 0) {
    const top = hits.slice(0, 2).map((s) => s.name).join(", ");
    notices.push(`Keywords that stand out: ${top}${hits.length > 2 ? " and more." : "."}`);
  }
  if (resumeStrength && resumeStrength.score >= 60) {
    const parts: string[] = [];
    if (resumeStrength.signals.quantifiedBullets === "linked") parts.push("numbers");
    if (resumeStrength.signals.github === "linked") parts.push("GitHub");
    if (resumeStrength.signals.deployment === "linked") parts.push("deployment");
    if (parts.length > 0) {
      notices.push(`Resume has ${parts.join(", ")} — looks substantive.`);
    }
  }
  if (report.roleTitle) {
    notices.push(`Role context: "${report.roleTitle.slice(0, 40)}${report.roleTitle.length > 40 ? "…" : ""}".`);
  }
  const weaknesses: string[] = [];
  report.missingSignals.slice(0, 3).forEach((s) => weaknesses.push(`Missing: ${s}`));
  if (report.coverage < 60 && weaknesses.length < 3) {
    weaknesses.push(`Low skill coverage (${report.coverage}%) — JD keywords not clearly reflected.`);
  }
  if (report.actions.length > 0 && weaknesses.length < 3) {
    const a = report.actions[0];
    if (!weaknesses.some((w) => w.includes(a.slice(0, 20)))) {
      weaknesses.push(a.length > 60 ? `${a.slice(0, 57)}…` : a);
    }
  }
  if (notices.length === 0) notices.push("Alignment and keyword visibility drive the first impression.");
  if (weaknesses.length === 0) weaknesses.push("Improve alignment and surface key skills so they're obvious in 6 seconds.");
  return {
    notices: notices.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
  };
}

export function computeResumeStrength(text: string): ResumeStrength {
  const t = text.toLowerCase();
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const bulletLine = /^[\s•\-*]\s*.{5,}/;
  const bulletLines = lines.filter((l) => bulletLine.test(l) || /^[\d.]+\s+.+/.test(l));
  const hasQuantifiedInBullets = bulletLines.some(
    (l) =>
      /\d+%|\d+x|\$\d|%\s|increased|decreased|reduced|saved|improved|by\s+\d|metrics|kpi|roi|\d+\+|\d+\s*(users|ms|sec|days)/i.test(l)
  );
  const quantifiedMentionedOnly = /metrics|kpi|roi|quantified|numbers/i.test(t) && !hasQuantifiedInBullets;
  const quantifiedBullets: SignalState = hasQuantifiedInBullets ? "linked" : quantifiedMentionedOnly ? "mentioned_only" : "absent";

  const hasGithubLink = /github\.com/i.test(t);
  const githubMentioned = /\bgithub\b/i.test(t);
  const github: SignalState = hasGithubLink ? "linked" : githubMentioned ? "mentioned_only" : "absent";

  const hasDeploymentUrl = /vercel|netlify|render\.com|heroku|railway|\.com\/|\.io\/|live\s+at\s+https?/i.test(t);
  const deploymentMentioned = /deploy|hosted|production|live\s*(at|url)/i.test(t);
  const deployment: SignalState = hasDeploymentUrl ? "linked" : deploymentMentioned ? "mentioned_only" : "absent";

  const projects =
    /project|experience|work\s+experience|side\s+project|personal\s+project|open\s+source/i.test(t) &&
    lines.some((l) => l.length > 15);
  const hasMetrics = /\d+%|\d+x|increased|decreased|reduced|improved|saved|\d+\s*(users|ms|sec|days)/i.test(t);
  const metricsMentionedOnly = /metrics|kpi|roi/i.test(t) && !hasMetrics;
  const metrics: SignalState = hasMetrics ? "linked" : metricsMentionedOnly ? "mentioned_only" : "absent";

  const signals: ResumeStrengthSignals = {
    quantifiedBullets,
    github,
    deployment,
    projects,
    metrics,
  };
  const count = [
    signals.quantifiedBullets === "linked",
    signals.github === "linked",
    signals.deployment === "linked",
    signals.projects,
    signals.metrics === "linked",
  ].filter(Boolean).length;
  const score = count * 20;
  return { score, signals };
}

export function getSignalDisplay(
  key: "github" | "deployment" | "metrics" | "quantifiedBullets",
  state: SignalState
): { icon: string; label: string; message: string } {
  const config: Record<
    typeof key,
    Record<SignalState, { icon: string; label: string; message: string }>
  > = {
    github: {
      linked: { icon: "✓", label: "GitHub", message: "GitHub profile linked — strong credibility signal." },
      mentioned_only: { icon: "⚠", label: "GitHub", message: "GitHub mentioned, but no link provided." },
      absent: { icon: "❗", label: "GitHub", message: "No GitHub presence detected." },
    },
    deployment: {
      linked: { icon: "✓", label: "Deployment", message: "Deployment / live link present — strong signal." },
      mentioned_only: { icon: "⚠", label: "Deployment", message: "Deployment mentioned, but no link or host." },
      absent: { icon: "❗", label: "Deployment", message: "No deployment presence detected." },
    },
    metrics: {
      linked: { icon: "✓", label: "Metrics", message: "Quantified impact present — strong signal." },
      mentioned_only: { icon: "⚠", label: "Metrics", message: "Metrics mentioned, but no numbers provided." },
      absent: { icon: "❗", label: "Metrics", message: "No quantified metrics detected." },
    },
    quantifiedBullets: {
      linked: { icon: "✓", label: "Quantified bullets", message: "Bullets include numbers and impact — strong." },
      mentioned_only: { icon: "⚠", label: "Quantified bullets", message: "Impact mentioned, but bullets lack numbers." },
      absent: { icon: "❗", label: "Quantified bullets", message: "No quantified bullets detected." },
    },
  };
  return config[key][state];
}

export function matchSignalKey(
  signalText: string
): "github" | "deployment" | "metrics" | "quantifiedBullets" | null {
  const t = signalText.toLowerCase();
  if (t.includes("github")) return "github";
  if (t.includes("deploy") || t.includes("hosting") || t.includes("production")) return "deployment";
  if (t.includes("metric") || t.includes("number")) return "metrics";
  if (t.includes("quantified") || t.includes("bullet")) return "quantifiedBullets";
  return null;
}
