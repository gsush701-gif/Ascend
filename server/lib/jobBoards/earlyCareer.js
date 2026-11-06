// Which postings are for students and new graduates. Ascend is for people
// applying to internships and entry-level roles, so the feed keeps only those.
// Decided from the posting's title (and the board's own "employment type" when
// it has one), never from guesses about the description.
//
// Word boundaries matter: "Internal Tools Engineer" and "International Sales"
// must not count as internships.

const INTERN = /\b(intern|interns|internship|internships|co-?op|co-?ops)\b/i;
const NEW_GRAD = /\b(new[\s-]?grads?|new[\s-]?graduates?|university[\s-]?grads?|university[\s-]?graduates?|recent[\s-]?grads?|recent[\s-]?graduates?|early[\s-]?career|entry[\s-]?level)\b/i;

// Titles that are clearly not for students even if a keyword appears in them
// (for example "Staff Credit Policy Analyst - Condo, Co-op & Project Review").
// "Technical Staff" is allowed: "Member of Technical Staff (New Grad)" is real.
const SENIOR = /\b(senior|sr\.?|principal|director|vp|vice president|head of)\b|(?<!technical )\bstaff\b/i;
const HOUSING_COOP = /\b(condo|condominium|cooperative housing)\b/i;

/**
 * @param {{ title?: string, employmentType?: string }} input
 * @returns {"Internship" | "Entry" | null}
 */
function classifyEarlyCareer({ title, employmentType } = {}) {
  const t = typeof title === "string" ? title : "";
  const e = typeof employmentType === "string" ? employmentType : "";
  if (SENIOR.test(t) || HOUSING_COOP.test(t)) return null;
  if (INTERN.test(t) || /\bintern/i.test(e)) return "Internship";
  if (NEW_GRAD.test(t)) return "Entry";
  return null;
}

module.exports = { classifyEarlyCareer };
