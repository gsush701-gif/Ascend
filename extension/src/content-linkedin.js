// Content script for LinkedIn job posting pages (*://*.linkedin.com/jobs/*).
//
// Primary extraction is via JSON-LD (schema.org JobPosting), which LinkedIn
// server-renders into every job page's <head> for Google for Jobs — same
// data whether the viewer is signed in or not. Confirmed live against
// https://www.linkedin.com/jobs/view/... on 2026-08-25 (title,
// hiringOrganization.name, and description all populated). See
// extract.js's extractFromJsonLd.
//
// CSS selectors below are the fallback for if LinkedIn ever drops the
// JSON-LD block. They cover two meaningfully different DOM shapes:
//   - Signed OUT (public "guest" view): confirmed live the same day —
//     title in <h1 class="top-card-layout__title ... topcard__title">,
//     company in <a class="topcard__org-name-link">, description in
//     <div class="show-more-less-html__markup"> (also mirrored by the
//     older .description__text class).
//   - Signed IN ("unified top card" layout): class names documented widely
//     as job-details-jobs-unified-top-card__* / jobs-description__content,
//     not independently verified live (would require a real LinkedIn
//     login). Since JSON-LD covers the signed-in case too, this tier
//     matters less than it did before.
//
// Selectors are tried in order per field; first non-empty match wins.
const { extractJob, extractDescriptionHeuristic } = require("./extract");
const { JOB_DETECTED, REQUEST_JOB } = require("./messages");

const SELECTORS = {
  titleSelectors: [
    ".job-details-jobs-unified-top-card__job-title h1",
    ".jobs-unified-top-card__job-title h1",
    ".jobs-unified-top-card__job-title",
    ".top-card-layout__title",
    ".topcard__title",
    "h1",
  ],
  companySelectors: [
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name",
    "a.topcard__org-name-link",
    ".topcard__org-name-link",
    ".topcard__flavor--black-link",
    ".top-card-layout__second-subline a",
  ],
  descriptionSelectors: [
    "#job-details",
    ".jobs-description__content .jobs-box__html-content",
    ".jobs-description-content__text",
    ".show-more-less-html__markup",
    ".description__text",
  ],
};

// LinkedIn sets document.title to "{Job Title} | {Company} | LinkedIn" on
// job pages — including the search-results inline preview pane, where the
// visible DOM otherwise offers no stable signal at all (hashed class names
// that change per deploy, no JSON-LD for the currently-selected job).
// Confirmed live on 2026-08-25.
function extractFromDocumentTitle() {
  const parts = document.title.split(" | ").map((p) => p.trim());
  if (parts.length >= 3 && parts[parts.length - 1] === "LinkedIn" && parts[0] && parts[1]) {
    return { title: parts[0], company: parts[1] };
  }
  return null;
}

function runExtraction() {
  const result = extractJob(SELECTORS);

  if (!result.title || !result.company) {
    const fromTitle = extractFromDocumentTitle();
    if (fromTitle) {
      result.title = result.title || fromTitle.title;
      result.company = result.company || fromTitle.company;
    }
  }

  // A CSS selector can match *something* short and wrong (e.g. a page
  // variant reusing #job-details for a compact summary, not the full
  // body) rather than nothing at all, so "selector found no match" isn't
  // a reliable signal to fall back on here. The heuristic requires 400+
  // chars of real prose to even return a candidate, so whichever is
  // longer is the safer bet regardless of which method produced it.
  const heuristicDescription = extractDescriptionHeuristic();
  if (heuristicDescription.length > result.description.length) {
    result.description = heuristicDescription;
  }

  result.detected = Boolean(result.title || result.company || result.description);
  return result;
}

// Report what we found once the page settles, so the toolbar badge can
// reflect it before the user even opens the popup.
try {
  const result = runExtraction();
  chrome.runtime.sendMessage({ type: JOB_DETECTED, payload: result });
} catch (_err) {
  // Extension context can be invalidated (e.g. extension reloaded while
  // the tab stayed open) — never let that break the host page.
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === REQUEST_JOB) {
    sendResponse(runExtraction());
  }
  // No return value / no `return true` needed: we respond synchronously.
});
