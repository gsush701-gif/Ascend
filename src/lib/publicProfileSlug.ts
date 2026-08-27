/**
 * Pure slug validation/generation helpers for the database-backed shareable
 * profile feature (see src/features/publicProfile/hooks/usePublicProfile.ts
 * and supabase/migrations/017_public_profiles.sql). No network/localStorage
 * access here — everything is a pure string transform so it can be unit
 * tested directly.
 *
 * Uniqueness itself is NOT checked here: RLS on `public_profiles` means an
 * ordinary authenticated client can only ever read its own row, so there is
 * no way to query "does another user already have this slug" client-side.
 * The real uniqueness check is the database's `unique` constraint on
 * `public_profiles.slug` — the hook that calls these helpers attempts the
 * write and surfaces a friendly error on a 23505 (unique_violation) from
 * Postgres, retrying with a fresh random suffix only for the "auto-generate
 * on first use" path (never silently retried for a slug the user typed and
 * saved themselves).
 */

const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_LENGTH = 40;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Lowercases, strips anything that isn't a-z/0-9/hyphen, collapses repeated
 * hyphens, and trims leading/trailing hyphens. Does not enforce length. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export type SlugValidationResult = { valid: true } | { valid: false; reason: string };

/**
 * Validates an already-slugified (or user-typed) string against the format
 * rules for `public_profiles.slug`: lowercase letters/digits/hyphens only,
 * no leading/trailing/doubled hyphens, 3-40 characters.
 */
export function validateSlugFormat(slug: string): SlugValidationResult {
  if (!slug) return { valid: false, reason: "Slug cannot be empty." };
  if (slug.length < MIN_SLUG_LENGTH) {
    return { valid: false, reason: `Slug must be at least ${MIN_SLUG_LENGTH} characters.` };
  }
  if (slug.length > MAX_SLUG_LENGTH) {
    return { valid: false, reason: `Slug must be at most ${MAX_SLUG_LENGTH} characters.` };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      valid: false,
      reason: "Slug can only contain lowercase letters, numbers, and single hyphens (not at the start/end).",
    };
  }
  return { valid: true };
}

/** Combines slugify + validateSlugFormat: normalizes a raw user input string
 * to slug form and reports whether the RESULT is valid (a user typing
 * "Sushil G!" gets normalized to "sushil-g" before validation runs). */
export function normalizeAndValidateSlug(rawInput: string): SlugValidationResult & { slug: string } {
  const slug = slugify(rawInput);
  const result = validateSlugFormat(slug);
  return { ...result, slug };
}

function randomSuffix(): string {
  // 4 lowercase-alphanumeric characters, e.g. "a1b2" — short enough to stay
  // readable in a URL, random enough that a collision retry loop converges
  // in practice within a couple of attempts even at meaningful user counts.
  return Math.random().toString(36).slice(2, 6);
}

/**
 * Derives a default slug from a seed (profile full name, or the local part
 * of an email address) plus a short random suffix — used the first time a
 * user opens the sharing panel and has no `public_profiles` row yet. A
 * random suffix is always appended (not just on collision) since this
 * function has no way to check the database for an existing match; the
 * caller retries with regenerateSlug() on a 23505 unique-violation.
 */
export function generateDefaultSlug(seed: string): string {
  const base = slugify(seed) || "user";
  const trimmedBase = base.slice(0, MAX_SLUG_LENGTH - 5); // leave room for "-xxxx"
  const candidate = `${trimmedBase}-${randomSuffix()}`;
  // Extremely short seeds (e.g. a single removed character) could still
  // slip under MIN_SLUG_LENGTH in pathological cases; fall back to a fully
  // random slug rather than ever returning something invalid.
  return validateSlugFormat(candidate).valid ? candidate : generateRandomSlug();
}

/** A fresh, seed-free random slug — used for the explicit "Regenerate slug"
 * action, which intentionally invalidates whatever slug was shared before. */
export function generateRandomSlug(): string {
  return `profile-${randomSuffix()}${randomSuffix()}`;
}

export function extractEmailLocalPart(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}
