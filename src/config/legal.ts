/** Shown at the top of the privacy policy; bump it whenever the policy text changes. */
export const PRIVACY_POLICY_UPDATED = "1 November 2026";

/**
 * Where people reach us about privacy (access, correction, deletion). Set
 * VITE_CONTACT_EMAIL on the frontend service at build time — it's a public
 * address by design, so it's safe to bake into the bundle. Left unset, the
 * privacy page simply omits the email line rather than showing a placeholder.
 */
export const CONTACT_EMAIL: string | null =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || null;
