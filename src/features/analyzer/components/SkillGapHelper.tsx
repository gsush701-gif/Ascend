import { useEffect, useState } from "react";
import { GraduationCap, Github, Lightbulb, Loader2 } from "lucide-react";
import { API_BASE } from "../../../config/api";
import { useAuth } from "../../../context/AuthContext";
import { getApiErrorMessage } from "../../../lib/apiError";
import { cn } from "../../../lib/cn";
import { cardAlt } from "../../../lib/ui";
import type { ProjectMatchResult } from "../../../types/github";

type ProjectIdea = { title: string; description: string; skillsCovered: string[] };

type SkillGapHelperProps = {
  /** Missing skills classified as "required" against the target job description. */
  missingRequiredSkills: string[];
  /** Extracted resume text, if available — grounds the project suggestion in the candidate's real background. */
  resumeText?: string;
  /** Brief target role/company context, if available — steers roadmap relevance only, never treated as fact. */
  context?: string;
};

/**
 * "Close your skill gaps" — a combined panel pairing Task 1 (per-skill
 * learning roadmap) with Task 2 (one project idea covering multiple gaps),
 * since both are the natural next step once a missing required skill is
 * identified. Renders nothing if there are no missing required skills.
 */
export function SkillGapHelper({ missingRequiredSkills, resumeText, context }: SkillGapHelperProps) {
  const { session } = useAuth();
  const [openSkill, setOpenSkill] = useState<string | null>(null);
  const [roadmaps, setRoadmaps] = useState<Record<string, string[]>>({});
  const [roadmapLoading, setRoadmapLoading] = useState<string | null>(null);
  const [roadmapErrors, setRoadmapErrors] = useState<Record<string, string>>({});

  const [project, setProject] = useState<ProjectIdea | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  // "Your GitHub project already covers this" (Phase 7 Task 9) — only
  // meaningful for a logged-in user who has connected GitHub and selected
  // at least one repo; server/lib/projectMatching.js does the actual
  // matching (reusing extractSkills/classifySkillsImportance), this is
  // just the thin fetch. Silently shows nothing on any failure (no
  // connection, no selected repos, network error) — this is a bonus
  // enrichment on top of the AI project suggestion below, never a blocking
  // requirement for that suggestion to work.
  const [githubMatch, setGithubMatch] = useState<ProjectMatchResult | null>(null);

  useEffect(() => {
    if (!session?.access_token || missingRequiredSkills.length === 0) {
      setGithubMatch(null);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/api/github/project-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ missingRequiredSkills }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ProjectMatchResult | null) => {
        if (!cancelled) setGithubMatch(data);
      })
      .catch(() => {
        if (!cancelled) setGithubMatch(null);
      });
    return () => {
      cancelled = true;
    };
    // missingRequiredSkills is a derived array (new identity each render in
    // the caller) — depending on its stable, cheap-to-recompute contents
    // via a join avoids an infinite fetch loop while still refetching if
    // the actual skill list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, missingRequiredSkills.join("|")]);

  if (missingRequiredSkills.length === 0) return null;

  const authHeaders = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : undefined;

  async function toggleRoadmap(skill: string) {
    if (openSkill === skill) {
      setOpenSkill(null);
      return;
    }
    setOpenSkill(skill);
    if (roadmaps[skill] || roadmapLoading === skill) return;

    setRoadmapLoading(skill);
    setRoadmapErrors((prev) => ({ ...prev, [skill]: "" }));
    try {
      const res = await fetch(`${API_BASE}/api/skill-roadmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ skill, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to generate a learning path"));
      setRoadmaps((prev) => ({ ...prev, [skill]: data.steps || [] }));
    } catch (e) {
      setRoadmapErrors((prev) => ({
        ...prev,
        [skill]: e instanceof Error ? e.message : "Failed to generate a learning path",
      }));
    } finally {
      setRoadmapLoading(null);
    }
  }

  async function generateProject() {
    setProjectLoading(true);
    setProjectError(null);
    // If GitHub matching already found real existing repos covering some
    // gaps, steer the AI project suggestion at only what's genuinely still
    // uncovered rather than re-suggesting a project for a skill the user
    // can already point to on GitHub. Falls back to the full missing-skills
    // list when there's no GitHub match data yet (not connected, no repos
    // selected, or everything happens to be covered already — in which
    // case there'd be nothing left to ask for, so the full list is the
    // safer fallback).
    const targetSkills =
      githubMatch && githubMatch.uncoveredSkills.length > 0 ? githubMatch.uncoveredSkills : missingRequiredSkills;
    try {
      const res = await fetch(`${API_BASE}/api/recommend-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ missingSkills: targetSkills, resumeText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to suggest a project"));
      setProject(data);
    } catch (e) {
      setProjectError(e instanceof Error ? e.message : "Failed to suggest a project");
    } finally {
      setProjectLoading(false);
    }
  }

  return (
    <div className={cn(cardAlt, "p-4")}>
      <h3 className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <GraduationCap className="h-3.5 w-3.5" />
        Close your skill gaps
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        Concrete next steps for the required skills missing from your resume.
      </p>

      <ul className="space-y-2">
        {missingRequiredSkills.map((skill) => (
          <li key={skill} className="rounded-lg border border-slate-200 bg-[#FFFFFF]">
            <button
              type="button"
              onClick={() => toggleRoadmap(skill)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-900/[0.03]"
            >
              <span>{skill}</span>
              <span className="flex items-center gap-1 text-xs font-normal text-cyan-600">
                {roadmapLoading === skill && <Loader2 className="h-3 w-3 animate-spin" />}
                {openSkill === skill ? "Hide learning path" : "Get a learning path"}
              </span>
            </button>
            {openSkill === skill && (
              <div className="animate-fade-in border-t border-slate-100 px-3 py-2.5">
                {roadmapErrors[skill] ? (
                  <p className="text-xs text-red-600">{roadmapErrors[skill]}</p>
                ) : roadmapLoading === skill ? (
                  <p className="text-xs text-slate-400">Generating…</p>
                ) : roadmaps[skill] ? (
                  <ol className="space-y-1.5 text-sm text-slate-700">
                    {roadmaps[skill].map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="shrink-0 font-medium text-cyan-600">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>

      {githubMatch && githubMatch.recommendedRepo && (
        <div className="mt-3 animate-fade-in rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-700">
            <Github className="h-3.5 w-3.5" />
            Already on your GitHub
          </div>
          <p className="text-sm text-slate-700">
            Your project <span className="font-semibold text-slate-900">{githubMatch.recommendedRepo.repoName}</span>{" "}
            already demonstrates {githubMatch.recommendedRepo.matchedSkills.join(", ")} — worth citing on your
            resume for this role instead of (or alongside) a new project.
          </p>
        </div>
      )}

      <div className="mt-3 border-t border-slate-200 pt-3">
        {!project ? (
          <button
            type="button"
            onClick={generateProject}
            disabled={projectLoading}
            className="btn-press inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-900/[0.04] px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-900/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {projectLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}
            {projectLoading ? "Thinking of a project…" : "Suggest a project covering these gaps"}
          </button>
        ) : (
          <div className="animate-fade-in rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-cyan-600">
              <Lightbulb className="h-3.5 w-3.5" />
              Project idea
            </div>
            <p className="text-sm font-semibold text-slate-900">{project.title}</p>
            <p className="mt-1 text-sm text-slate-700">{project.description}</p>
            {project.skillsCovered.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Covers: {project.skillsCovered.join(", ")}
              </p>
            )}
          </div>
        )}
        {projectError && <p className="mt-2 text-xs text-red-600">{projectError}</p>}
      </div>
    </div>
  );
}
