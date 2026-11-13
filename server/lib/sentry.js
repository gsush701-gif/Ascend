/**
 * Sentry-ready observability, with graceful no-op.
 *
 * If SENTRY_DSN is set, initializes @sentry/node and this module's
 * `captureException` forwards to it. If SENTRY_DSN is absent (the default —
 * the project owner doesn't have a Sentry account set up yet), initialization
 * is skipped entirely: no crash, no warning spam, `captureException` is a
 * no-op. Activate for real later by setting SENTRY_DSN (see server/.env.example).
 *
 * Privacy: by default the SDK attaches the incoming request to every error,
 * including up to 10KB of its body. On this server a body is a resume, a job
 * description, an interview answer or a recovery code, so body capture is
 * switched off and every event is passed through scrubErrorEvent
 * (server/lib/redact.js) before it is sent. The privacy policy says the error
 * tracker never receives a student's documents; this is what makes that true.
 */

const { scrubErrorEvent } = require("./redact");

const dsn = process.env.SENTRY_DSN;

let Sentry = null;
if (dsn) {
  try {
    Sentry = require("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      integrations: [Sentry.httpIntegration({ maxIncomingRequestBodySize: "none" })],
      beforeSend: (event) => scrubErrorEvent(event),
      beforeSendTransaction: (event) => scrubErrorEvent(event),
    });
    console.log("[sentry] initialized");
  } catch (e) {
    console.warn("[sentry] failed to initialize, continuing without it:", e.message);
    Sentry = null;
  }
}

function captureException(err, context) {
  if (!Sentry) return;
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // Never let observability plumbing take down the actual request.
  }
}

module.exports = { Sentry, captureException, isSentryConfigured: Boolean(Sentry) };
