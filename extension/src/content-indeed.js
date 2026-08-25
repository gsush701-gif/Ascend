// Content script for Indeed pages (*://*.indeed.com/*). Matched broadly
// (Indeed doesn't put a stable "this is a job posting" marker in the URL
// the way LinkedIn's /jobs/ prefix does — a selected job can render inline
// on a /jobs search results page as well as on a dedicated /viewjob page),
// so extraction must degrade gracefully on non-job pages: detected: false
// with empty fields rather than guessing at wrong content.
//
// Primary extraction is via JSON-LD (schema.org JobPosting) — see
// extract.js's extractFromJsonLd — the same mechanism confirmed working on
// LinkedIn. Indeed is widely documented as also embedding this for Google
// for Jobs, but live verification here was blocked by Cloudflare's
// automated-traffic challenge ("Just a moment..." interstitial), which
// targets scripted/headless-style requests and should not affect a real
// signed-in user's browser session. The CSS selectors below are the
// fallback if JSON-LD isn't present on a given page; they're sourced from
// Indeed's widely-documented current markup rather than independently
// re-confirmed live.
const { extractJob } = require("./extract");
const { JOB_DETECTED, REQUEST_JOB } = require("./messages");

const SELECTORS = {
  titleSelectors: [
    "h1.jobsearch-JobInfoHeader-title",
    '[data-testid="jobsearch-JobInfoHeader-title"]',
    "h1.icl-u-xs-mb--xs",
    "h1",
  ],
  companySelectors: [
    '[data-testid="inlineHeader-companyName"]',
    '[data-company-name="true"]',
    ".jobsearch-CompanyInfoContainer a",
    ".jobsearch-CompanyInfoWithoutHeaderImage div a",
    ".jobsearch-InlineCompanyRating div a",
  ],
  descriptionSelectors: [
    "#jobDescriptionText",
    ".jobsearch-jobDescriptionText",
    ".jobsearch-JobComponent-description",
  ],
};

function runExtraction() {
  return extractJob(SELECTORS);
}

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
});
