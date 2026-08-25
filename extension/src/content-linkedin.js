// Content script for LinkedIn job posting pages (*://*.linkedin.com/jobs/*).
//
// LinkedIn renders two meaningfully different DOM shapes for the same job
// depending on whether the viewer is signed in:
//   - Signed OUT (public "guest" view, /jobs/view/<slug>-<id>): confirmed
//     live against https://www.linkedin.com/jobs/view/... on 2026-08-25 —
//     title in <h1 class="top-card-layout__title ... topcard__title">,
//     company in <a class="topcard__org-name-link">, description in
//     <div class="show-more-less-html__markup"> (also mirrored by the
//     older .description__text class).
//   - Signed IN ("unified top card" layout): class names documented widely
//     as job-details-jobs-unified-top-card__* / jobs-description__content,
//     but not independently re-verified live here (would require a real
//     LinkedIn login, which this build deliberately avoids per the task's
//     guardrails). Included as a fallback tier — if LinkedIn has since
//     renamed these, extraction just falls through to "" and the popup
//     shows manual entry instead of crashing.
//
// Selectors are tried in order per field; first non-empty match wins.
const { extractJob } = require("./extract");
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

function runExtraction() {
  return extractJob(SELECTORS);
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
