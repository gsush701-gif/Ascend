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

module.exports = {
  improveBullet,
  improveResume,
  generateCoverLetter,
  summarizeAlignment,
  isGroqConfigured: configured,
  GroqNotConfiguredError,
  GroqRequestError,
};
