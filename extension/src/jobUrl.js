// Turns the address of the page a job was captured from into a clean, stable
// link back to that posting, so a saved role keeps a working "open the job" link.
//
// LinkedIn and Indeed address bars are full of tracking parameters, and on a
// search-results page the address is the SEARCH, with the selected job only
// named in a query parameter. This pulls out the job's own id and rebuilds the
// canonical link. Returns null for anything that isn't a recognised job page,
// so a random page's address is never saved.

function toUrl(raw) {
  try {
    return new URL(raw);
  } catch (_err) {
    return null;
  }
}

function linkedinJobId(u) {
  // /jobs/view/4123456789/ or /jobs/view/some-title-at-company-4123456789
  const view = u.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})/);
  if (view) return view[1];
  // Search/collections pages: the open job is in currentJobId.
  const current = u.searchParams.get("currentJobId");
  return current && /^\d{6,}$/.test(current) ? current : null;
}

function indeedJobKey(u) {
  // viewjob?jk=... is the job's own page; vjk is the selected job on a search page.
  const key = u.searchParams.get("jk") || u.searchParams.get("vjk");
  return key && /^[a-zA-Z0-9]{8,32}$/.test(key) ? key : null;
}

/**
 * @param {string} rawUrl the active tab's address
 * @param {"LinkedIn" | "Indeed" | string | null} source which site it came from
 * @returns {string | null}
 */
function canonicalJobUrl(rawUrl, source) {
  const u = toUrl(rawUrl);
  if (!u || (u.protocol !== "https:" && u.protocol !== "http:")) return null;

  if (source === "LinkedIn" && /(^|\.)linkedin\.com$/.test(u.hostname)) {
    const id = linkedinJobId(u);
    return id ? `https://www.linkedin.com/jobs/view/${id}/` : null;
  }
  if (source === "Indeed" && /(^|\.)indeed\.com$/.test(u.hostname)) {
    const key = indeedJobKey(u);
    return key ? `https://www.indeed.com/viewjob?jk=${key}` : null;
  }
  return null;
}

module.exports = { canonicalJobUrl };
