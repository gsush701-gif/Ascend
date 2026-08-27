import { StyleSheet } from "@react-pdf/renderer";

/**
 * Shared print-safe color tokens for the PDF templates. These intentionally
 * do NOT reuse the app's on-screen cyan/violet hex values verbatim — those
 * (e.g. Tailwind's cyan-400 `#22d3ee`) are tuned for a dark UI background
 * and read as too pale on white paper/ATS-scanned print. These are darker,
 * same-hue siblings (cyan-700 / violet-700 family) chosen for print contrast
 * while still visually matching the app's palette identity.
 */
export const pdfColors = {
  ink: "#111827", // slate-900 — primary text
  muted: "#4b5563", // slate-600 — secondary text
  faint: "#9ca3af", // slate-400 — hairlines / de-emphasized text
  cyanAccent: "#0e7490", // cyan-700 — Modern template accent
  cyanTint: "#e0f7fb", // pale cyan tint for chips/backgrounds
  violetAccent: "#6d28d9", // violet-700 — Technical template accent
  violetTint: "#efe7fd", // pale violet tint for chips/backgrounds
  rule: "#d1d5db", // slate-300 — divider lines
};

/** Page padding shared by all templates, in points. */
export const PAGE_PADDING = 42;

export const baseStyles = StyleSheet.create({
  page: {
    paddingTop: PAGE_PADDING,
    paddingBottom: PAGE_PADDING,
    paddingHorizontal: PAGE_PADDING,
    fontSize: 10.5,
    color: pdfColors.ink,
    lineHeight: 1.4,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  bulletMarker: {
    width: 10,
  },
  bulletText: {
    flex: 1,
  },
});

/** A single "• " prefixed line, wrapped so long bullets indent correctly on wrap. */
export const BULLET_MARKER = "•";
