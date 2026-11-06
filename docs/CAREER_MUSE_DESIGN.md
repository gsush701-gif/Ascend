# Ascend as a career advisor ("Kairos as a muse"): audit and design

Status: phase 1 built (the "This week" card and its server engine); phases 2 to 5 are still proposals. Written 2026-11-06.

The idea: Ascend should not wait to be asked. It should know the student's goal, resume and
applications, notice what matters this week, say it in a warm and honest voice, and send them
straight to the tool that does the work. The student stays the author. The advisor suggests,
drafts and reminds; it never acts without approval.

## 1. Audit: what exists today

| Piece | State | Where |
| --- | --- | --- |
| Advisor ("Kairos") | Single-turn Q and A. Input is one question (max 500 chars) and optionally one role. It sees major, target role and that one role's score and skills. No conversation memory, no resume, no view of the whole tracker. Free plan: 20 questions a month. | `POST /api/career-advice`, `src/routes/Assistant.tsx` |
| Tracker data per role | Rich: status (12 stages), fit score, saved report with skills (required or preferred), missing signals, actions, deadline, follow-up date, interview date, applied date, notes, priority, source (for example LinkedIn from the extension), referral, cover letter, interview prep. | `src/types/tracker.ts`, `roles` table |
| Dashboard "Focus" | One deterministic next action (overdue, needs analysis, deadline soon, stale 10+ days). Good, but one item and text only. | `getFocusAction` in `src/lib/dashboardStats.ts` |
| Weekly report | Counts, a response rate, up to two rule-based recommendations, an email through Resend. Runs Monday 13:00 UTC from GitHub Actions. Opt-in and off by default. Weeks are UTC. | `server/lib/weeklyReport.js`, `.github/workflows/weekly-report.yml` |
| Career goals | Title, target date, application, interview and offer targets. | `career_goals` table |
| Resume structure | `resumes.structured_content` (education, experience, projects, skills). Null until the resume is parsed. | migration 015 |
| Notifications | In-app table exists (type, title, message, read). | `notifications` table |
| Action tools | Resume Lab, tailor bullets, cover letter, cold email (follow-up drafts), skill roadmap, project recommendation, GitHub project match, interview prep, voice interview. | `server/index.js` routes |
| Cost and limits | Plan quotas per feature in `server/lib/plans.js`. LLM price about 0.15 USD per million input tokens and 0.75 USD per million output tokens. | `server/lib/llmCost.js` |
| Job discovery | No job-listing provider configured, so Ascend cannot suggest new roles. | `server/lib/jobProviders` |

### Gaps and findings

1. The building blocks all exist, but nothing connects them into a loop. The advisor does not know
   what the dashboard knows.
2. Weekly reports are off by default, so almost nobody gets the one proactive touchpoint that exists.
3. Deadlines: the UI reads and writes the older free-text `deadline` field. The typed `deadline_at`
   exists but only the readiness helper uses it. New logic must read `deadline` first and fall back
   to `deadline_at`.
4. The advisor's 20 free questions a month would be used up in one chat session, so a conversational
   version needs a different limit.
5. There is no record of what the advisor suggested or whether the student acted on it, so we
   cannot learn whether it helps. Events through `/api/track` can cover this.
6. The weekly report logic is a hand-written port of a TypeScript file, so two copies can drift.
   The new signal logic should have exactly one implementation.

## 2. Principles

1. Plain code decides what matters. The AI only phrases it. Every claim comes from a stored row
   (this is already how `/api/career-advice` is built). The model never invents a score, skill or date.
2. Three things at most. A muse is not a to-do list. Rank, cap at three, one item per role.
3. Every suggestion has a button that does the next step (open the role, Resume Lab, the cover letter,
   a follow-up draft).
4. The student decides. No auto-applying, no sending email for them. Drafts only.
5. Honest when there is little data. With no roles, say so and point to the first step.
6. Cheap by default. The first version costs nothing per user.

## 3. The weekly plan ("This week")

### Signals (deterministic, computed from the tracker)

| # | Signal | Trigger | Suggested step (button) |
| - | --- | --- | --- |
| S1 | Overdue | Deadline passed and status is before Applied | Update the status, or archive it (open role) |
| S2 | Closing soon | Deadline within 7 days and not applied | Pick the first missing prerequisite: analyze, tailor the resume, write the cover letter, then apply |
| S3 | Interview soon | Interview date within 7 days | Practice (interview prep or voice interview) |
| S4 | Follow-up due | Follow-up date reached, or Applied with no update for 10+ days | Draft a follow-up (cold email tool) |
| S5 | Needs analysis | Role with no saved report | Analyze it |
| S6 | Recurring gap | Same required skill missing in 2+ roles | Get a project idea or roadmap for it |
| S7 | Weak resume for a role | Fit below 60 on a role the student cares about (high priority or deadline soon) | Resume Lab, tailor bullets |
| S8 | Thin pipeline | Fewer than 3 applications in the last 14 days (or behind a goal) | Add or analyze more roles |
| S9 | Gone quiet | No activity for 7 days | A gentle nudge to do one small thing |
| S10 | Set up | No resume saved, or no target role | Add them (this is also where the major and target role question belongs) |

Ranking: time-critical first (S1, S3, S2, S4), then quality (S7, S6, S5), then habit (S8, S9, S10).
One item per role. Take the top three. Each item carries `{ id, signal, roleId?, title, why, action }`
where `why` is built from real numbers ("fit 58%, deadline Fri 14 Nov, no cover letter yet").

### Where it appears

- Top of the dashboard: a card titled "This week" with the three items and their buttons.
  Empty state when there are no roles: "Start with one posting" with the example button.
- Kairos opens with it: the advisor page shows the same three items above the chat box.
- Weekly email: the same three items, replacing the current two generic recommendations.

### The muse voice (AI layer)

One short note (two or three sentences) above the card, written by the model from the signals JSON
and the student's goal and name. Example: "Three of your saved roles ask for Docker, and the Acme
deadline is Friday. A small Docker project plus a tailored cover letter would move both."
Rules in the prompt: use only the given facts, no invented numbers, warm but direct, no
cheerleading, say so when data is thin. If the AI call fails or the quota is spent, show the
deterministic text. The page never depends on the AI.

Cost: about 600 input and 150 output tokens, roughly 0.0002 USD per user per week.

## 4. Conversational Kairos (later)

Multi-turn chat with a "context pack" built server-side from real rows: goal, resume summary
(structured content if parsed), tracker summary (counts by stage, top gaps, next deadlines), and the
current plan. The last six turns come from the client. About 2,500 input and 300 output tokens per
message, roughly 0.0006 USD, or about 1.2 cents for 20 messages. Replies can carry action chips
(open Resume Lab on this bullet, start practice for this role). The free limit should be raised
from 20 once this exists; at that cost, 40 a month is still cheap.

## 5. Delivery and nudges (later)

- Email digest: make the weekly digest the default for new accounts with a clear one-click opt-out,
  or ask once on the dashboard. Email needs consent, so this is a decision, not a default I would
  flip silently.
- Event nudges through the existing in-app notifications table: when the extension saves a role,
  "I compared it to your resume: 68%. Here is the gap"; when a deadline is 3 days away.
- Drafts (follow-up, outreach) stay approval-only. No sending on the student's behalf.

## 6. Build plan

| Phase | What | Effort | Cost per user | Done when |
| --- | --- | --- | --- | --- |
| 1 | `GET /api/advisor/plan`: signal engine in one server module with unit tests; "This week" card on the dashboard and above the advisor chat; events for viewed, clicked and dismissed | 1 to 2 days | none | Card shows at most 3 items with working buttons; empty and thin-data states; tests for each signal |
| 2 | Muse voice note, cached per user per week; weekly email uses the same items | 1 to 2 days | about 0.0002 USD a week | Note falls back cleanly; email shows the three items |
| 3 | Conversational Kairos with context pack and action chips; raise the free limit | 3 to 5 days | about 0.0006 USD a message | Multi-turn answers cite real data; limits enforced |
| 4 | Event nudges (extension save, deadline) | 2 days | none | Notification appears and links to the role |
| 5 | Approval-only drafts inside the plan | later | small | Student approves every send |

Measure from phase 1: card views, item clicks, and whether a clicked item is followed by the
action (analysis run, cover letter generated). If clicks are low, fix the wording before building more.

## 7. Risks

- No users yet. This is a bet until real people use the basic product, which is why phase 1 is
  deliberately cheap and measured.
- Thin data makes bad advice. New students have zero or one role, so the plan has to work from the
  goal and resume alone (S10, S5) and say so honestly.
- Advice quality. Keep the signals conservative; one wrong "overdue" erodes trust faster than five
  correct ones build it.
- Duplicate logic. Keep a single signal engine on the server so the dashboard, advisor and email
  can never disagree.
- Privacy. The AI sees only the facts in the signals JSON and the goal, never resume or posting text.

## 8. Decisions needed

1. Where the signals run: on the server (one copy, reused by email and the AI note; depends on the
   backend being awake, which the warm-up helps) or in the browser (instant, but a second copy is
   needed for email). Recommendation: server.
2. Email: opt-out by default for new accounts, or ask once?
3. Free versus Pro: this design keeps the plan card and the weekly note free, limits chat and drafts,
   and leaves voice practice as Pro. Does that match how you want to charge in 2027?
4. Name: "This week" or something in Kairos's voice ("Kairos suggests")?
