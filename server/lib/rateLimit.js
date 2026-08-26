const rateLimit = require("express-rate-limit");
const { sendError } = require("./errors");

/**
 * Redis-ready rate limiting (Upstash), in-memory fallback.
 *
 * If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are both set, every
 * limiter created here is backed by Upstash Redis (REST-based, no persistent
 * TCP connection) so counts are shared across horizontally-scaled instances.
 * If either is missing, falls back to the exact in-memory express-rate-limit
 * behavior this app already used — same windowMs/max, same net behavior,
 * just not shared across instances. Either way this file never throws:
 * a failed Upstash request lets the request through rather than 500ing or
 * hanging the app on a Redis outage.
 *
 * Activate for real by setting both env vars (see server/.env.example).
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let Ratelimit = null;
let Redis = null;
if (UPSTASH_URL && UPSTASH_TOKEN) {
  try {
    ({ Ratelimit } = require("@upstash/ratelimit"));
    ({ Redis } = require("@upstash/redis"));
  } catch (e) {
    console.warn(
      "[rateLimit] @upstash packages failed to load, falling back to in-memory rate limiting:",
      e.message,
    );
  }
}

const useUpstash = Boolean(UPSTASH_URL && UPSTASH_TOKEN && Ratelimit && Redis);

const redisClient = useUpstash
  ? new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN })
  : null;

let loggedModeOnce = false;
function logModeOnce() {
  if (loggedModeOnce) return;
  loggedModeOnce = true;
  if (useUpstash) {
    console.log("[rateLimit] Upstash Redis-backed rate limiting active (multi-instance safe).");
  } else {
    console.log(
      "[rateLimit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set — " +
        "rate limiting is running in-memory-only (single-instance) mode.",
    );
  }
}

/** express-rate-limit's windowMs (number of ms) -> Upstash's duration string, e.g. "15 m". */
function toDuration(windowMs) {
  const minutes = Math.max(1, Math.round(windowMs / 60000));
  return `${minutes} m`;
}

/**
 * @param {object} opts
 * @param {number} opts.windowMs
 * @param {number} opts.max
 * @param {string} opts.message user-facing message on 429
 * @param {string} opts.keyPrefix distinguishes this limiter's counters from others sharing the same Redis (e.g. "ai", "account", "track")
 */
function createRateLimiter({ windowMs, max, message, keyPrefix }) {
  logModeOnce();

  if (useUpstash) {
    const limiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(max, toDuration(windowMs)),
      prefix: `ascend-ratelimit:${keyPrefix}`,
      analytics: false,
    });

    return async function upstashRateLimit(req, res, next) {
      try {
        const identifier = req.ip || "unknown";
        const { success, limit, remaining, reset } = await limiter.limit(identifier);
        res.setHeader("RateLimit-Limit", String(limit));
        res.setHeader("RateLimit-Remaining", String(Math.max(0, remaining)));
        res.setHeader("RateLimit-Reset", String(reset));
        if (!success) {
          return sendError(req, res, 429, "RATE_LIMITED", message);
        }
        return next();
      } catch (e) {
        // Availability over strict enforcement: if Upstash is unreachable,
        // let the request through rather than breaking the product.
        console.error("[rateLimit] Upstash request failed, allowing request through:", e.message);
        return next();
      }
    };
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      sendError(req, res, 429, "RATE_LIMITED", message);
    },
  });
}

module.exports = { createRateLimiter, isUpstashBacked: useUpstash };
