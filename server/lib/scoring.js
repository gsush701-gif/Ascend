// --- Core resume/JD scoring engine ---
// Pulled out of server/index.js into its own side-effect-free module so it
// can be unit tested directly (index.js starts a live server on require,
// which makes it awkward to import from a test file).

// --- Skill dictionary: canonical (lowercase, singular) + patterns to match ---
// One canonical name per concept; patterns can be plural/variants. Output is normalized and deduplicated.
const SKILL_ENTRIES = [
  { canonical: "python", patterns: ["python"] },
  { canonical: "java", patterns: ["java"] },
  { canonical: "javascript", patterns: ["javascript"] },
  { canonical: "typescript", patterns: ["typescript"] },
  { canonical: "c++", patterns: ["c++"] },
  { canonical: "c#", patterns: ["c#"] },
  { canonical: "sql", patterns: ["sql"] },
  { canonical: "rest api", patterns: ["rest api", "rest apis", "api"] },
  { canonical: "node", patterns: ["node", "node.js"] },
  { canonical: "express", patterns: ["express"] },
  { canonical: "react", patterns: ["react"] },
  { canonical: "next.js", patterns: ["next.js", "next js"] },
  { canonical: "aws", patterns: ["aws"] },
  { canonical: "azure", patterns: ["azure"] },
  { canonical: "gcp", patterns: ["gcp"] },
  { canonical: "docker", patterns: ["docker"] },
  { canonical: "kubernetes", patterns: ["kubernetes", "k8s"] },
  { canonical: "git", patterns: ["git"] },
  { canonical: "linux", patterns: ["linux"] },
  {
    canonical: "data structures",
    patterns: ["data structures", "data structure"],
  },
  { canonical: "algorithms", patterns: ["algorithms", "algorithm"] },
  { canonical: "testing", patterns: ["testing", "tests"] },
  { canonical: "pytest", patterns: ["pytest"] },
  { canonical: "jest", patterns: ["jest"] },
  { canonical: "ci/cd", patterns: ["ci/cd", "cicd", "ci cd"] },
];

function norm(s) {
  return (s || "")
    .toLowerCase()
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(arr) {
  return [...new Set(arr)];
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A "word boundary" for skill matching, but NOT JS's \b (which is defined
// purely in terms of \w = [A-Za-z0-9_] and breaks for patterns that start
// or end in punctuation, e.g. "c++" — \b never fires directly after "++"
// because neither "+" nor a following space is a \w character, so there's
// no \w/\W transition for \b to anchor on). Instead this treats "boundary"
// as "not immediately adjacent to a letter or digit", which correctly
// handles both plain-word skills (java/git/api) and symbol-containing ones
// (c++, c#, ci/cd) the same way.
function buildSkillPattern(pattern) {
  const key = norm(pattern);
  if (!key) return null;
  const escaped = escapeRegExp(key);
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
}

function textContainsPattern(normalizedText, pattern) {
  const re = buildSkillPattern(pattern);
  return re ? re.test(normalizedText) : false;
}

/**
 * Extract canonical skills mentioned in `text`, using word-boundary-aware
 * matching so e.g. "javascript" doesn't also register a hit for "java",
 * "digital" doesn't register a hit for "git", and "capital"/"rapid" don't
 * register a hit for "api".
 */
function extractSkills(text) {
  const t = norm(text);
  const hits = [];
  for (const { canonical, patterns } of SKILL_ENTRIES) {
    const matched = patterns.some((p) => textContainsPattern(t, p));
    if (matched) hits.push(canonical);
  }
  return unique(hits);
}

function makeActions(missing) {
  const actions = [];
  const m = missing.map((x) => x.toLowerCase());

  if (m.some((x) => x.includes("rest")))
    actions.push("Build one REST API project");
  if (
    m.some((x) => x.includes("aws") || x.includes("azure") || x.includes("gcp"))
  )
    actions.push("Deploy a project to a cloud platform (AWS/Render/Vercel)");
  if (m.some((x) => x.includes("testing")))
    actions.push("Add tests (unit/integration) to one project");
  if (m.some((x) => x.includes("docker")))
    actions.push("Containerize one project with Docker");
  if (m.some((x) => x.includes("sql")))
    actions.push("Add a SQL-backed feature to a project");

  if (actions.length === 0)
    actions.push("Add metrics + impact to 2 strongest bullet points");
  return actions.slice(0, 5);
}

function missingSignals(resumeText) {
  const t = norm(resumeText);
  const signals = [];

  const hasDeploy = [
    "deployed",
    "deployment",
    "vercel",
    "render",
    "aws",
    "azure",
    "gcp",
    "netlify",
  ].some((k) => t.includes(k));
  if (!hasDeploy) signals.push("No deployment/hosting experience mentioned");

  const hasNumbers = /\b\d+(\.\d+)?%?\b/.test(t);
  if (!hasNumbers) signals.push("No quantified impact (numbers/metrics) found");

  const hasGitHub = t.includes("github");
  if (!hasGitHub) signals.push("No GitHub link/mention detected");

  return signals;
}

// --- Required vs. preferred skill classification -------------------------
//
// There's no reliable full-JD-structure parser here (no section detection
// for "Requirements:" vs "Preferred qualifications:" headers) — instead
// this is a deliberately simple proximity heuristic: for each matched
// skill mention, look at a window of characters around it in the original
// (unnormalized, structure-preserving) JD text and see which set of
// signal phrases is closer. Most JDs never bother labeling their required
// skills explicitly ("Python" just appears in a bulleted list), so silence
// defaults to "required" rather than "preferred" — the spec's instruction,
// and also the safer default for a fit score (under-promising preferred
// credit rather than over-crediting a skill as optional).
// Unambiguous required/preferred phrases — each one only ever shows up
// meaning what it says, so proximity between two of these can be compared
// directly (closer one wins).
const STRONG_REQUIRED_SIGNAL_PHRASES = [
  "must have",
  "must-have",
  "must haves",
  "must-haves",
  "required",
  "requirement",
  "requirements",
  "minimum qualification",
  "minimum qualifications",
  "you need",
  "you must",
  "you'll need",
  "need to have",
  "should have",
  "essential",
];

const PREFERRED_SIGNAL_PHRASES = [
  "preferred",
  "preference",
  "nice to have",
  "nice-to-have",
  "bonus",
  "a plus",
  "is a plus",
  "big plus",
  "pluses",
  "desirable",
  "ideally",
  "would be a plus",
  "optional",
  "not required but",
];

// "Experience with" is deliberately kept separate from the strong required
// list above: it's extremely generic JD filler ("Preferred: experience
// with Kubernetes is a bonus" uses it just as often as a genuinely required
// bullet does), so it should never outrank an explicit "preferred"/"bonus"/
// "nice to have" signal just for being a few characters closer. It only
// tips the scale when nothing else nearby says otherwise — which is also
// exactly what the default (silence = required) already does, so this list
// mainly documents the intent from the spec rather than changing behavior.
const WEAK_REQUIRED_SIGNAL_PHRASES = ["experience with"];

const REQUIRED_SIGNAL_PHRASES = [...STRONG_REQUIRED_SIGNAL_PHRASES, ...WEAK_REQUIRED_SIGNAL_PHRASES];

// How far (in characters) around a skill mention to look for a required/
// preferred signal phrase. Wide enough to catch a nearby section header or
// the same bullet/sentence, narrow enough that it won't casually bleed
// into a JD's next unrelated section.
const CLASSIFY_WINDOW = 160;

function findEarliestMatch(lowerText, patterns) {
  let best = null;
  for (const p of patterns) {
    const re = buildSkillPattern(p);
    if (!re) continue;
    const m = re.exec(lowerText);
    if (m && (!best || m.index < best.index)) {
      best = { index: m.index, length: m[0].length };
    }
  }
  return best;
}

function nearestPhraseDistance(lowerText, matchStart, matchEnd, phrases, windowSize) {
  const winStart = Math.max(0, matchStart - windowSize);
  const winEnd = Math.min(lowerText.length, matchEnd + windowSize);
  const windowText = lowerText.slice(winStart, winEnd);
  let minDist = Infinity;
  for (const phrase of phrases) {
    let from = 0;
    let idx;
    while ((idx = windowText.indexOf(phrase, from)) !== -1) {
      const absStart = winStart + idx;
      const absEnd = absStart + phrase.length;
      let dist;
      if (absEnd <= matchStart) dist = matchStart - absEnd;
      else if (absStart >= matchEnd) dist = absStart - matchEnd;
      else dist = 0;
      if (dist < minDist) minDist = dist;
      from = idx + 1;
    }
  }
  return minDist;
}

/**
 * Classify each of `canonicalSkills` (already-confirmed JD hits from
 * extractSkills) as "required" or "preferred" based on proximity to
 * required/preferred signal language in the original JD text.
 * Returns a plain object { [canonical]: "required" | "preferred" }.
 */
function classifySkillsImportance(jdText, canonicalSkills) {
  const lowerText = (jdText || "").toLowerCase();
  const patternsByCanonical = new Map(SKILL_ENTRIES.map((e) => [e.canonical, e.patterns]));
  const result = {};

  for (const canonical of canonicalSkills) {
    const patterns = patternsByCanonical.get(canonical) || [canonical];
    const match = findEarliestMatch(lowerText, patterns);
    if (!match) {
      // Couldn't locate the exact mention (e.g. unusual whitespace between
      // words of a multi-word phrase) — default to required, the same
      // "silence means required" fallback used everywhere else here.
      result[canonical] = "required";
      continue;
    }
    const matchEnd = match.index + match.length;
    const prefDist = nearestPhraseDistance(lowerText, match.index, matchEnd, PREFERRED_SIGNAL_PHRASES, CLASSIFY_WINDOW);
    const strongReqDist = nearestPhraseDistance(lowerText, match.index, matchEnd, STRONG_REQUIRED_SIGNAL_PHRASES, CLASSIFY_WINDOW);
    const weakReqDist = nearestPhraseDistance(lowerText, match.index, matchEnd, WEAK_REQUIRED_SIGNAL_PHRASES, CLASSIFY_WINDOW);

    if (prefDist < Infinity) {
      // A preferred/nice-to-have/bonus phrase is nearby — that wins unless
      // an unambiguous required phrase ("required", "must have", ...) is
      // strictly closer to the skill mention. The generic "experience
      // with" filler is deliberately excluded from this comparison (see
      // WEAK_REQUIRED_SIGNAL_PHRASES above) so it can't override a clear
      // "preferred" signal just by sitting a few characters nearer.
      result[canonical] = strongReqDist < prefDist ? "required" : "preferred";
    } else if (strongReqDist < Infinity || weakReqDist < Infinity) {
      result[canonical] = "required";
    } else {
      // No signal language nearby at all — silence means required.
      result[canonical] = "required";
    }
  }

  return result;
}

// --- Explainable score breakdown ------------------------------------------
//
// Four components, each backed by a real extracted signal:
//  - requiredSkills: hit ratio over JD skills classified "required" (falls
//    back to the overall hit ratio if no skill was classified required,
//    so the component is never computed from an empty set).
//  - technicalStack: hit ratio over ALL matched JD skills (required +
//    preferred combined) — a broader "does your stack overlap at all"
//    signal, distinct from the required-only number above.
//  - resumeEvidence: how many of the 3 real resume-quality signals this
//    codebase already checks for (deployment/hosting mention, quantified
//    numbers, GitHub mention) are present. Inherently a rough 0/33/67/100
//    bucket, not fabricated single-point precision.
//  - ats: a rough, explicitly-bucketed (rounded to the nearest 5) proxy for
//    how cleanly this resume's text extracted — standard section-header
//    presence (Experience/Education/Skills/...) plus extracted-text
//    density per page. This is NOT a real ATS parser; it's the only
//    ATS-adjacent signal actually available from what this codebase
//    extracts today.
const SECTION_HEADER_KEYWORDS = [
  "experience",
  "education",
  "skills",
  "summary",
  "projects",
  "certification",
  "objective",
];

function computeAtsScore(resumeText, numPages) {
  const t = norm(resumeText);
  const foundHeaders = SECTION_HEADER_KEYWORDS.filter((h) => t.includes(h)).length;

  let score = 55;
  score += Math.min(foundHeaders * 6, 30);

  const pages = Math.max(numPages || 1, 1);
  const density = (resumeText || "").length / pages;
  // Very little extractable text per page usually means a scanned/
  // image-heavy PDF that an ATS would also struggle to parse.
  if (density < 200) score -= 25;
  // Unusually dense text per page can indicate multi-column/table layouts
  // that extract as run-together text — also an ATS risk.
  else if (density > 6000) score -= 10;

  const bounded = Math.max(0, Math.min(100, score));
  return Math.round(bounded / 5) * 5;
}

function computeResumeEvidenceScore(signals) {
  const totalPossible = 3; // deployment, quantified numbers, GitHub — see missingSignals()
  const present = totalPossible - Math.min(signals.length, totalPossible);
  return Math.round((present / totalPossible) * 100);
}

// --- Detailed, standalone ATS analysis (Phase 7) --------------------------
//
// Ascend's own compatibility analysis — deterministic, regex/heuristic
// based, built entirely from signals this module can already extract
// (word-boundary skill matching, required/preferred JD classification,
// section-header presence). This is explicitly NOT a claim to reproduce the
// exact parsing behavior of any specific real-world Applicant Tracking
// System — there is no single standard ATS algorithm, and every real ATS
// parses differently. Any copy (API responses, UI, comments) built around
// this function's output must keep framing it as "Ascend's own
// compatibility analysis", never as "how every ATS will read this resume".
//
// `computeAtsScore` above is the original rough single-number proxy;
// `computeScoreBreakdown`'s `ats` component now sources its value from this
// function's `overallScore` instead, since this covers the same ground
// (section presence, text density) plus real JD-aware keyword/skill
// signals `computeAtsScore` never had access to. `computeAtsScore` is kept
// around (and exported) rather than deleted, since nothing about it is
// wrong — it's just superseded for this purpose.

const CONTACT_EMAIL_RE = /[a-z0-9][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,}/i;
const CONTACT_PHONE_RE = /(\+?\d[\d\-.\s()]{8,}\d)/;

const SECTION_PATTERNS = {
  summary: ["professional summary", "summary", "objective", "profile"],
  experience: [
    "professional experience",
    "work experience",
    "employment history",
    "work history",
    "experience",
  ],
  education: ["education", "academic background"],
  skills: ["technical skills", "core competencies", "areas of expertise", "skills"],
};
const ALL_SECTION_HEADER_KEYWORDS = [
  ...SECTION_PATTERNS.summary,
  ...SECTION_PATTERNS.experience,
  ...SECTION_PATTERNS.education,
  ...SECTION_PATTERNS.skills,
  "projects",
  "certifications",
  "certification",
];

const DATE_TOKEN_RE = /\b(19|20)\d{2}\b|\bpresent\b|\bcurrent(ly)?\b/i;

// Passive/vague filler phrases that describe a duty without describing an
// outcome. Flagged as a "weak bullet" only when the statement ALSO has no
// number anywhere in it — the same phrase attached to a real metric
// ("Responsible for a $2M budget across 3 teams") is weaker style but not
// the same "says nothing concrete" problem this check targets.
const FILLER_PASSIVE_PHRASES = [
  "responsible for",
  "duties included",
  "duties include",
  "worked on",
  "helped with",
  "assisted with",
  "in charge of",
  "tasked with",
  "involved in",
];

// Generic self-description clichés — provide no concrete, checkable signal
// regardless of whether a number happens to be nearby.
const GENERIC_CLICHE_PHRASES = [
  "hard worker",
  "team player",
  "results-oriented",
  "results oriented",
  "detail-oriented",
  "detail oriented",
  "highly motivated",
  "fast learner",
  "self-starter",
  "self starter",
  "go-getter",
  "excellent communication skills",
  "proven track record",
  "think outside the box",
  "outside the box",
  "go above and beyond",
];

/**
 * Splits resume text into bullet/sentence-sized "statements" for the
 * content-quality checks below. PDF text extraction in this codebase
 * (server/lib/pdfText.js, src/lib/pdf.ts) joins each page's text items with
 * plain spaces, so real line/bullet breaks are usually already lost by the
 * time text reaches here — this can't recover true bullet boundaries, only
 * approximate them:
 *   1) split on bullet glyphs (•, ‣, ▪, …) when the PDF's text stream
 *      preserved them as literal characters (common), or
 *   2) fall back to sentence-boundary splitting when no bullet glyphs
 *      survived at all.
 */
function splitIntoStatements(resumeText) {
  const text = typeof resumeText === "string" ? resumeText : "";
  const BULLET_GLYPHS_RE = /[•‣▪●○◦∙▸►]/g;
  let parts = text
    .split(BULLET_GLYPHS_RE)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    // Require at least 2 alphanumeric characters immediately before the
    // terminal punctuation, not just any single character — otherwise a
    // two-letter degree abbreviation like "B.S. Computer Science" gets
    // misread as two sentences ("...B." / "S. Computer Science...") purely
    // because "S." happens to be followed by a space and a capital letter.
    parts = text
      .split(/(?<=[A-Za-z0-9]{2}[.!?])\s+(?=[A-Z0-9])/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  // Bullets/sentences are short, punchy lines. Anything far longer than a
  // normal one is more likely several statements the split above failed to
  // separate — skip it rather than flag a paragraph-sized run as "one weak
  // bullet". Anything far shorter is more likely a stray header/label.
  return parts.filter((p) => p.length >= 8 && p.length <= 400);
}

/** Is this one bullet/sentence-sized statement "weak" — vague/passive with
 * no measurable outcome, or too short to convey any impact at all? */
function isWeakStatement(statement) {
  const lower = statement.toLowerCase();
  const hasNumber = /\d/.test(statement);
  const fillerHit = FILLER_PASSIVE_PHRASES.find((p) => lower.includes(p));
  if (fillerHit && !hasNumber) {
    return { weak: true, reason: "Passive/vague phrasing, no measurable outcome" };
  }
  const wordCount = statement.trim().split(/\s+/).filter(Boolean).length;
  if (!hasNumber && wordCount > 0 && wordCount <= 6) {
    return { weak: true, reason: "Too brief to convey measurable impact" };
  }
  return { weak: false, reason: null };
}

function findGenericStatements(statements) {
  const hits = [];
  for (const s of statements) {
    const lower = s.toLowerCase();
    if (GENERIC_CLICHE_PHRASES.some((p) => lower.includes(p))) hits.push(s);
  }
  return unique(hits).slice(0, 15);
}

/** Exact-phrase repetition across the resume, restricted to the same
 * filler/cliché watchlists above — a phrase repeated 2+ times is a strong
 * sign of copy-pasted boilerplate bullets. */
function findRepeatedPhrases(resumeText) {
  const t = norm(resumeText);
  const watchList = unique([...FILLER_PASSIVE_PHRASES, ...GENERIC_CLICHE_PHRASES]);
  const repeated = [];
  for (const phrase of watchList) {
    const re = new RegExp(escapeRegExp(phrase), "gi");
    const count = (t.match(re) || []).length;
    if (count >= 2) repeated.push(phrase);
  }
  return repeated;
}

/** Slices out the substring of normalized text between the earliest match of
 * `startKeywords` and whichever OTHER header keyword appears next — i.e. one
 * resume section's block of text. Returns "" if none of `startKeywords` is
 * found at all. */
function extractSectionBlock(normalizedText, startKeywords, allHeaderKeywords) {
  let startIdx = -1;
  for (const kw of startKeywords) {
    const idx = normalizedText.indexOf(kw);
    if (idx !== -1 && (startIdx === -1 || idx < startIdx)) startIdx = idx;
  }
  if (startIdx === -1) return "";
  const searchFrom = startIdx + 1;
  let endIdx = normalizedText.length;
  for (const kw of allHeaderKeywords) {
    if (startKeywords.includes(kw)) continue;
    const idx = normalizedText.indexOf(kw, searchFrom);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }
  return normalizedText.slice(startIdx, endIdx);
}

/**
 * Detects standard resume sections + a couple of structural red flags.
 * Section-header detection is a simple substring check (same convention as
 * `SECTION_HEADER_KEYWORDS`/`computeAtsScore` above) — good enough to tell
 * "is there a Skills section at all", not a real layout parser.
 */
function detectStructure(resumeText) {
  const original = typeof resumeText === "string" ? resumeText : "";
  const t = norm(original);
  const hasHeader = (keywords) => keywords.some((k) => t.includes(k));

  const hasContactInfo = CONTACT_EMAIL_RE.test(original) || CONTACT_PHONE_RE.test(original);
  const hasSummary = hasHeader(SECTION_PATTERNS.summary);
  const hasExperience = hasHeader(SECTION_PATTERNS.experience);
  const hasEducation = hasHeader(SECTION_PATTERNS.education);
  const hasSkillsSection = hasHeader(SECTION_PATTERNS.skills);

  const issues = [];
  if (!hasContactInfo) issues.push("No email address or phone number detected");
  if (!hasSummary) issues.push("No professional summary detected");
  if (!hasExperience) issues.push("No experience section detected");
  if (!hasEducation) issues.push("No education section detected");
  if (!hasSkillsSection) issues.push("No dedicated skills section detected");

  if (hasExperience) {
    const block = extractSectionBlock(t, SECTION_PATTERNS.experience, ALL_SECTION_HEADER_KEYWORDS);
    if (block && !DATE_TOKEN_RE.test(block)) {
      issues.push("No employment dates detected in the experience section");
    }
  }

  return { hasContactInfo, hasSummary, hasExperience, hasEducation, hasSkillsSection, issues };
}

function computeFormattingScore(structure, resumeText) {
  let score = 40;
  if (structure.hasContactInfo) score += 15;
  if (structure.hasExperience) score += 15;
  if (structure.hasEducation) score += 10;
  if (structure.hasSkillsSection) score += 10;
  if (structure.hasSummary) score += 10;

  // Text-length sanity check, carried over in spirit from the original
  // rough ATS proxy (`computeAtsScore` above) but without page-count
  // awareness — this function's signature (resumeText, jobDescriptionText)
  // has no page count to divide by, unlike /analyze's PDF-upload flow.
  const length = (resumeText || "").trim().length;
  if (length > 0 && length < 200) score -= 20; // likely a scanned/very sparse PDF
  else if (length > 15000) score -= 10; // likely a dense multi-column layout

  return Math.max(0, Math.min(100, Math.round(score)));
}

function computeExperienceRelevanceScore(hasExperience, statements) {
  let score = hasExperience ? 40 : 10;
  if (statements.length > 0) {
    const withNumbers = statements.filter((s) => /\d/.test(s)).length;
    score += Math.round((withNumbers / statements.length) * 40);
    const nonWeak = statements.filter((s) => !isWeakStatement(s).weak).length;
    score += Math.round((nonWeak / statements.length) * 20);
  } else {
    // No bullet/sentence-sized statements could be detected at all —
    // neutral partial credit rather than fabricating 0 or 100 from data
    // that isn't there.
    score += 30;
  }
  return Math.max(0, Math.min(100, score));
}

/**
 * Ascend's own deterministic, explainable ATS compatibility analysis —
 * see the header comment above this section for what it is and isn't.
 * Pure/deterministic: same inputs always produce the same output, no
 * network calls, no Groq.
 */
function computeDetailedAtsAnalysis(resumeText, jobDescriptionText) {
  const resume = typeof resumeText === "string" ? resumeText : "";
  const jd = typeof jobDescriptionText === "string" ? jobDescriptionText : "";

  const jdSkills = extractSkills(jd);
  const resumeSkills = extractSkills(resume);
  const resumeSkillSet = new Set(resumeSkills.map((s) => norm(s)));
  const matched = jdSkills.filter((s) => resumeSkillSet.has(norm(s)));
  const missing = jdSkills.filter((s) => !resumeSkillSet.has(norm(s)));

  // No JD skills to compare against (no JD given, or the JD's text doesn't
  // mention anything in this module's skill dictionary) — there's nothing
  // to penalize the resume for missing, so default to full marks instead of
  // fabricating a percentage from an empty comparison set.
  const coveragePercent = jdSkills.length > 0 ? Math.round((matched.length / jdSkills.length) * 100) : 100;

  const importanceBySkill = classifySkillsImportance(jd, jdSkills);
  const requiredJdSkills = jdSkills.filter((s) => (importanceBySkill[s] || "required") === "required");
  const requiredMatched = requiredJdSkills.filter((s) => resumeSkillSet.has(norm(s)));
  // Same "never compute a percentage from an empty set" fallback used by
  // computeScoreBreakdown's requiredSkills score above.
  const skillsMatchScore =
    requiredJdSkills.length > 0
      ? Math.round((requiredMatched.length / requiredJdSkills.length) * 100)
      : coveragePercent;

  const structure = detectStructure(resume);
  const formattingScore = computeFormattingScore(structure, resume);

  const statements = splitIntoStatements(resume);
  const experienceRelevanceScore = computeExperienceRelevanceScore(structure.hasExperience, statements);

  const weakBullets = [];
  for (const s of statements) {
    const { weak, reason } = isWeakStatement(s);
    if (weak) weakBullets.push({ text: s, reason });
  }

  const content = {
    weakBullets: weakBullets.slice(0, 15),
    genericStatements: findGenericStatements(statements),
    repeatedPhrases: findRepeatedPhrases(resume),
  };

  const breakdown = {
    keywordMatch: coveragePercent,
    formatting: formattingScore,
    experienceRelevance: experienceRelevanceScore,
    skillsMatch: skillsMatchScore,
  };

  const weights = { keywordMatch: 0.35, skillsMatch: 0.25, formatting: 0.2, experienceRelevance: 0.2 };
  const overallScore = Math.round(
    breakdown.keywordMatch * weights.keywordMatch +
      breakdown.skillsMatch * weights.skillsMatch +
      breakdown.formatting * weights.formatting +
      breakdown.experienceRelevance * weights.experienceRelevance,
  );

  return {
    overallScore: Math.max(0, Math.min(100, overallScore)),
    breakdown,
    keywords: { matched, missing, coveragePercent },
    structure,
    content,
  };
}

/**
 * Build the explainable score breakdown + overall (backward-compatible
 * "alignment") score from already-computed skills/signals.
 * `skills` entries must each have { status: "hit"|"miss", importance: "required"|"preferred" }.
 */
function computeScoreBreakdown({ skills, resumeText, numPages, signals, jobDescriptionText = "" }) {
  const requiredSkills = skills.filter((s) => s.importance === "required");
  const requiredHits = requiredSkills.filter((s) => s.status === "hit").length;
  const requiredTotal = requiredSkills.length;

  const totalHits = skills.filter((s) => s.status === "hit").length;
  const totalCount = Math.max(skills.length, 1);
  const technicalStackScore = Math.round((totalHits / totalCount) * 100);

  // Never compute a "required skills" percentage from an empty set —
  // fall back to the overall stack ratio instead of fabricating a number.
  const requiredSkillsScore =
    requiredTotal > 0 ? Math.round((requiredHits / requiredTotal) * 100) : technicalStackScore;

  const resumeEvidenceScore = computeResumeEvidenceScore(signals);
  // Sourced from the new, more thorough computeDetailedAtsAnalysis (below)
  // instead of the old rough computeAtsScore proxy — see that function's
  // header comment for why. `numPages` is accepted here for backward
  // compatibility with existing callers but is no longer used: the detailed
  // analysis's signature (resumeText, jobDescriptionText) has no page count
  // to divide by, since the standalone /api/ats-check route it also powers
  // never receives one (it takes raw resume/JD text, not an uploaded PDF).
  const atsScore = computeDetailedAtsAnalysis(resumeText, jobDescriptionText).overallScore;

  const weights = { requiredSkills: 0.5, technicalStack: 0.2, resumeEvidence: 0.2, ats: 0.1 };
  const overallScore = Math.round(
    requiredSkillsScore * weights.requiredSkills +
      technicalStackScore * weights.technicalStack +
      resumeEvidenceScore * weights.resumeEvidence +
      atsScore * weights.ats,
  );

  return {
    overallScore: Math.max(0, Math.min(100, overallScore)),
    breakdown: {
      requiredSkills: requiredSkillsScore,
      technicalStack: technicalStackScore,
      resumeEvidence: resumeEvidenceScore,
      ats: atsScore,
    },
  };
}

// --- Salary extraction (Phase 5, Task 4) ----------------------------------
//
// Regex-only, deterministic, no AI involved. Only ever returns a range that
// was actually written in the text — never fabricates a number. Every
// pattern here requires a literal "$" (per the spec: "default USD if a $
// sign is present, no currency guessing beyond that" — this module makes no
// attempt to detect other currency symbols/codes).
//
// A connector between the two numbers ("-", an en/em dash, "to", or "and"
// for "between $X and $Y" phrasing) is required so a lone dollar amount
// (e.g. "$5,000 sign-on bonus") is never mistaken for a range.
const RANGE_CONNECTOR = "(?:-|–|—|to|and)";

// "$18-$25/hour", "$18/hr - $25/hr", "$18 to $25 per hour", "$18-$25 an hour"
const HOURLY_RANGE_RE = new RegExp(
  `\\$\\s*(\\d+(?:\\.\\d+)?)\\s*(?:/\\s*(?:hr|hour))?\\s*${RANGE_CONNECTOR}\\s*\\$?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:/\\s*(?:hr|hour)|per\\s+hour|an?\\s+hour|hourly)`,
  "i",
);

// "$80k-$110k", "$80K - $110K annually"
const ANNUAL_K_RANGE_RE = new RegExp(
  `\\$\\s*(\\d+(?:\\.\\d+)?)\\s*k\\b\\s*${RANGE_CONNECTOR}\\s*\\$?\\s*(\\d+(?:\\.\\d+)?)\\s*k\\b`,
  "i",
);

// "$70,000-$90,000 per year", "$70,000 to $90,000 annually", "$70000/year"
const ANNUAL_KEYWORD_RANGE_RE = new RegExp(
  `\\$\\s*([\\d,]+(?:\\.\\d+)?)\\s*${RANGE_CONNECTOR}\\s*\\$?\\s*([\\d,]+(?:\\.\\d+)?)\\s*(?:/\\s*(?:yr|year)|per\\s+year|annually|a\\s+year|/\\s*annum|per\\s+annum)`,
  "i",
);

// Bare "$80,000 - $100,000" with no explicit period keyword nearby — the
// overwhelmingly common way job postings write an annual range without
// bothering to say "per year". Requires comma-grouped thousands so it
// doesn't collide with the hourly pattern's small bare numbers.
const PLAIN_COMMA_RANGE_RE = new RegExp(
  `\\$\\s*(\\d{2,3}(?:,\\d{3})+(?:\\.\\d+)?)\\s*${RANGE_CONNECTOR}\\s*\\$?\\s*(\\d{2,3}(?:,\\d{3})+(?:\\.\\d+)?)`,
);

function toNumber(raw) {
  return parseFloat(String(raw).replace(/,/g, ""));
}

const HOURLY_ESTIMATE_HOURS_PER_YEAR = 2080; // 40 hrs/week * 52 weeks — an estimate, not a guarantee.

/**
 * Extract a salary range from free text (job description) using regex only.
 * Returns `{ min, max, currency, period, estimatedAnnual? }` or `null` if no
 * salary pattern is found — never fabricates a number from text that
 * doesn't actually mention one. `estimatedAnnual` is only present for
 * hourly ranges, and is explicitly labeled as an estimate (hourly * 2080),
 * not a claim about the role's real annual pay.
 */
function extractSalary(jobDescriptionText) {
  const text = typeof jobDescriptionText === "string" ? jobDescriptionText : "";
  if (!text.trim()) return null;

  const hourlyMatch = HOURLY_RANGE_RE.exec(text);
  if (hourlyMatch) {
    const min = toNumber(hourlyMatch[1]);
    const max = toNumber(hourlyMatch[2]);
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0 && min <= max && max < 1000) {
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      return {
        min: lo,
        max: hi,
        currency: "USD",
        period: "hourly",
        estimatedAnnual: {
          min: Math.round(lo * HOURLY_ESTIMATE_HOURS_PER_YEAR),
          max: Math.round(hi * HOURLY_ESTIMATE_HOURS_PER_YEAR),
          note: `Estimate only — based on ${HOURLY_ESTIMATE_HOURS_PER_YEAR} hours/year (40 hrs/week x 52 weeks). Actual annual pay may vary.`,
        },
      };
    }
  }

  const kMatch = ANNUAL_K_RANGE_RE.exec(text);
  if (kMatch) {
    const min = toNumber(kMatch[1]) * 1000;
    const max = toNumber(kMatch[2]) * 1000;
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0) {
      return { min: Math.min(min, max), max: Math.max(min, max), currency: "USD", period: "annual" };
    }
  }

  const annualKeywordMatch = ANNUAL_KEYWORD_RANGE_RE.exec(text);
  if (annualKeywordMatch) {
    const min = toNumber(annualKeywordMatch[1]);
    const max = toNumber(annualKeywordMatch[2]);
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0) {
      return { min: Math.min(min, max), max: Math.max(min, max), currency: "USD", period: "annual" };
    }
  }

  const plainMatch = PLAIN_COMMA_RANGE_RE.exec(text);
  if (plainMatch) {
    const min = toNumber(plainMatch[1]);
    const max = toNumber(plainMatch[2]);
    // Sanity-bound so an unrelated dollar range (e.g. "$1,000,000 Series A
    // round") in the surrounding JD text isn't mistaken for a salary — real
    // salary postings fall well inside this window.
    if (
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      min >= 1000 &&
      max >= 1000 &&
      min <= 1000000 &&
      max <= 1000000
    ) {
      return { min: Math.min(min, max), max: Math.max(min, max), currency: "USD", period: "annual" };
    }
  }

  return null;
}

module.exports = {
  SKILL_ENTRIES,
  norm,
  unique,
  escapeRegExp,
  buildSkillPattern,
  extractSkills,
  makeActions,
  missingSignals,
  classifySkillsImportance,
  computeScoreBreakdown,
  computeAtsScore,
  computeResumeEvidenceScore,
  computeDetailedAtsAnalysis,
  extractSalary,
  REQUIRED_SIGNAL_PHRASES,
  PREFERRED_SIGNAL_PHRASES,
};
