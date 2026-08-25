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
 * Returns an element's text with any nested <button>/<a> elements removed
 * first (e.g. a "show more" toggle embedded inside a description
 * container). Structural exclusion by element type, not by guessing at
 * wording afterward — a description that legitimately ends its own prose
 * with "...and more" is left untouched, since that word lives in a text
 * node, not inside a button/link. Operates on a clone so the live page is
 * never touched.
 */
function textWithoutInteractiveDescendants(el) {
  try {
    const clone = el.cloneNode(true);
    clone.querySelectorAll("button, a").forEach((n) => n.remove());
    return (clone.textContent || "").trim();
  } catch (_err) {
    return (el.textContent || "").trim();
  }
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
 * Same as firstMatchText, but for description fields specifically: strips
 * embedded toggle buttons/links first so a "show more" label never ends up
 * appended to the real text.
 */
function firstMatchDescriptionText(selectors) {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      const text = el ? textWithoutInteractiveDescendants(el) : "";
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
    const description = fromJsonLd?.description || firstMatchDescriptionText(descriptionSelectors);

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

/**
 * Last-resort description extraction for pages that have neither JSON-LD
 * nor a matching CSS selector (e.g. LinkedIn's search-results inline job
 * pane, which ships hashed/unstable class names with every deploy — any
 * selector hardcoded against today's hashes would just break again on the
 * next one). Finds the *smallest* block-level element whose text is long
 * enough to plausibly be a job description and that isn't link/button-heavy
 * (ruling out job-list sidebars and nav chrome, which have many anchors
 * relative to their text length). Confirmed against real LinkedIn markup
 * on 2026-08-25 — candidate text lengths for the real description clustered
 * around 700-1300 chars, well clear of both nav lists and the whole page.
 */
function extractDescriptionHeuristic() {
  try {
    const candidates = [];
    for (const el of document.querySelectorAll("div, section, article")) {
      // Length/ratio checks run against text with toggle buttons/links
      // already excluded, so a "show more" label can never inflate a
      // candidate past a filter or end up glued onto the returned text —
      // structural exclusion, not a guess based on wording afterward.
      const text = textWithoutInteractiveDescendants(el);
      // A real description is at least a few sentences; anything shorter is
      // more likely a compact header/metadata block (title+company+location
      // badges concatenated together) than actual job body copy.
      if (text.length < 400 || text.length > 30000) continue;
      if (el.querySelectorAll("a").length > 4) continue;
      if (el.querySelectorAll("button").length > 6) continue;
      // Sibling UI elements (badges, labels) often get concatenated by
      // textContent with no separating whitespace at all ("CompanyTitle
      // Location"), which natural prose never does. Require a plausible
      // space density to rule those out.
      const spaceRatio = (text.match(/ /g) || []).length / text.length;
      if (spaceRatio < 0.08) continue;
      candidates.push({ el, text });
    }
    if (candidates.length === 0) return "";
    candidates.sort((a, b) => a.text.length - b.text.length);
    return candidates[0].text;
  } catch (_err) {
    return "";
  }
}

module.exports = {
  firstMatchText,
  firstMatchDescriptionText,
  extractFromJsonLd,
  extractDescriptionHeuristic,
  extractJob,
};
