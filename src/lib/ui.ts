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
  "font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl";

/** Page subtitle (one-line muted) */
export const pageSubtitle =
  "mt-1.5 text-sm text-slate-500 sm:text-base";

/** Header actions container (right side of page header) */
export const pageHeaderActions =
  "flex shrink-0 items-center gap-2";

/** Content gap below title block */
export const pageContentGap =
  "mt-6 space-y-6";

/** Card: Dashboard-style panel */
export const card =
  "rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

/** Soft inset box: for a group of content inside a card, or a quiet standalone block */
export const cardAlt =
  "rounded-xl border border-slate-200/70 bg-slate-50 p-6";

/** Card header (inside card) */
export const cardHeader =
  "text-xs font-medium uppercase tracking-wide text-slate-500";

/** Compact card padding */
export const cardCompact = "p-4";

/** Primary button (cyan, Add role style) */
export const buttonPrimary =
  "btn-press inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 text-sm font-medium text-black transition hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.35)] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-[#F7F8FB] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none";

/** Secondary button (border, transparent bg) */
export const buttonSecondary =
  "btn-press inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-transparent px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-900/[0.04] focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 focus:ring-offset-[#F7F8FB] disabled:opacity-50 disabled:cursor-not-allowed";

/** Ghost / tertiary button */
export const buttonGhost =
  "btn-press inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-transparent px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-900/[0.04] focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 focus:ring-offset-[#F7F8FB] disabled:opacity-50 disabled:cursor-not-allowed";

/** Danger button */
export const buttonDanger =
  "btn-press inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-slate-900 transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 focus:ring-offset-[#F7F8FB] disabled:opacity-50 disabled:cursor-not-allowed";

/** Danger outline button */
export const buttonDangerOutline =
  "btn-press inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 focus:ring-offset-[#F7F8FB] disabled:opacity-50 disabled:cursor-not-allowed";

/** Input (text, single line) */
export const input =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-300 transition";

/** Select trigger (for custom Select component) */
export const select =
  "h-10 min-w-[120px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-300 transition inline-flex items-center justify-between gap-2";

/** Textarea base */
export const textarea =
  "w-full min-h-[100px] rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-300 transition resize-y";

/** Badge / pill (muted status) */
export const badge =
  "inline-flex items-center rounded-md border border-slate-200 bg-slate-900/[0.04] px-2 py-0.5 text-xs font-medium text-slate-600";

/** Badge with cyan accent */
export const badgePrimary =
  "inline-flex items-center rounded-md border border-cyan-500/50 bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-700";

/** Divider */
export const divider =
  "border-t border-slate-200";

/** Section title (e.g. "Upcoming deadlines", "Next actions") */
export const sectionTitle =
  "text-sm font-semibold text-slate-800";

/** Muted pill styles per tracker status, keyed by TrackerStatus — shared by
 * RolesTable's status dropdown and RoleDetail's application-status field so
 * the same status always reads the same color everywhere in the app. */
export const STATUS_SELECT_STYLES: Record<string, string> = {
  Wishlist: "border-slate-200 bg-slate-50 text-slate-600",
  Analyzed: "border-indigo-200 bg-indigo-50 text-indigo-700",
  "Ready to Apply": "border-cyan-200 bg-cyan-50 text-cyan-700",
  Applied: "border-sky-200 bg-sky-50 text-sky-700",
  "Recruiter Contact": "border-violet-200 bg-violet-50 text-violet-700",
  Interview: "border-violet-200 bg-violet-100 text-violet-800",
  "Technical Interview": "border-violet-300 bg-violet-100 text-violet-800",
  "Final Interview": "border-purple-300 bg-purple-100 text-purple-800",
  Offer: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Accepted: "border-emerald-300 bg-emerald-100 text-emerald-800",
  Rejected: "border-rose-200 bg-rose-50 text-rose-700",
  Withdrawn: "border-slate-200 bg-slate-100 text-slate-500",
};
