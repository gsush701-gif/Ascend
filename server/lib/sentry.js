/**
 * Sentry-ready observability, with graceful no-op.
 *
 * If SENTRY_DSN is set, initializes @sentry/node and this module's
 * `captureException` forwards to it. If SENTRY_DSN is absent (the default —
 * the project owner doesn't have a Sentry account set up yet), initialization
 * is skipped entirely: no crash, no warning spam, `captureException` is a
 * no-op. Activate for real later by setting SENTRY_DSN (see server/.env.example).
 */

const dsn = process.env.SENTRY_DSN;

let Sentry = null;
if (dsn) {
  try {
    Sentry = require("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: 0.1,
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
