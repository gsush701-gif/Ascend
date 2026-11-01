// Pure helpers for the Analyzer's first screen: friendly checks on what a new
// student drops in (so a Word file or a pasted link doesn't end in a cryptic
// server error) and a short "what to do next" list for the result. No React.

import { getFixPlanForSignal } from "./utils";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // matches the server's multer limit
export const JD_MIN_LENGTH = 20; // matches the server's minimum
/** Below this the match is usually poor, so we nudge (but don't block). */
export const JD_COMFORTABLE_LENGTH = 200;

/**
 * Returns a plain-language reason a chosen resume file can't be used, or null
 * when it's fine. PDF and Word (.docx) are accepted; older .doc files and photos
 * get told what to do instead of failing later.
 */
export function validateResumeFile(file: { name: string; type: string; size: number }): string | null {
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  const isDocx =
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx");
  if (!isPdf && !isDocx) {
    if (/\.(doc|rtf|odt|pages)$/.test(name)) {
      return "That's an older document format. In Word or Google Docs, choose Save as or Download, then .docx or PDF, and upload that.";
    }
    if (/\.(png|jpe?g|heic|gif|webp)$/.test(name)) {
      return "That's an image. Ascend reads text, so export your resume as a PDF or .docx from the program you wrote it in.";
    }
    return "Please choose a PDF or Word (.docx) file.";
  }
  if (file.size === 0) return "That file is empty. Try exporting your resume again.";
  if (file.size > MAX_RESUME_BYTES) {
    return "That file is over 5MB. Export a smaller version (no large images) and try again.";
  }
  return null;
}

export type JdHint = { ready: boolean; message: string | null };

/** What to tell the user about the job description they've pasted so far. */
export function jdHint(jd: string): JdHint {
  const text = jd.trim();
  if (/^https?:\/\/\S+$/i.test(text)) {
    return {
      ready: false,
      message: "That's a link. Links can't be read, so open the posting and paste the text of it here.",
    };
  }
  if (text.length === 0) {
    return {
      ready: false,
      message: "Paste the whole posting, including the responsibilities and requirements.",
    };
  }
  if (text.length < JD_MIN_LENGTH) {
    return { ready: false, message: "Add more of the posting so Ascend can find the skills." };
  }
  if (text.length < JD_COMFORTABLE_LENGTH) {
    return { ready: true, message: "That's short. Pasting the full posting gives a better match." };
  }
  return { ready: true, message: null };
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

type ReportForSteps = {
  alignment: number;
  skills: { name: string; status: "hit" | "miss"; importance?: string }[];
  missingSignals: string[];
};

/**
 * Up to three concrete next steps drawn from the analysis itself: the missing
 * skills the posting treats as required first, then the most common resume gap,
 * then what to do with the role. Deterministic, so it never invents advice.
 */
export function buildNextSteps(report: ReportForSteps): string[] {
  const steps: string[] = [];
  const missing = report.skills.filter((s) => s.status === "miss");
  const required = missing.filter((s) => (s.importance ?? "required") === "required");

  if (required.length > 0) {
    const top = required.slice(0, 2).map((s) => s.name);
    steps.push(
      `Show real evidence of ${joinNames(top)} on your resume: one true bullet${top.length > 1 ? " each" : ""}. Use "Fix gaps as you go" below.`,
    );
  } else if (missing.length > 0) {
    steps.push(
      `Optional: if you've used ${joinNames(missing.slice(0, 2).map((s) => s.name))}, add a bullet that shows it.`,
    );
  }

  const signal = report.missingSignals[0];
  if (signal) steps.push(`${signal}. Quick fix: ${getFixPlanForSignal(signal).action}.`);

  steps.push(
    report.alignment >= 75
      ? "You're a strong fit for this role. Add it to your list and tailor a cover letter."
      : "Update your resume with these changes, then analyze again to see your score move.",
  );

  return steps.slice(0, 3);
}

const ROLE_WORDS =
  /\b(intern|internship|engineer|developer|analyst|associate|scientist|designer|manager|co-?op|apprentice|specialist|consultant|researcher|technician)\b/i;

function clean(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim().replace(/[,;:\-–—|]+$/, "").trim();
  return t.length >= 2 ? t.slice(0, 80) : null;
}

/**
 * Best-effort guess of the role title and company from the top of a pasted job
 * posting, used only to prefill the empty "Add to Roles" fields so a student
 * doesn't end up with "Unknown company". Heuristic and deliberately cautious:
 * it returns null rather than guessing wildly, and the user can always edit.
 */
export function guessRoleAndCompany(jd: string): { role: string | null; company: string | null } {
  const lines = jd
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6);
  let role: string | null = null;
  let company: string | null = null;

  const first = lines[0];
  if (first && first.length <= 90 && ROLE_WORDS.test(first)) {
    const withCompany = first.match(/^(.*?)\s+(?:at|@)\s+(.+)$/i);
    const dashed = first.match(/^(.*?)\s+[-–—|]\s+(.+)$/);
    if (withCompany) {
      role = clean(withCompany[1].replace(/\s*[([].*$/, ""));
      company = clean(withCompany[2].replace(/\s*[([].*$/, ""));
    } else if (dashed && !ROLE_WORDS.test(dashed[2])) {
      role = clean(dashed[1].replace(/\s*[([].*$/, ""));
      company = clean(dashed[2].replace(/\s*[([].*$/, ""));
    } else {
      role = clean(first.replace(/\s*[([].*$/, ""));
    }
  }

  if (!company) {
    for (const line of lines) {
      const labelled = line.match(/^(?:company|employer|organi[sz]ation)\s*[:-]\s*(.+)$/i);
      if (labelled) {
        company = clean(labelled[1]);
        break;
      }
    }
  }

  // A short, plain second line right under a title is usually "Company, City".
  if (!company && role && lines[1]) {
    const second = lines[1];
    if (second.length <= 70 && /^[A-Z]/.test(second) && !ROLE_WORDS.test(second) && !/[.:]$/.test(second)) {
      company = clean(second.split(",")[0].replace(/\s*[([].*$/, ""));
    }
  }

  return { role, company };
}
