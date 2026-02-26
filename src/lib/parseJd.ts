/**
 * Client-side JD parser for Role Requirements Overview (JD-only mode).
 * Extracts structured data for display without backend.
 */

export type ParsedJdRequirements = {
  coreSkills: string[];
  preferredSkills: string[];
  experienceLevel: string;
  preparationSignals: string[];
  lastAnalyzedAt: string;
};

const COMMON_SKILLS = [
  "React", "TypeScript", "JavaScript", "Python", "Java", "Node.js", "SQL",
  "REST", "API", "REST APIs", "GraphQL", "AWS", "Docker", "Kubernetes",
  "System Design", "Machine Learning", "Data Structures", "Algorithms",
  "Git", "CI/CD", "Agile", "Frontend", "Backend", "Full Stack",
  "PostgreSQL", "MongoDB", "Redis", "NoSQL", "TensorFlow", "PyTorch",
  "HTML", "CSS", "Redux", "Vue", "Angular", "Next.js",
];

const SENIORITY_PATTERNS = [
  { pattern: /junior|entry[- ]?level|0[- ]?2\s*years?|0[- ]?1\s*year/i, label: "Entry-level" },
  { pattern: /mid[- ]?level|2[- ]?4\s*years?|3[- ]?5\s*years?/i, label: "Mid-level (2–4 years)" },
  { pattern: /senior|5\+?\s*years?|staff|lead/i, label: "Senior (5+ years)" },
];

export function parseJdRequirements(jd: string): ParsedJdRequirements {
  const words = jd.split(/\s+/);
  const coreSkills: string[] = [];
  const preferredSkills: string[] = [];
  const seen = new Set<string>();

  const allFound: string[] = [];
  for (const skill of COMMON_SKILLS) {
    if (seen.has(skill.toLowerCase())) continue;
    const re = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(jd)) {
      seen.add(skill.toLowerCase());
      allFound.push(skill);
    }
  }
  const split = Math.min(6, Math.max(4, Math.ceil(allFound.length / 2)));
  coreSkills.push(...allFound.slice(0, split));
  preferredSkills.push(...allFound.slice(split));
  if (coreSkills.length === 0) {
    const extracted = words.filter((w) => w.length > 3 && /^[A-Za-z][a-z]*$/.test(w));
    const unique = [...new Set(extracted)].slice(0, 8);
    coreSkills.push(...unique);
  }

  let experienceLevel = "Not specified";
  for (const { pattern, label } of SENIORITY_PATTERNS) {
    if (pattern.test(jd)) {
      experienceLevel = label;
      break;
    }
  }
  const yearsMatch = jd.match(/(\d+)[\+–-]?\s*(?:to|-)?\s*(\d+)?\s*years?/i);
  if (yearsMatch && experienceLevel === "Not specified") {
    const y1 = parseInt(yearsMatch[1], 10);
    const y2 = yearsMatch[2] ? parseInt(yearsMatch[2], 10) : y1;
    experienceLevel = `${y1}–${y2} years`;
  }

  const signals: string[] = [];
  if (/backend|server|api|rest|graphql/i.test(jd)) signals.push("Backend-heavy focus");
  if (/api|rest|endpoints/i.test(jd)) signals.push("Strong API emphasis");
  if (/react|frontend|ui|vue|angular/i.test(jd)) signals.push("Moderate frontend depth");
  if (/senior|mid|junior|years?/i.test(jd)) signals.push("Mid-level expectations");
  if (signals.length === 0) signals.push("Review full job description for focus areas");

  return {
    coreSkills: coreSkills.slice(0, 8),
    preferredSkills: preferredSkills.slice(0, 6),
    experienceLevel,
    preparationSignals: signals.slice(0, 6),
    lastAnalyzedAt: new Date().toISOString(),
  };
}
