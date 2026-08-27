const Groq = require("groq-sdk");

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const configured = Boolean(GROQ_API_KEY);

if (!configured) {
  console.warn(
    "[groq] GROQ_API_KEY not set — AI resume features will return an error " +
      "until it's configured (frontend falls back to the offline template).",
  );
}

const client = configured ? new Groq({ apiKey: GROQ_API_KEY }) : null;

class GroqNotConfiguredError extends Error {
  constructor() {
    super("Groq API key is not configured on the server.");
    this.name = "GroqNotConfiguredError";
    this.statusCode = 503;
  }
}

class GroqRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = "GroqRequestError";
    this.statusCode = 502;
  }
}

async function chatJson(systemPrompt, userPrompt, maxTokens = 1200) {
  if (!configured) throw new GroqNotConfiguredError();

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.6,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
  } catch (e) {
    throw new GroqRequestError(e.message || "Groq request failed");
  }

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) throw new GroqRequestError("Groq returned an empty response");

  try {
    return JSON.parse(raw);
  } catch {
    throw new GroqRequestError("Groq returned malformed JSON");
  }
}

/**
 * Rewrite a single resume bullet with clarity, technical depth, and a
 * plausible quantified impact.
 */
async function improveBullet(bullet) {
  const system = `You are an expert technical resume writer for software engineering internships.
Rewrite a single resume bullet to be concise, specific, and impact-driven.
Rules:
- Keep it to one line, start with a strong past-tense action verb.
- Name concrete technologies if implied or stated; don't invent unrelated tech.
- Include a plausible quantified outcome (%, scale, time saved) only if it's a reasonable inference — otherwise suggest where to add one.
- Do not fabricate employers, dates, or specific proprietary numbers presented as fact; phrase invented metrics as natural resume style (e.g. "reduced load time by ~30%") rather than claiming certainty about the user's real results.
Respond with ONLY a JSON object of this exact shape:
{"improved": string, "why": string (1 sentence on why it's stronger), "stack": string (tech stack detected/suggested, or "—"), "impact": string (the impact metric used or suggested, or "—")}`;

  const user = `Original bullet:\n"""${bullet}"""`;

  return chatJson(system, user);
}

/**
 * Critique and partially rewrite a full resume's text, optionally tailored
 * to a job description.
 */
async function improveResume(resumeText, jobDescription) {
  const system = `You are an expert technical resume reviewer for software engineering internships/new-grad roles.
Given raw text extracted from a candidate's resume PDF (formatting/line breaks may be imperfect)${
    jobDescription ? " and a target job description" : ""
  }, produce a concise, actionable critique.
Respond with ONLY a JSON object of this exact shape:
{
  "summary": string (2-3 sentences: overall impression and biggest opportunity),
  "topFixes": string[] (3-5 short, concrete, prioritized action items),
  "rewrittenBullets": [{"original": string, "improved": string}] (pick the 3-5 weakest bullet lines you can find in the text and rewrite each with clarity, tech stack, and quantified impact)
}
Only use content that appears in the resume text; do not invent employers or dates. Quantified metrics you add should read as natural resume phrasing, not as claims of verified fact.`;

  const user = jobDescription
    ? `Resume text:\n"""${resumeText.slice(0, 12000)}"""\n\nTarget job description:\n"""${jobDescription.slice(0, 4000)}"""`
    : `Resume text:\n"""${resumeText.slice(0, 12000)}"""`;

  return chatJson(system, user);
}

/**
 * Rewrite a LinkedIn profile section (headline or About) to be more
 * compelling, keyword-rich, and specific to the candidate's real input.
 */
async function improveLinkedInSection(text, section, targetRole) {
  const isHeadline = section === "headline";
  const system = isHeadline
    ? `You are an expert LinkedIn profile writer for software engineering candidates.
Rewrite the candidate's LinkedIn headline to be punchy, keyword-rich (for recruiter search), and specific about what they do${
        targetRole ? `, tailored toward a "${targetRole}" role` : ""
      }.
Rules:
- LinkedIn headlines have a hard limit of about 220 characters — keep the rewrite comfortably under that.
- Use concrete technologies, roles, or specialties from the candidate's input; don't invent unrelated skills.
- Avoid generic filler like "passionate professional" or "hard worker" — be specific instead.
- Separators like "|" or "•" between a few short phrases work well; do not write full sentences.
Respond with ONLY a JSON object of this exact shape:
{"improved": string, "why": string (1 sentence on why it's stronger)}`
    : `You are an expert LinkedIn profile writer for software engineering candidates.
Rewrite the candidate's LinkedIn About section into a compelling narrative${
        targetRole ? `, tailored toward a "${targetRole}" role` : ""
      }.
Rules:
- Write a few short paragraphs (not a single wall of text, not bullet points).
- Professional but written in first person with a human voice — not generic corporate boilerplate.
- Incorporate the candidate's real background, skills, and interests from their input; don't invent employers, dates, or credentials that aren't implied.
- End with something that invites connection (what they're looking for, or what they're excited about) if it fits naturally.
Respond with ONLY a JSON object of this exact shape:
{"improved": string, "why": string (1 sentence on why it's stronger)}`;

  const user = `Current ${isHeadline ? "headline" : "About section"}:\n"""${text}"""`;

  const result = await chatJson(system, user);

  if (isHeadline && typeof result.improved === "string" && result.improved.length > 260) {
    throw new GroqRequestError("Groq returned a headline far over LinkedIn's character limit");
  }

  return result;
}

/**
 * Draft a tailored cover letter for a specific role, grounded in the
 * candidate's actual resume text and the role's job description.
 */
async function generateCoverLetter(resumeText, jobDescription, companyName, roleTitle) {
  const system = `You are an expert career writer drafting cover letters for software engineering internship/new-grad candidates.
Given raw text extracted from a candidate's resume PDF (formatting/line breaks may be imperfect) and a target job description${
    companyName ? `, for a role at ${companyName}` : ""
  }${roleTitle ? ` titled "${roleTitle}"` : ""}, write a professional, specific cover letter — not a generic template.
Rules:
- 250-400 words.
- Reference concrete skills, projects, or experience that actually appear in the resume text, and concrete requirements/technologies from the job description — avoid vague, generic-sounding filler ("I am a hard worker", "I am excited about this opportunity") in favor of specifics.
- Confident, professional tone. Do not fabricate employers, dates, titles, or credentials that don't appear in the resume.
- Output only the letter body (a greeting like "Dear Hiring Manager," and a sign-off are fine); no letterhead, date, or address block.
Respond with ONLY a JSON object of this exact shape:
{
  "coverLetter": string,
  "keyPoints": string[] (2-4 short bullets summarizing what the letter emphasizes, for the candidate's own reference, e.g. "Emphasized your React + Node experience against their full-stack requirement")
}`;

  const user = `Resume text:\n"""${resumeText.slice(0, 12000)}"""\n\nTarget job description:\n"""${jobDescription.slice(0, 4000)}"""${
    companyName ? `\n\nCompany: ${companyName.slice(0, 200)}` : ""
  }${roleTitle ? `\n\nRole title: ${roleTitle.slice(0, 200)}` : ""}`;

  // A 250-400 word letter plus key points runs well past the 1200-token
  // default other (shorter) callers use here — this model also spends
  // tokens on internal reasoning before it emits the JSON body, so give it
  // enough headroom to actually finish the document instead of truncating
  // mid-generation (which fails JSON validation entirely).
  return chatJson(system, user, 3000);
}

/**
 * Generate a realistic mock-interview question set grounded in a specific
 * job description, mixing behavioral and technical/role-specific questions.
 */
async function generateInterviewQuestions(jobDescription, companyName, roleTitle) {
  const system = `You are an experienced technical interviewer preparing mock interview questions for a software engineering internship/new-grad candidate.
Given a target job description${companyName ? `, for a role at ${companyName}` : ""}${roleTitle ? ` titled "${roleTitle}"` : ""}, write a realistic set of interview questions grounded in the actual responsibilities, requirements, and technologies named in the job description — not generic filler questions that could apply to any job.
Rules:
- Produce 6-8 questions total.
- Include a mix of "behavioral" questions (past experience, teamwork, conflict, ownership — phrased so a STAR-method answer fits naturally) and "technical" questions (role-specific technical knowledge, the actual stack/tools/domain named in the job description, or realistic problem-solving scenarios for that role).
- Each question must be tagged with exactly one category: "behavioral" or "technical".
- Do not invent employers, companies, or credentials for the candidate; the questions should be things an interviewer would ask, not statements about the candidate.
Respond with ONLY a JSON object of this exact shape:
{"questions": [{"question": string, "category": "behavioral" | "technical"}]}`;

  const user = `Target job description:\n"""${jobDescription.slice(0, 8000)}"""${
    companyName ? `\n\nCompany: ${companyName.slice(0, 200)}` : ""
  }${roleTitle ? `\n\nRole title: ${roleTitle.slice(0, 200)}` : ""}`;

  return chatJson(system, user, 2000);
}

/**
 * Critique a candidate's answer to a single mock interview question, checked
 * against STAR structure (behavioral) or technical accuracy/depth
 * (technical), plus general clarity/conciseness.
 */
async function generateInterviewFeedback(question, answer, jobDescription) {
  const system = `You are an experienced technical interviewer giving direct, constructive feedback on one mock interview answer for a software engineering internship/new-grad candidate.
Given the interview question, the candidate's answer${jobDescription ? ", and the target job description for context" : ""}, write a genuinely useful critique — not generic praise.
Rules:
- If the question is behavioral, check whether the answer follows a clear STAR structure (Situation, Task, Action, Result) and call out what's missing.
- If the question is technical, assess accuracy, depth, and whether the answer actually addresses what was asked.
- Always consider clarity and conciseness.
- Be honest about weaknesses as well as strengths; do not just flatter the candidate.
Respond with ONLY a JSON object of this exact shape:
{
  "feedback": string (2-4 sentences of direct, specific critique),
  "strengths": string[] (1-3 short bullets on what the answer did well),
  "improvements": string[] (1-3 short, concrete, actionable bullets on what to fix)
}`;

  const user = `Interview question:\n"""${question.slice(0, 1000)}"""\n\nCandidate's answer:\n"""${answer.slice(0, 4000)}"""${
    jobDescription ? `\n\nTarget job description:\n"""${jobDescription.slice(0, 4000)}"""` : ""
  }`;

  return chatJson(system, user, 1200);
}

/**
 * One short natural-language summary layered on top of the deterministic
 * /analyze keyword-match score. Best-effort — callers should catch and
 * degrade gracefully if this throws.
 */
async function summarizeAlignment(resumeText, jobDescription, report) {
  const system = `You are a technical recruiter giving a candidate a 2-3 sentence, direct, encouraging-but-honest read on how well their resume matches a job description, given a keyword coverage score that's already been computed. Do not repeat the raw score back verbatim; add color a keyword match can't: whether the *experience* looks aligned, and the single highest-leverage thing to fix. Respond with ONLY a JSON object: {"aiSummary": string}`;

  const user = `Coverage score: ${report.coverage}%. Alignment score: ${report.alignment}%. Missing signals: ${report.missingSignals.join("; ") || "none"}.\n\nResume text:\n"""${resumeText.slice(0, 8000)}"""\n\nJob description:\n"""${jobDescription.slice(0, 3000)}"""`;

  const result = await chatJson(system, user);
  return typeof result.aiSummary === "string" ? result.aiSummary : null;
}

/**
 * Generate a short, concrete learning path for one missing required skill
 * (Phase 6a, Task 1). `context` is optional free text about the target
 * role/company, used only to steer relevance — never treated as fact about
 * the candidate beyond what's given.
 */
async function generateSkillRoadmap(skillName, context) {
  const system = `You are a pragmatic technical mentor helping a software engineering internship/new-grad candidate close one specific skill gap identified against a real job description.
Given a single missing skill${context ? " and brief context about the target role/company" : ""}, produce a short, concrete, sequential learning path — not generic advice like "read the docs" or "practice more".
Rules:
- Produce 4-6 steps, ordered from "start here" to "resume-ready".
- Each step must be a specific, concrete action (e.g. "Build a small REST API with Docker and deploy it to a free host" not "learn Docker").
- The last step should be about actually reflecting the new skill on a resume/portfolio (e.g. "Add a bullet describing the containerized project to your resume").
- Keep each step to one short sentence.
- Do not fabricate claims about the candidate already having related experience; assume they're starting from the skill being genuinely missing.
Respond with ONLY a JSON object of this exact shape:
{"steps": string[]}`;

  const user = `Missing skill: "${skillName}"${context ? `\n\nContext (target role/company, if relevant): """${context.slice(0, 500)}"""` : ""}`;

  return chatJson(system, user, 800);
}

/**
 * Suggest ONE concrete, buildable project idea that covers multiple of a
 * candidate's missing skills, grounded in whatever real resume text is
 * available (Phase 6a, Task 2 — a scoped-down stand-in for the deferred
 * GitHub-integration-powered version, since no GitHub OAuth app exists yet).
 */
async function recommendProject(missingSkills, existingResumeText) {
  const system = `You are a pragmatic technical mentor suggesting portfolio projects for a software engineering internship/new-grad candidate, based on a real list of skills missing from their resume against a target job.
Given a list of missing skills${existingResumeText ? " and the candidate's existing resume text (for context on their current level/background — formatting/line breaks may be imperfect)" : ""}, suggest exactly ONE concrete, genuinely buildable project idea that covers as many of the missing skills as plausibly fit into one coherent project — do not force in skills that don't fit naturally.
Rules:
- The project must be realistic for one person to actually build in a reasonable amount of time (days to a few weeks), not an enterprise-scale idea.
- Be specific about what the project does, not just which skills it touches (e.g. "Production Job Tracker API — a REST API for saving/searching job applications" not "an app to practice AWS and Docker").
- Only list skills in "skillsCovered" that are genuinely, naturally exercised by the project as described.
- Do not fabricate anything about the candidate's existing experience beyond what's in their resume text; if no resume text is given, just don't reference their background.
Respond with ONLY a JSON object of this exact shape:
{
  "title": string (short, specific project name),
  "description": string (2-4 sentences: what it does and why it's a good fit for these gaps),
  "skillsCovered": string[] (subset of the missing skills this project genuinely covers)
}`;

  const skillsList = missingSkills.slice(0, 20).join(", ");
  const user = existingResumeText
    ? `Missing skills: ${skillsList}\n\nCandidate's existing resume text:\n"""${existingResumeText.slice(0, 8000)}"""`
    : `Missing skills: ${skillsList}`;

  return chatJson(system, user, 1000);
}

/**
 * Draft a short, personalized cold outreach / networking message to a real
 * contact, grounded strictly in real data (Phase 6a, Task 3). Critical
 * constraint from the product spec: never fabricate a shared connection,
 * mutual acquaintance, or any claim not actually present in the data passed
 * in — `contactInfo`/`jobContext`/`candidateProfile` must only ever contain
 * real, already-verified fields (callers are responsible for that; this
 * function additionally instructs the model not to invent beyond them).
 */
async function generateColdEmail(contactInfo, jobContext, candidateProfile) {
  const system = `You are an expert career coach helping a software engineering internship/new-grad candidate draft a short, genuine cold outreach message to a real professional contact.
Given real facts about the contact, optionally a target role/company, and the candidate's own profile, write a short (100-150 word) message suitable for LinkedIn or email.
Rules:
- Use ONLY the facts given below. Do not invent a shared connection, mutual acquaintance, shared school/employer overlap, or any other claim not explicitly present in the data provided — if nothing like that is given, do not imply one exists (no "I noticed we both..." unless that specific fact was actually provided).
- Be specific about why this candidate is reaching out to THIS contact (their role/company/relationship, if known) rather than generic networking filler.
- Reference the candidate's real background (major/target role) and, if given, the specific role/company they're interested in.
- Confident but humble tone; end with a clear, low-friction ask (e.g. a short call, advice, or a referral if that fits naturally — don't presume one is owed).
- No subject line, no letterhead — just the message body, greeting through sign-off.
Respond with ONLY a JSON object of this exact shape:
{"message": string}`;

  const contactLines = [
    `Name: ${contactInfo.name}`,
    contactInfo.title ? `Title: ${contactInfo.title}` : null,
    contactInfo.company ? `Company: ${contactInfo.company}` : null,
    contactInfo.relationship ? `Relationship to candidate: ${contactInfo.relationship}` : null,
    contactInfo.source ? `How the candidate knows/found them: ${contactInfo.source}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const jobLines = jobContext
    ? [
        jobContext.company ? `Company: ${jobContext.company}` : null,
        jobContext.roleTitle ? `Role: ${jobContext.roleTitle}` : null,
        jobContext.jobDescription ? `Job description excerpt: """${jobContext.jobDescription.slice(0, 2000)}"""` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : null;

  const profileLines = [
    candidateProfile.fullName ? `Name: ${candidateProfile.fullName}` : null,
    candidateProfile.major ? `Major: ${candidateProfile.major}` : null,
    candidateProfile.targetRole ? `Target role: ${candidateProfile.targetRole}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const user = `Contact (real facts only):\n${contactLines}\n\n${
    jobLines ? `Target role/company (real facts only):\n${jobLines}\n\n` : ""
  }Candidate's own profile (real facts only):\n${profileLines || "(no profile info available)"}`;

  // Same reasoning-overhead issue as generateCoverLetter above — this model
  // spends tokens "thinking" before emitting the JSON body, and a short
  // limit here was observed to truncate before a valid document completed.
  return chatJson(system, user, 1800);
}

/**
 * Answer a candidate's question about their own job search using ONLY real
 * data assembled server-side for them (Phase 6a, Task 4). `userContext` must
 * be built by the caller from the user's actual data (their real alignment
 * score, matched/missing skills for a specific role, profile target role) —
 * never fabricated. The system prompt instructs the model to work strictly
 * from that context and say so plainly when it's insufficient, rather than
 * inventing statistics about the user.
 */
async function careerAdvice(question, userContext) {
  const system = `You are a direct, honest career advisor answering ONE question from a software engineering internship/new-grad candidate about their own job search.
You are given real, already-computed data about this candidate (a specific role's fit score and matched/missing skills, if applicable, and/or their profile's target role) — this is the ONLY information you have about them.
Rules:
- Answer using ONLY the real context provided below. Do not invent a fit score, skill, statistic, or fact about this candidate that isn't explicitly given.
- If the provided context is insufficient to actually answer the question (e.g. they ask about a specific role but no role context was given), say so plainly and explain what's missing, rather than guessing or answering generically as if it applied to them.
- Be direct and specific, citing the actual numbers/skills given where relevant (e.g. "Your fit score for this role is 62%, and you're missing X and Y" rather than vague encouragement).
- Keep the answer to 2-5 sentences.
Respond with ONLY a JSON object of this exact shape:
{"answer": string}`;

  const user = `Candidate's question: "${question}"\n\nReal context available about this candidate:\n${userContext}`;

  return chatJson(system, user, 700);
}

/**
 * One short, honest sentence layered on top of a client-computed weekly/
 * period career report (Phase 6a, Task 5). `stats` must be a small object of
 * already-computed real numbers (applications, interviews, offers, response
 * rate, etc) — this function never receives raw resume/JD content, and the
 * prompt instructs the model to only narrate the numbers given, never invent
 * additional ones. Best-effort — callers should catch and degrade gracefully.
 */
async function summarizeCareerReport(stats) {
  const system = `You are a direct, encouraging-but-honest career coach summarizing a candidate's job-search activity for one period, using ONLY the already-computed real numbers given to you.
Write exactly 1-2 sentences of plain-language summary/insight. Do not invent any statistic, comparison, or claim not derivable from the numbers given. If the sample size is very small (e.g. fewer than 3 applications total), say so explicitly rather than implying a trend exists.
Respond with ONLY a JSON object: {"summary": string}`;

  const user = `Period stats (JSON): ${JSON.stringify(stats)}`;

  const result = await chatJson(system, user, 400);
  return typeof result.summary === "string" ? result.summary : null;
}

// The exact top-level keys of `resumes.structured_content`
// (supabase/migrations/015_resume_structured_content.sql) — shared between
// the parser prompt below, the suggestions prompt below, and
// server/index.js's request validation for `/api/resume-suggestions`'
// optional `section` field, so the three never drift out of sync.
const RESUME_SECTIONS = [
  "contact",
  "summary",
  "education",
  "experience",
  "projects",
  "skills",
  "certifications",
  "awards",
];

/**
 * Extract raw resume text (from `resumes.extracted_text`) into the
 * structured shape documented in
 * supabase/migrations/015_resume_structured_content.sql (Phase 7, Resume
 * Editor Task 1). Deliberately conservative: the prompt instructs the model
 * to leave a field/section empty rather than guess, and this is genuinely
 * load-bearing — a fabricated degree, employer, or date here would land
 * directly on a document the candidate might submit to a real employer.
 * Callers must NOT persist the result automatically; it's returned for the
 * frontend to show the user for review before the first save (see
 * src/features/resumeEditor/hooks/useResumeEditor.ts).
 */
async function parseResumeToStructured(extractedText) {
  const system = `You are an expert resume parser. Given raw text extracted from a candidate's resume PDF (formatting/line breaks may be imperfect, columns/tables may have merged awkwardly), extract it into a structured JSON representation.
Rules:
- Be conservative: if a section genuinely is not present anywhere in the source text, return it empty ("" for strings, [] for empty array sections) — never invent, guess, or pad content that isn't actually in the text.
- Never fabricate degrees, schools, employers, job titles, dates, or metrics that don't appear in the source text. If a single field within an entry (e.g. GPA, an end date, a location) isn't stated, leave that field as an empty string rather than guessing at it.
- Preserve the candidate's actual wording for bullets/summaries/descriptions; light cleanup of obvious OCR or line-break artifacts is fine, rewriting or embellishing content is not — this is extraction, not editing.
- Every array entry you produce must correspond to one real, distinct item you can point to in the source text (one real job, one real degree, one real project, etc) — do not split or merge entries in ways that don't reflect the source.
Respond with ONLY a JSON object of this exact shape:
{
  "contact": {"name": string, "email": string, "phone": string, "location": string, "linkedin": string, "portfolio": string},
  "summary": string,
  "education": [{"school": string, "degree": string, "field": string, "startDate": string, "endDate": string, "gpa": string}],
  "experience": [{"company": string, "title": string, "location": string, "startDate": string, "endDate": string, "bullets": string[]}],
  "projects": [{"name": string, "description": string, "technologies": string[], "bullets": string[]}],
  "skills": string[],
  "certifications": [{"name": string, "issuer": string, "date": string}],
  "awards": [{"name": string, "issuer": string, "date": string}]
}
Use "" for any string field you cannot find in the source text, and [] for any array section with no real entries — every key must be present even when empty.`;

  const user = `Raw resume text:\n"""${extractedText.slice(0, 18000)}"""`;

  // A full resume's worth of structured JSON (contact + summary + several
  // education/experience/project entries, each with multiple bullets) runs
  // well past the 1200-token default other (shorter) callers use — give it
  // enough headroom to finish instead of truncating mid-document.
  return chatJson(system, user, 3500);
}

/**
 * Propose 2-5 concrete edits to a candidate's already-parsed structured
 * resume content (Phase 7, Resume Editor Task 1), optionally scoped to one
 * section. Every suggestion must be grounded in text that's actually present
 * in `structuredContent` — see the anti-fabrication rules in the prompt.
 * Suggestions are never applied automatically; the route that calls this
 * inserts them into `resume_suggestions` with `status: 'pending'` for the
 * user to accept (optionally edited first) or reject.
 */
async function generateResumeSuggestions(structuredContent, section) {
  const scoped = typeof section === "string" && RESUME_SECTIONS.includes(section);

  const system = `You are an expert technical resume reviewer for software engineering internship/new-grad candidates, proposing concrete edits to a candidate's already-parsed, structured resume content.
Given the candidate's structured resume data${scoped ? `, focused only on the "${section}" section` : ""}, propose ${scoped ? "2-4" : "2-5"} specific, concrete edits that would make it stronger.
Rules:
- Only use content that already appears in the structured data below — do not invent employers, schools, dates, titles, or metrics that aren't there. A quantified metric you add to a bullet should read as natural resume phrasing (e.g. "~30%"), not as a claim of certainty about a number that isn't given.
- Each suggestion must target ONE specific existing piece of text (a single bullet, the summary, one project's description, etc) and propose a concrete rewrite of it — not vague advice like "add more detail" or "make this stronger".
- "originalText" must be copied verbatim from the structured data below (the exact bullet/summary/description text being improved). Only use an empty string for "originalText" when proposing genuinely new content for a field that is currently empty (e.g. writing a first draft of an empty summary, or adding a skill that's implied elsewhere but not yet listed) — never fabricate what "originalText" was if you're actually rewriting existing text.
- "section" must be exactly one of: ${RESUME_SECTIONS.join(", ")} — matching which top-level part of the structured data the suggestion applies to.${
    scoped ? `\n- Every suggestion's "section" must be "${section}".` : ""
  }
Respond with ONLY a JSON object of this exact shape:
{"suggestions": [{"section": string, "originalText": string, "proposedText": string, "reason": string (1 short sentence on why this is stronger)}]}`;

  const dataToShow = scoped ? { [section]: structuredContent?.[section] } : structuredContent;
  const user = `Candidate's structured resume data (JSON):\n${JSON.stringify(dataToShow ?? {}).slice(0, 12000)}`;

  return chatJson(system, user, 2000);
}

module.exports = {
  improveBullet,
  improveResume,
  improveLinkedInSection,
  generateCoverLetter,
  generateInterviewQuestions,
  generateInterviewFeedback,
  summarizeAlignment,
  generateSkillRoadmap,
  recommendProject,
  generateColdEmail,
  careerAdvice,
  summarizeCareerReport,
  parseResumeToStructured,
  generateResumeSuggestions,
  RESUME_SECTIONS,
  isGroqConfigured: configured,
  GROQ_MODEL,
  GroqNotConfiguredError,
  GroqRequestError,
};
