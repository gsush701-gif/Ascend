const Groq = require("groq-sdk");
const { AsyncLocalStorage } = require("node:async_hooks");
const { addUsage } = require("./llmCost");

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

// Per-request token tally. server/index.js's callGroq() runs each route's Groq
// work inside runWithUsage(acc, fn); chatJson then adds every completion's
// token usage to that request's accumulator without each of the ~15 prompt
// functions below having to thread it through. Outside runWithUsage (tests,
// scripts) there is no store and recording is a no-op.
const usageStore = new AsyncLocalStorage();
function runWithUsage(accumulator, fn) {
  return usageStore.run(accumulator, fn);
}

/**
 * Thrown when every model we're allowed to use is rate-limited at once. The
 * message is fixed and safe to show to a student as-is (respondAiError in
 * server/index.js passes it through), unlike a raw provider error.
 */
class AiBusyError extends Error {
  constructor() {
    super("Ascend's AI is very busy right now. Please try again in a minute.");
    this.name = "AiBusyError";
    this.statusCode = 503;
  }
}

/** Whether a provider error means "slow down / out of allowance", not "broken". */
function isRateLimitError(e) {
  if (!e) return false;
  if (e.status === 429) return true;
  return /rate.?limit|too many requests|tokens per (minute|day)|requests per (minute|day)/i.test(String(e.message || ""));
}

/**
 * Models to try in order: the main one, then any fallbacks. Groq's free plan
 * gives each model its own allowance (requests and tokens per minute and day),
 * so when the main model is used up a second one on the same key still has room.
 * Duplicates and blanks are dropped.
 */
function modelOrder(primary, fallbacksCsv) {
  const out = [primary];
  for (const m of String(fallbacksCsv ?? "").split(",")) {
    const name = m.trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

const GROQ_FALLBACK_MODELS = modelOrder(GROQ_MODEL, process.env.GROQ_FALLBACK_MODELS ?? "openai/gpt-oss-20b").slice(1);

/**
 * Builds the JSON-chat function every prompt below uses. Kept as a factory so
 * the fallback behaviour can be tested with a fake client.
 *
 * Rate-limited on a model => try the next one (nothing was spent on the failed
 * attempt). Any other error is a real failure and is NOT retried on another
 * model. Every model rate-limited => AiBusyError.
 */
function createChatJson({ getClient, models, recordUsage }) {
  return async function chatJson(systemPrompt, userPrompt, maxTokens = 1200) {
    const client = getClient();
    if (!client) throw new GroqNotConfiguredError();

    let completion;
    let usedFallback = false;
    let lastWasRateLimit = false;
    for (let i = 0; i < models.length; i++) {
      try {
        completion = await client.chat.completions.create({
          model: models[i],
          temperature: 0.6,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        usedFallback = i > 0;
        lastWasRateLimit = false;
        break;
      } catch (e) {
        if (isRateLimitError(e)) {
          lastWasRateLimit = true;
          continue;
        }
        throw new GroqRequestError(e.message || "Groq request failed");
      }
    }
    if (!completion) {
      if (lastWasRateLimit) throw new AiBusyError();
      throw new GroqRequestError("Groq request failed");
    }

    // Tokens were spent even if the body below turns out empty/malformed.
    recordUsage(completion.usage, { fallback: usedFallback });

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) throw new GroqRequestError("Groq returned an empty response");

    try {
      return JSON.parse(raw);
    } catch {
      throw new GroqRequestError("Groq returned malformed JSON");
    }
  };
}

const chatJson = createChatJson({
  getClient: () => (configured ? client : null),
  models: [GROQ_MODEL, ...GROQ_FALLBACK_MODELS],
  recordUsage: (usage, meta) => addUsage(usageStore.getStore(), usage, meta),
});

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
 * Rewrite a candidate's OWN resume bullets so they speak to one specific job.
 * Unlike improveResume, this never adds metrics or facts: it rewords what is
 * already written, uses the posting's vocabulary only where the original
 * supports it, and leaves a [bracketed blank] where a real result belongs, for
 * the candidate to fill in truthfully. The route validates the output against
 * the resume (server/lib/tailorBullets.js) before anything reaches the user.
 */
async function tailorBullets(resumeText, jobDescription, skills = {}) {
  const missing = Array.isArray(skills.missing) ? skills.missing.slice(0, 12) : [];
  const matched = Array.isArray(skills.matched) ? skills.matched.slice(0, 20) : [];

  const system = `You are an honest resume coach helping a student tailor their EXISTING resume bullets to one specific job posting.
You are given the resume text and the job description. Pick the 3 to 5 bullets from the resume's experience or project sections that are most relevant to this job AND could be stated more clearly, then rewrite each one.
Hard rules, never break them:
- Use ONLY facts that are in the original bullet. Never add a tool, technology, number, percentage, employer, team size, or outcome that the original bullet does not already state.
- Never raise the student's level of involvement. If they "helped", "assisted", "supported" or "worked on" something, keep it at that level. Do not turn it into "led", "owned", "managed", "architected", "spearheaded", "performed" or "designed".
- Make a meaningful change, not just a swapped verb: tighten the wording, put the most job-relevant detail first, and use the job description's own wording for something the bullet already says.
- Where the original leaves out something this job cares about, add a bracketed blank for the student to fill in truthfully instead of guessing. Use blanks such as [add the tool you used], [add how many], or [add result: e.g. users, time saved, or a percentage]. Most rewrites should have at least one blank. Never fill a blank yourself.
- "original" must be copied EXACTLY, word for word, from the resume text. Do not paraphrase it.
- "why" is one short sentence naming which requirement of the job this bullet speaks to.
- Do not touch bullets that are already strong, and do not write bullets about skills the student has not shown. If fewer than 3 bullets are worth changing, return fewer. If the resume has no bullets, return an empty list.
Respond with ONLY a JSON object of this exact shape:
{"bullets":[{"original": string, "rewritten": string, "why": string}]}`;

  const user = `Job description:\n"""${jobDescription.slice(0, 8000)}"""${
    matched.length ? `\n\nSkills from the posting the resume already shows: ${matched.join(", ")}` : ""
  }${missing.length ? `\n\nSkills from the posting the resume does NOT show (do not claim these): ${missing.join(", ")}` : ""}

Resume text:\n"""${resumeText.slice(0, 12000)}"""`;

  return chatJson(system, user, 1500);
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
- These questions are spoken aloud by a text-to-speech voice, not just read on screen. Phrase each one exactly as a real interviewer would say it out loud: under 25 words, one single clear ask, plain conversational wording. Never combine two questions into one, never write a long jargon-heavy run-on sentence, and never leave the ask vague or open to multiple interpretations.
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
- Never give a vague generality like "could be more detailed" or "good effort" on its own. Always name the specific thing that's missing or wrong: for a behavioral answer, name the exact STAR component that's weak or absent (e.g. "no measurable Result was given"); for a technical answer, name the exact concept, term, or step the candidate got wrong or skipped.
Respond with ONLY a JSON object of this exact shape:
{
  "feedback": string (2-4 sentences of direct, specific critique that names the exact gap, not a vague generality),
  "strengths": string[] (1-3 short bullets on what the answer did well),
  "improvements": string[] (1-3 short, concrete, actionable bullets on what to fix)
}`;

  const user = `Interview question:\n"""${question.slice(0, 1000)}"""\n\nCandidate's answer:\n"""${answer.slice(0, 4000)}"""${
    jobDescription ? `\n\nTarget job description:\n"""${jobDescription.slice(0, 4000)}"""` : ""
  }`;

  return chatJson(system, user, 1200);
}

/**
 * Core engine of the dynamic voice interview (Week 3) — generates ONE
 * conversational turn at a time, replacing the old fixed question-list
 * model (generateInterviewQuestions above, still used as-is by the
 * text-based interview prep page). Deliberately combines "decide what to do
 * next" and "phrase the natural reply" into a single call: two round trips
 * per turn would double latency/cost in a real-time voice loop for no real
 * capability gain, since one well-structured JSON response can carry both.
 *
 * `transcript` is `[{ speaker: "interviewer" | "candidate", text }]` — an
 * empty array means this is the very start of the interview (the system
 * prompt below has an explicit rule for that case, doubling as
 * "generateOpening()"). `topicsCovered`/`currentTopic`/
 * `followUpCountForTopic`/`turnCount` are the caller's persisted
 * conversation state (server/index.js's route is stateless per request —
 * see src/features/voiceInterview/conversationLogic.ts for how the caller
 * maintains this across turns).
 */
const MAX_FOLLOW_UPS_PER_TOPIC = 2;

async function generateInterviewTurn({
  jobDescription,
  companyName,
  roleTitle,
  transcript,
  topicsCovered,
  currentTopic,
  followUpCountForTopic,
  turnCount,
}) {
  // Server-side guard, independent of the topic label the model chose: the
  // client counts consecutive non-transition turns (conversationLogic.ts), and
  // past this many we tell the model outright that it must change topic.
  const followUps = Number.isFinite(followUpCountForTopic) ? followUpCountForTopic : 0;
  const mustMoveOn = followUps >= MAX_FOLLOW_UPS_PER_TOPIC;
  const system = `You are an experienced human interviewer conducting a realistic, spoken job interview for the role of ${roleTitle || "the target role"}${companyName ? ` at ${companyName}` : ""}, based on the job description below. Your goal is a natural professional conversation that evaluates the candidate — not a checklist of questions read in order.
Rules:
- Listen to what the candidate actually said in the transcript and reference specific things they mentioned earlier when it's natural to do so.
- The candidate's words come from speech-to-text, which often mishears names of tools, companies and technical terms (for example "Groq" heard as "crock", "Supabase" as "supabets"). When a word looks like a mishearing, silently take the most likely intended term. Never point out odd wording, and never ask the candidate to repeat or spell something just because it was transcribed badly.
- Never ask about something the candidate has already answered.
- Never follow a rigid script — decide the next turn based on the actual conversation so far.
- Don't praise every answer, and don't use the same acknowledgment twice in a row — vary your wording, or skip acknowledgment entirely and just transition.
- Never give the candidate the answer, never coach them, never tell them how to improve during the interview itself.
- Keep every interviewer turn SHORT: one or two short sentences, under about 35 words total, spoken aloud like a real person — no preamble, no long acknowledgements, no restating the candidate's answer back to them. Ask exactly one question at a time.
- Ground every question in this specific job description's actual responsibilities, skills, and domain — never generic filler that could apply to any job.
- If the transcript is empty, this is the very start of the interview: greet the candidate warmly, briefly explain in one sentence that you'll be asking about their experience and how they approach different situations, then ask an opening question about their background — all as one natural spoken turn.
- If the candidate's last answer is vague or generic, ask a clarifying follow-up that gets at a concrete specific (action FOLLOW_UP or CLARIFY).
- If the candidate mentioned an interesting specific detail worth exploring, dig into that detail (action EXPLORE_DETAIL), but only if the current topic still has follow-ups left (see the limit below).
- When the candidate has already explained their reasoning, approach, or decision, treat that as answered: acknowledge it in a few words and move on. Never ask them to justify, elaborate on, or re-explain the same reasoning again, and never circle back to a topic that is already covered.
- If the candidate gave a strong, complete answer, briefly acknowledge it (varied wording) and move to a new topic (action TRANSITION_TOPIC) rather than over-interrogating a good answer.
- Ask at most 2 follow-up questions on any one topic, then transition (action TRANSITION_TOPIC) to a different topic from the job description. A weak answer does not earn extra follow-ups; note it and move on.${
    mustMoveOn
      ? `
- IMPORTANT: you have ALREADY asked ${followUps} follow-ups on the current topic. Your next turn MUST be action TRANSITION_TOPIC to a clearly different topic${
          topicsCovered && topicsCovered.length ? ` (not one of: ${topicsCovered.join(", ")})` : ""
        }. Do not ask anything more about "${currentTopic || "the current topic"}".`
      : ""
  }
- Aim for the whole interview to run about 8-10 total exchanges. The candidate has had ${turnCount} turns so far, covering: ${topicsCovered && topicsCovered.length ? topicsCovered.join(", ") : "nothing yet"}${currentTopic ? `, currently discussing: ${currentTopic}` : ""}. Once turn count approaches that range and a reasonable spread of topics is covered (background, relevant experience, a problem-solving or behavioral situation grounded in the job, and motivation for the role), wrap up warmly (action CLOSE_INTERVIEW) — thank the candidate, tell them that's all the questions you have, and do not ask anything further.
Respond with ONLY a JSON object of this exact shape:
{"action": "FOLLOW_UP" | "CLARIFY" | "EXPLORE_DETAIL" | "TRANSITION_TOPIC" | "CLOSE_INTERVIEW", "message": string (the interviewer's next spoken line — natural, concise, one question at a time unless closing), "topic": string (a short 2-5 word label for what's currently being discussed, e.g. "preventive maintenance experience")}`;

  // Cap both the transcript length and total size sent per call — mirrors
  // the bounds every other Groq prompt in this file already applies
  // (jobDescription.slice(0, ...) etc.), scaled for a running conversation
  // instead of a single document.
  const recentTranscript = (transcript || []).slice(-20);
  const transcriptText = recentTranscript
    .map((t) => `${t.speaker === "interviewer" ? "Interviewer" : "Candidate"}: ${t.text}`)
    .join("\n")
    .slice(-12000);

  const user = `Job description:\n"""${(jobDescription || "").slice(0, 8000)}"""${
    companyName ? `\n\nCompany: ${companyName.slice(0, 200)}` : ""
  }${roleTitle ? `\n\nRole title: ${roleTitle.slice(0, 200)}` : ""}

Conversation so far${transcriptText ? ":" : " (empty — this is the start)"}
${transcriptText}`;

  return chatJson(system, user, 500);
}

/**
 * Final evaluation for a completed dynamic voice interview (Week 3) —
 * called once when the conversation closes. Grounded entirely in the
 * candidate's own transcript, never generic filler (same "no fabricated
 * placeholder content" ethos as every scored feature in this app).
 */
async function generateInterviewEvaluation(transcript, jobDescription) {
  const system = `You are an experienced hiring manager writing a candid, specific post-interview evaluation of a candidate based on a full interview transcript${jobDescription ? " and the job description they were interviewing for" : ""}.
Rules:
- Base every score and every bullet point strictly on what the candidate actually said in the transcript — never invent or assume anything not present in it.
- The transcript was produced by speech-to-text, which often mishears names of tools, companies and technical terms ("Groq" as "crock", "Supabase" as "supabets", a project name as something unrelated). Never mark the candidate down for odd, garbled or misspelled words, never quote them as evidence of confusion, and never call an answer incomprehensible because of the wording alone. When a phrase looks like a mishearing, read it as the most likely intended term and judge the substance. Only call an answer vague if its content is vague.
- Write to the candidate directly, in the second person ("you described...", "your answer..."), never "he", "she" or "the candidate".
- Be honest: a mediocre interview should score in the middle of the range and say why, not be inflated.
- Every string in strongAnswers/weakAnswers/areasForImprovement/suggestedBetterAnswers/struggledFollowUps must reference something specific and concrete from the transcript, quoting or closely paraphrasing it — never a generic statement that could apply to any candidate.
- suggestedBetterAnswers should show what a stronger answer to a specific weak moment would have included, not just criticize it again.
Respond with ONLY a JSON object of this exact shape:
{
  "overallScore": number (0-100),
  "communication": number (0-100),
  "relevance": number (0-100, how relevant the candidate's answers were to the job description),
  "technicalKnowledge": number (0-100),
  "problemSolving": number (0-100),
  "confidence": number (0-100),
  "completeness": number (0-100, how fully the candidate answered what was asked),
  "behavioralQuality": number (0-100, STAR-structure quality of behavioral answers),
  "usedConcreteExamples": boolean,
  "strongAnswers": string[] (1-4 specific moments that were genuinely strong, referencing what was said),
  "weakAnswers": string[] (1-4 specific moments that were weak, referencing what was said),
  "areasForImprovement": string[] (2-5 concrete, actionable bullets),
  "suggestedBetterAnswers": string[] (1-3 bullets: for one specific weak moment, what a stronger answer would have included),
  "struggledFollowUps": string[] (0-3 follow-up questions the candidate visibly struggled to answer well, or empty if none)
}`;

  const user = `Interview transcript:\n"""${transcript.slice(0, 16000)}"""${
    jobDescription ? `\n\nJob description:\n"""${jobDescription.slice(0, 4000)}"""` : ""
  }`;

  return chatJson(system, user, 1800);
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
  tailorBullets,
  improveLinkedInSection,
  generateCoverLetter,
  generateInterviewQuestions,
  generateInterviewFeedback,
  generateInterviewTurn,
  generateInterviewEvaluation,
  summarizeAlignment,
  generateSkillRoadmap,
  recommendProject,
  generateColdEmail,
  careerAdvice,
  summarizeCareerReport,
  parseResumeToStructured,
  generateResumeSuggestions,
  RESUME_SECTIONS,
  runWithUsage,
  createChatJson,
  isRateLimitError,
  modelOrder,
  AiBusyError,
  GROQ_FALLBACK_MODELS,
  isGroqConfigured: configured,
  GROQ_MODEL,
  GroqNotConfiguredError,
  GroqRequestError,
};
