// Turns a saved analysis into plain-language guidance for a role's page: an
// honest "should I apply?" verdict and an explanation of which part of the score
// is dragging it down. Deterministic and built only from what the analysis
// actually found. It never predicts odds of an offer, only how well the resume
// shows what the posting asks for. Pure so every threshold is tested.

import type { ScoreBreakdown } from "../../types/analyzer";

type SkillRow = { name: string; status: "hit" | "miss"; importance?: string };

export type VerdictLevel = "strong" | "competitive" | "stretch" | "longshot";

export type ApplyVerdict = {
  level: VerdictLevel;
  label: string;
  summary: string;
  /** Short factual lines that back the verdict up. */
  reasons: string[];
};

type SnapshotLike = {
  alignment: number;
  skills?: SkillRow[];
  breakdown?: ScoreBreakdown;
};

export const BREAKDOWN_META: Record<keyof ScoreBreakdown, { label: string; weight: string; what: string }> = {
  requiredSkills: {
    label: "Required skills",
    weight: "50% of the score",
    what: "How many of the skills this posting requires your resume shows.",
  },
  technicalStack: {
    label: "Tech stack overlap",
    weight: "20% of the score",
    what: "How much of the whole skill list in the posting your resume mentions.",
  },
  resumeEvidence: {
    label: "Resume evidence",
    weight: "20% of the score",
    what: "Proof recruiters look for: deployed work, numbers, a GitHub link.",
  },
  ats: {
    label: "ATS friendliness",
    weight: "10% of the score",
    what: "How easily an applicant-tracking system can read and match your resume.",
  },
};

function requiredCounts(skills: SkillRow[] | undefined) {
  const required = (skills ?? []).filter((s) => (s.importance ?? "required") === "required");
  return { total: required.length, hit: required.filter((s) => s.status === "hit").length };
}

/** The lowest-scoring part of the breakdown, or null when there isn't one. */
export function weakestPart(breakdown: ScoreBreakdown | undefined): { key: keyof ScoreBreakdown; value: number } | null {
  if (!breakdown) return null;
  const keys = Object.keys(BREAKDOWN_META) as (keyof ScoreBreakdown)[];
  let weakest: { key: keyof ScoreBreakdown; value: number } | null = null;
  for (const key of keys) {
    const value = breakdown[key];
    if (typeof value !== "number") continue;
    if (!weakest || value < weakest.value) weakest = { key, value };
  }
  return weakest;
}

export function getApplyVerdict(snap: SnapshotLike): ApplyVerdict {
  const { total: reqTotal, hit: reqHit } = requiredCounts(snap.skills);
  // With no required skills listed, don't let an empty set veto the verdict.
  const reqShare = reqTotal > 0 ? reqHit / reqTotal : null;
  const meetsReq = (min: number) => reqShare === null || reqShare >= min;

  let level: VerdictLevel;
  if (snap.alignment >= 75 && meetsReq(0.7)) level = "strong";
  else if (snap.alignment >= 55 && meetsReq(0.5)) level = "competitive";
  else if (snap.alignment >= 35) level = "stretch";
  else level = "longshot";

  const copy: Record<VerdictLevel, { label: string; summary: string }> = {
    strong: {
      label: "Strong fit",
      summary: "Your resume shows most of what this posting asks for. Tailor it to the wording and apply.",
    },
    competitive: {
      label: "Competitive",
      summary: "You meet a good part of this role. Close the top gaps below, then apply.",
    },
    stretch: {
      label: "Stretch",
      summary:
        "Your resume is missing several things this role asks for. Close the required gaps first, or apply with a strong cover letter and a relevant project.",
    },
    longshot: {
      label: "Long shot for now",
      summary:
        "Your resume shows little of what this posting asks for. Build the required skills first, or look for roles that fit better.",
    },
  };

  const reasons: string[] = [];
  if (reqTotal > 0) reasons.push(`You match ${reqHit} of ${reqTotal} required skills.`);
  const missingPreferred = (snap.skills ?? []).filter(
    (s) => s.status === "miss" && (s.importance ?? "required") !== "required",
  ).length;
  if (missingPreferred > 0) {
    reasons.push(`${missingPreferred} nice-to-have skill${missingPreferred === 1 ? "" : "s"} missing, which matters less.`);
  }
  const weakest = weakestPart(snap.breakdown);
  if (weakest && weakest.value < 70) {
    reasons.push(`Weakest area: ${BREAKDOWN_META[weakest.key].label.toLowerCase()} (${weakest.value}%).`);
  }

  return { level, ...copy[level], reasons };
}
