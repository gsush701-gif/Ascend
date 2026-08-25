// Generic, defensive DOM-scraping helpers shared by the LinkedIn and Indeed
// content scripts. Job-board markup shifts often and without notice, so
// every lookup here is "try a selector, fall back to the next, never throw."

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
    const title = firstMatchText(titleSelectors);
    const company = firstMatchText(companySelectors);
    const description = firstMatchText(descriptionSelectors);

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

module.exports = { firstMatchText, extractJob };
