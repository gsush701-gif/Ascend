// Resend email sending for automated weekly reports (Phase 7 Task 7).
//
// Mirrors this app's established "configured or null/no-op" pattern for
// optional third-party integrations — see server/lib/stripe.js and
// server/lib/supabaseAdmin.js. This app has never held a RESEND_API_KEY:
// Resend is already used for transactional auth emails (password reset),
// but that's wired entirely inside Supabase's own SMTP settings, which app
// code has no access to. When RESEND_API_KEY is unset, `sendWeeklyReportEmail`
// always resolves to a clean "skipped" result rather than throwing — report
// generation and storage (server/lib/weeklyReport.js) work fully either way;
// only the actual email send is skipped, and it's logged clearly why.
//
// Uses a plain `fetch` call to Resend's HTTP API rather than adding the
// `resend` npm package, since this is the one call site that needs it.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const configured = Boolean(RESEND_API_KEY);

// Resend requires the `from` address's domain to be verified on the
// account. Until the owner adds a real RESEND_API_KEY and a verified
// sending domain, this defaults to Resend's own shared testing address
// (onboarding@resend.dev) purely so a locally-configured test key works
// out of the box — RESEND_FROM_EMAIL should be set to a verified sender
// once this ships to production.
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Ascend <onboarding@resend.dev>";
const RESEND_API_URL = "https://api.resend.com/emails";

if (!configured) {
  console.warn(
    "[resend] RESEND_API_KEY not set — weekly report emails will be skipped " +
      "(report generation and storage still run normally).",
  );
}

/**
 * @param {object} opts
 * @param {string} opts.to recipient email address
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {string} opts.text plain-text fallback
 * @returns {Promise<{ sent: boolean, skipped?: boolean, reason?: string, error?: string }>}
 *   Never throws — a send failure is reported in the return value so one
 *   user's email problem can't abort a batch job.
 */
async function sendWeeklyReportEmail({ to, subject, html, text }) {
  if (!configured) {
    console.log(`[resend] Skipping weekly report email to ${to}: RESEND_API_KEY is not configured.`);
    return { sent: false, skipped: true, reason: "RESEND_API_KEY not configured" };
  }
  if (!to || typeof to !== "string") {
    return { sent: false, skipped: true, reason: "No recipient email address" };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [to],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[resend] Send failed (${res.status}) to ${to}: ${body.slice(0, 500)}`);
      return { sent: false, error: `Resend API returned ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error(`[resend] Send threw for ${to}:`, err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendWeeklyReportEmail, isResendConfigured: configured };
