/**
 * Ascend design tokens — single source of truth for UI consistency.
 * Matches Dashboard: typography, spacing, borders, cards, buttons.
 */

/** Main content container: max width + horizontal padding */
export const pageContainer =
  "mx-auto w-full max-w-7xl px-4 sm:px-6";

/** Page header layout: title block + right actions */
export const pageHeader =
  "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between";

/** Page title (H1) */
export const pageTitle =
  "text-xl font-semibold text-white";

/** Page subtitle (one-line muted) */
export const pageSubtitle =
  "mt-0.5 text-sm text-white/50";

/** Header actions container (right side of page header) */
export const pageHeaderActions =
  "flex shrink-0 items-center gap-2";

/** Content gap below title block */
export const pageContentGap =
  "mt-6 space-y-6";

/** Card: Dashboard-style panel */
export const card =
  "rounded-xl border border-white/5 bg-dash-card p-6 shadow-sm";

/** Card with translucent bg (alternative) */
export const cardAlt =
  "rounded-xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur-sm";

/** Card header (inside card) */
export const cardHeader =
  "text-xs font-medium uppercase tracking-wide text-white/50";

/** Compact card padding */
export const cardCompact = "p-4";

/** Primary button (cyan, Add role style) */
export const buttonPrimary =
  "btn-press inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 text-sm font-medium text-black transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-[#07090D] disabled:opacity-50 disabled:cursor-not-allowed";

/** Secondary button (border, transparent bg) */
export const buttonSecondary =
  "btn-press inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-sm font-medium text-white/90 transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-[#07090D] disabled:opacity-50 disabled:cursor-not-allowed";

/** Ghost / tertiary button */
export const buttonGhost =
  "btn-press inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-sm font-medium text-white/70 transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-[#07090D] disabled:opacity-50 disabled:cursor-not-allowed";

/** Danger button */
export const buttonDanger =
  "btn-press inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 focus:ring-offset-[#07090D] disabled:opacity-50 disabled:cursor-not-allowed";

/** Danger outline button */
export const buttonDangerOutline =
  "btn-press inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 focus:ring-offset-[#07090D] disabled:opacity-50 disabled:cursor-not-allowed";

/** Input (text, single line) */
export const input =
  "h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition";

/** Select trigger (for custom Select component) */
export const select =
  "h-10 min-w-[120px] rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition inline-flex items-center justify-between gap-2";

/** Textarea base */
export const textarea =
  "w-full min-h-[100px] rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition resize-y";

/** Badge / pill (muted status) */
export const badge =
  "inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-white/70";

/** Badge with cyan accent */
export const badgePrimary =
  "inline-flex items-center rounded-md border border-cyan-500/50 bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-300";

/** Divider */
export const divider =
  "border-t border-white/10";

/** Section title (e.g. "Upcoming deadlines", "Next actions") */
export const sectionTitle =
  "text-sm font-semibold text-white/90";
