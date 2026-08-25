// Generic, defensive DOM-scraping helpers shared by the LinkedIn and Indeed
// content scripts. Job-board markup shifts often and without notice, so
// every lookup here is "try a selector, fall back to the next, never throw."
//
// JSON-LD (schema.org JobPosting) is tried first: job boards embed this for
// Google for Jobs / SEO, server-rendered into the initial HTML regardless of
// signed-in/signed-out layout differences — confirmed present on a live
// LinkedIn job page on 2026-08-25 (title, hiringOrganization.name,
// description all populated) even though this build never logs in. CSS
// selectors are kept as a fallback for pages that don't have it.

/**
 * Decodes HTML entities and strips tags from a JobPosting's `description`
 * field, which schema.org allows (and LinkedIn/Indeed use) as an HTML
 * string. Uses a detached element so nothing is ever inserted into the live
 * page and no script can execute.
 */
function htmlToPlainText(html) {
  try {
    const el = document.createElement("div");
    el.innerHTML = html;
    return (el.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  } catch (_err) {
    return "";
  }
}

/**
 * Scans all <script type="application/ld+json"> tags for a schema.org
 * JobPosting (directly, inside an array, or inside a @graph wrapper) and
 * returns {title, company, description} or null if none is found/valid.
 */
function extractFromJsonLd() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    let parsed;
    try {
      parsed = JSON.parse(script.textContent);
    } catch (_err) {
      continue;
    }
    const candidates = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.["@graph"])
        ? parsed["@graph"]
        : [parsed];
    for (const node of candidates) {
      const type = node?.["@type"];
      const isJobPosting = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
      if (!isJobPosting) continue;
      const title = typeof node.title === "string" ? node.title.trim() : "";
      const company =
        typeof node.hiringOrganization?.name === "string" ? node.hiringOrganization.name.trim() : "";
      const description =
        typeof node.description === "string" ? htmlToPlainText(node.description) : "";
      if (title || company || description) {
        return { title, company, description };
      }
    }
  }
  return null;
}

/**
 * Returns the trimmed textContent of the first selector (in order) that
 * matches an element with non-empty text, or "" if none match.
 */
function firstMatchText(selectors) {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      const text = el && el.textContent ? el.textContent.trim() : "";
      if (text) return text;
    } catch (_err) {
      // Invalid selector or detached node — just try the next one.
    }
  }
  return "";
}

/**
 * Extracts {title, company, description} using the given selector lists.
 * Never throws: on any unexpected error it returns an all-empty result
 * with detected: false so the popup can fall back to manual entry instead
 * of the content script crashing silently.
 */
function extractJob({ titleSelectors, companySelectors, descriptionSelectors }) {
  try {
    const fromJsonLd = extractFromJsonLd();

    const title = fromJsonLd?.title || firstMatchText(titleSelectors);
    const company = fromJsonLd?.company || firstMatchText(companySelectors);
    const description = fromJsonLd?.description || firstMatchText(descriptionSelectors);

    return {
      detected: Boolean(title || company || description),
      title,
      company,
      description,
      url: location.href,
    };
  } catch (_err) {
    return {
      detected: false,
      title: "",
      company: "",
      description: "",
      url: location.href,
    };
  }
}

module.exports = { firstMatchText, extractFromJsonLd, extractJob };
