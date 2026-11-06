import { describe, it, expect } from "vitest";
import { pickNewMatch, looksUS } from "./newMatch.js";
import { computePlan } from "./advisorPlan.js";
import { buildMatchProfile } from "./jobMatching.js";

const NOW = new Date("2026-11-10T12:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();

let n = 1;
function job(over = {}) {
  return {
    id: `j${n++}`,
    company: "Northwind",
    title: "Backend Intern",
    description: "You will build REST APIs in Python and SQL. Experience with Docker is a plus.",
    url: "https://example.com/j",
    source: "Greenhouse",
    location: "Austin, TX",
    remote_type: null,
    employment_type: "Internship",
    experience_level: "Internship",
    posted_at: daysAgo(3),
    deadline: null,
    ...over,
  };
}

const profile = buildMatchProfile({}, "I know Python, SQL, Docker, Git and JavaScript.");
const pick = (jobs, extra = {}) => pickNewMatch({ jobs, profile, now: NOW, ...extra });

describe("looksUS", () => {
  it("recognises US locations", () => {
    for (const l of [
      "Austin, TX",
      "San Francisco, CA, US",
      "United States",
      "Remote - US",
      "New York, NY • Remote",
      "Mountain View, California, United States",
      "Washington, DC",
    ]) {
      expect(looksUS(l), l).toBe(true);
    }
  });

  it("does not call other countries US", () => {
    for (const l of ["Singapore", "Longueuil, Canada", "London", "Toronto, ON", "Berlin, Germany", "", undefined]) {
      expect(looksUS(l), String(l)).toBe(false);
    }
  });
});

describe("pickNewMatch", () => {
  it("returns the best fresh posting with its real numbers", () => {
    const m = pick([job()]);
    expect(m.job.title).toBe("Backend Intern");
    expect(m.score).toBeGreaterThanOrEqual(60);
    expect(m.matchedSkills).toEqual(expect.arrayContaining(["python", "sql"]));
    expect(m.daysAgo).toBe(3);
  });

  it("needs a resume with recognisable skills", () => {
    const empty = buildMatchProfile({}, "");
    expect(pickNewMatch({ jobs: [job()], profile: empty, now: NOW })).toBeNull();
    expect(pickNewMatch({ jobs: [job()], profile: null, now: NOW })).toBeNull();
  });

  it("ignores old, undated and thin postings", () => {
    expect(pick([job({ posted_at: daysAgo(80) })])).toBeNull();
    expect(pick([job({ posted_at: null })])).toBeNull();
    // names only one recognised skill: never qualifies, even at 100% of one
    expect(pick([job({ description: "You will use Python every day." })])).toBeNull();
  });

  it("ignores a weak match", () => {
    const weak = job({ description: "Needs Kubernetes, Java, C++, Azure and GCP experience." });
    expect(pick([weak])).toBeNull();
  });

  it("skips dismissed postings and ones the student already tracks", () => {
    const a = job({ id: "a" });
    expect(pick([a], { dismissedIds: new Set(["a"]) })).toBeNull();
    expect(pick([a], { trackedJobIds: new Set(["a"]) })).toBeNull();
    expect(pick([a], { trackedKeys: new Set(["northwind|backend intern"]) })).toBeNull();
  });

  it("treats a stated location as a requirement, except for remote roles", () => {
    const austin = buildMatchProfile({ preferred_locations: "Austin, TX" }, "Python, SQL, Docker, Git, JavaScript");
    const elsewhere = job({ id: "far", location: "Longueuil, Canada" });
    const near = job({ id: "near", location: "Austin, TX", posted_at: daysAgo(20) });
    const remote = job({ id: "remote", location: "Singapore", remote_type: "Remote", posted_at: daysAgo(25) });
    expect(pickNewMatch({ jobs: [elsewhere], profile: austin, now: NOW })).toBeNull();
    expect(pickNewMatch({ jobs: [elsewhere, near], profile: austin, now: NOW }).job.id).toBe("near");
    expect(pickNewMatch({ jobs: [elsewhere, remote], profile: austin, now: NOW }).job.id).toBe("remote");
  });

  it("leans towards US postings when no location is stated, but never excludes others", () => {
    const abroad = job({ id: "abroad", location: "Singapore", posted_at: daysAgo(3) });
    const us = job({ id: "us", location: "Dallas, TX", posted_at: daysAgo(6) });
    expect(pick([abroad, us]).job.id).toBe("us");
    expect(pick([abroad]).job.id).toBe("abroad");
  });

  it("needs at least three recognised skills in the posting", () => {
    expect(pick([job({ description: "Python and SQL are needed." })])).toBeNull();
    expect(pick([job({ description: "Python, SQL and Docker are needed." })])).not.toBeNull();
  });

  it("needs three of its skills, or two plus a title that fits the student's target role", () => {
    const twoOfThree = job({ title: "Backend Intern", description: "Python, SQL and Kubernetes experience wanted." });
    // names three skills but the student has two of them: not enough alone
    expect(pick([twoOfThree])).toBeNull();
    const withTarget = buildMatchProfile({ target_role: "Backend Engineer Intern" }, "Python, SQL, Docker, Git");
    expect(pickNewMatch({ jobs: [twoOfThree], profile: withTarget, now: NOW })).not.toBeNull();
    // the same two skills on a role that does not fit the target is still not enough
    const offTarget = job({ title: "Controllership Intern", description: "Python, SQL and Kubernetes experience wanted." });
    expect(pickNewMatch({ jobs: [offTarget], profile: withTarget, now: NOW })).toBeNull();
  });

  it("only suggests postings from the last 30 days", () => {
    expect(pick([job({ posted_at: daysAgo(29) })])).not.toBeNull();
    expect(pick([job({ posted_at: daysAgo(31) })])).toBeNull();
  });

  it("lets a fresh good match beat an older perfect one", () => {
    const fresh = job({ id: "fresh", title: "Platform Intern", posted_at: daysAgo(2), description: "Python, SQL and Docker." });
    const stale = job({ id: "stale", title: "Data Intern", posted_at: daysAgo(25), description: "Python, SQL and Docker." });
    expect(pick([stale, fresh]).job.id).toBe("fresh");
  });

  it("favours a title that fits the role the student said they want", () => {
    const withTarget = buildMatchProfile(
      { target_role: "Software Engineer Intern" },
      "I know Python, SQL, Docker, Git and JavaScript.",
    );
    const fitting = job({ id: "fit", title: "Software Engineer Intern, Backend", posted_at: daysAgo(10) });
    const other = job({ id: "other", title: "Finance Analyst Intern", posted_at: daysAgo(3) });
    expect(pickNewMatch({ jobs: [other, fitting], profile: withTarget, now: NOW }).job.id).toBe("fit");
    // with no target role, the fresher posting wins instead
    expect(pickNewMatch({ jobs: [other, fitting], profile, now: NOW }).job.id).toBe("other");
  });

  it("prefers the stronger match, then the newer posting", () => {
    const strong = job({ id: "strong", title: "ML Intern", description: "Python, SQL, Docker and Git required." });
    const okay = job({ id: "okay", description: "Python and SQL required; Kubernetes and Java are a plus." });
    expect(pick([okay, strong]).job.id).toBe("strong");

    const olderTwin = job({ id: "old", posted_at: daysAgo(10) });
    const newerTwin = job({ id: "new", posted_at: daysAgo(2) });
    expect(pick([olderTwin, newerTwin]).job.id).toBe("new");
  });
});

describe("the new match item in the plan", () => {
  const match = {
    job: { id: "j1", company: "Northwind", title: "Backend Intern", deadline: null, url: "u", description: "d" },
    score: 82,
    matchedSkills: ["python", "sql", "docker"],
    missingSkills: ["kubernetes"],
    skillsConsidered: 4,
    daysAgo: 2,
  };
  const base = { now: NOW, resumeCount: 1, goal: { title: "g" } };

  it("becomes an item built from the match, carrying what the page needs to track it", () => {
    const p = computePlan({ ...base, roles: [], jobMatch: match });
    const it1 = p.items.find((i) => i.signal === "new-match");
    expect(it1.title).toBe("Backend Intern at Northwind");
    expect(it1.why).toBe(
      "Posted 2 days ago. You have 3 of the 4 skills it lists (python, sql and docker), and it also asks for kubernetes.",
    );
    expect(it1.trackJob.id).toBe("j1");
    expect(it1.roleId).toBeNull();
    expect(it1.id).toBe("new-match:j1");
  });

  it("replaces the generic first step for an account with no roles", () => {
    const withMatch = computePlan({ ...base, roles: [], jobMatch: match });
    expect(withMatch.items.map((i) => i.signal)).toEqual(["new-match"]);
    const without = computePlan({ ...base, roles: [], jobMatch: null });
    expect(without.items.map((i) => i.signal)).toEqual(["first-role"]);
  });

  it("ranks below time-critical items and respects the three-item cap", () => {
    const overdue = {
      id: "r1", company: "Acme", role: "SWE Intern", status: "Wishlist", deadline: "2026-11-05",
      report_snapshot: { alignment: 80, skills: [] }, cover_letter: "x", created_at: daysAgo(9), updated_at: daysAgo(1),
    };
    const p = computePlan({ ...base, roles: [overdue], jobMatch: match });
    expect(p.items[0].signal).toBe("overdue");
    expect(p.items.length).toBeLessThanOrEqual(3);
    expect(p.items.map((i) => i.signal)).toContain("new-match");
  });

  it("says 'all' when the student has every skill it lists, and shows the location", () => {
    const all = {
      ...match,
      job: { ...match.job, location: "Austin, TX • Remote • Dallas, TX" },
      matchedSkills: ["python", "sql", "git"],
      missingSkills: [],
      skillsConsidered: 3,
    };
    expect(computePlan({ ...base, roles: [], jobMatch: all }).items[0].why).toBe(
      "Posted 2 days ago. You have all 3 skills it lists: python, sql and git. Location: Austin, TX • Remote.",
    );
  });

  it("never states a percentage", () => {
    expect(computePlan({ ...base, roles: [], jobMatch: match }).items[0].why).not.toMatch(/%/);
  });

  it("mentions a deadline only when it is still ahead", () => {
    const open = { ...match, job: { ...match.job, deadline: "2026-11-20T00:00:00Z" } };
    expect(computePlan({ ...base, roles: [], jobMatch: open }).items[0].why).toContain("Closes Nov 20.");
    const past = { ...match, job: { ...match.job, deadline: "2026-11-01T00:00:00Z" } };
    expect(computePlan({ ...base, roles: [], jobMatch: past }).items[0].why).not.toContain("Closes");
  });
});
