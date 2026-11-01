/** Shown at the top of the privacy policy; bump it whenever the policy text changes. */
export const PRIVACY_POLICY_UPDATED = "1 November 2026";

/** Same, for the terms of service and the refund policy. */
export const TERMS_UPDATED = "1 November 2026";
export const REFUNDS_UPDATED = "1 November 2026";

/**
 * Days after a first paid charge during which a student can ask for their money
 * back, no questions asked. A business choice: change it here and the refund
 * page and the terms both follow.
 */
export const REFUND_WINDOW_DAYS = 7;

/**
 * Where to reach us about privacy, terms and refunds. Set VITE_CONTACT_EMAIL on
 * the frontend service at build time. It's a public address by design, so it is
 * safe to bake into the bundle. Left unset, the legal pages simply omit the
 * email line rather than showing a placeholder.
 */
export const CONTACT_EMAIL: string | null =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || null;

/**
 * Which place's law governs the terms, for example "the State of Texas, USA".
 * Set VITE_GOVERNING_LAW (build time) once you've decided with whoever reviews
 * the terms. Left unset, that clause is left out, never guessed.
 */
export const GOVERNING_LAW: string | null =
  (import.meta.env.VITE_GOVERNING_LAW as string | undefined)?.trim() || null;
