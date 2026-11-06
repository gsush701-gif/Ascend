import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { classifyEarlyCareer } from "./earlyCareer.js";
import { htmlToText, plainText, decodeEntities } from "./text.js";
import { ADAPTERS, inferRemoteType, fetchJson } from "./feeds.js";
import { syncBoards } from "./sync.js";
import { toRow } from "./store.js";
import { cleanTerm, splitTerms, rowToJob } from "../jobProviders/boardsProvider.js";

const require = createRequire(import.meta.url);
const boards = require("../../data/jobBoards.json");

describe("classifyEarlyCareer", () => {
  it("recognises internships and co-ops", () => {
    expect(classifyEarlyCareer({ title: "Software Engineer Intern (Summer 2027)" })).toBe("Internship");
    expect(classifyEarlyCareer({ title: "Spring 2027 Business Operations Internship/Co-op" })).toBe("Internship");
    expect(classifyEarlyCareer({ title: "Data Science Co-op" })).toBe("Internship");
    expect(classifyEarlyCareer({ title: "Analyst", employmentType: "Intern" })).toBe("Internship");
    expect(classifyEarlyCareer({ title: "Analyst", employmentType: "Internship" })).toBe("Internship");
  });

  it("recognises new-grad roles", () => {
    expect(classifyEarlyCareer({ title: "Software Engineer, New Grad (2027)" })).toBe("Entry");
    expect(classifyEarlyCareer({ title: "University Graduate - Backend Engineer" })).toBe("Entry");
    expect(classifyEarlyCareer({ title: "Early Career Product Designer" })).toBe("Entry");
  });

  it("leaves out senior titles and housing co-ops, but keeps Member of Technical Staff", () => {
    expect(classifyEarlyCareer({ title: "Staff Credit Policy Analyst – Condo, Co-op & Project Review" })).toBeNull();
    expect(classifyEarlyCareer({ title: "Senior Software Engineer (Early Career Mentor)" })).toBeNull();
    expect(classifyEarlyCareer({ title: "Staff Engineer, New Grad Programs" })).toBeNull();
    expect(classifyEarlyCareer({ title: "Member of Technical Staff (New Grad)" })).toBe("Entry");
    expect(classifyEarlyCareer({ title: "Associate Product Manager, New Grad (2027 Start)" })).toBe("Entry");
    expect(classifyEarlyCareer({ title: "Area Manager - New Grad" })).toBe("Entry");
  });

  it("does not mistake internal or international roles for internships", () => {
    expect(classifyEarlyCareer({ title: "AI Engineer, Internal Tools" })).toBeNull();
    expect(classifyEarlyCareer({ title: "International Sales Manager" })).toBeNull();
    expect(classifyEarlyCareer({ title: "Senior Staff Engineer" })).toBeNull();
    expect(classifyEarlyCareer({ title: "Account Executive", employmentType: "Full-time" })).toBeNull();
    expect(classifyEarlyCareer({})).toBeNull();
  });
});

describe("text cleanup", () => {
  it("decodes escaped Greenhouse HTML into readable text", () => {
    const escaped =
      "&lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;Figma&#39;s mission &amp; goals&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Python&lt;/li&gt;&lt;li&gt;React&lt;/li&gt;&lt;/ul&gt;&lt;/div&gt;";
    const text = htmlToText(escaped);
    expect(text).toContain("Figma's mission & goals");
    expect(text).toContain("• Python");
    expect(text).toContain("• React");
    expect(text).not.toContain("<");
  });

  it("removes scripts and handles numeric and unknown entities", () => {
    expect(htmlToText("<p>Hi<script>alert(1)</script> there</p>")).toBe("Hi there");
    expect(decodeEntities("&#x41;&#66;&unknownthing;")).toBe("AB&unknownthing;");
  });

  it("caps length and tolerates non-strings", () => {
    expect(htmlToText("<p>" + "a".repeat(20000) + "</p>").length).toBe(12000);
    expect(plainText("  a   b \n\n\n\n c ")).toBe("a b\n\nc");
    expect(htmlToText(undefined)).toBe("");
    expect(plainText(null)).toBe("");
  });
});

describe("inferRemoteType", () => {
  it("prefers the board's own workplace field", () => {
    expect(inferRemoteType({ workplaceType: "Hybrid", isRemote: true })).toBe("Hybrid");
    expect(inferRemoteType({ workplaceType: "onsite" })).toBe("Onsite");
    expect(inferRemoteType({ workplaceType: "remote" })).toBe("Remote");
  });
  it("falls back to the text, then to the remote flag", () => {
    expect(inferRemoteType({ location: "Remote - US" })).toBe("Remote");
    expect(inferRemoteType({ title: "Hybrid Intern" })).toBe("Hybrid");
    expect(inferRemoteType({ isRemote: true })).toBe("Remote");
    expect(inferRemoteType({ location: "Austin, TX" })).toBeUndefined();
  });
});

describe("board adapters", () => {
  it("maps a Greenhouse posting, using the board's own company name", () => {
    const board = { name: "SpaceX", ats: "greenhouse", token: "spacex" };
    const job = {
      id: 8621770002,
      title: "Spring 2027 Business Operations Internship/Co-op",
      company_name: "SpaceX",
      first_published: "2026-08-03T13:40:16-04:00",
      updated_at: "2026-11-04T18:30:16-05:00",
      location: { name: "Flexible - Any SpaceX Site" },
      absolute_url: "https://boards.greenhouse.io/spacex/jobs/8621770002",
      application_deadline: null,
    };
    const a = ADAPTERS.greenhouse;
    expect(a.classify(job)).toBe("Internship");
    const out = a.toJob(board, job, { content: "&lt;p&gt;Build rockets with Python&lt;/p&gt;" });
    expect(out).toMatchObject({
      externalId: "spacex:8621770002",
      boardToken: "spacex",
      sourceUpdatedAt: "2026-11-04T18:30:16-05:00|SpaceX",
      company: "SpaceX",
      description: "Build rockets with Python",
      url: "https://boards.greenhouse.io/spacex/jobs/8621770002",
      source: "Greenhouse",
      employmentType: "Internship",
      experienceLevel: "Internship",
    });
    expect(out.postedAt).toBe("2026-08-03T17:40:16.000Z");
    expect(out.deadline).toBeUndefined();
  });

  it("uses our company name even when Greenhouse's own name is wrong or a legal name", () => {
    const job = { id: 1, title: "SWE Intern", company_name: "Rubrik Job Board", absolute_url: "https://x" };
    const out = ADAPTERS.greenhouse.toJob({ name: "Rubrik", ats: "greenhouse", token: "rubrik" }, job, { content: "" });
    expect(out.company).toBe("Rubrik");
  });

  it("re-saves a company's postings after its display name is corrected", () => {
    const job = { id: 1, title: "SWE Intern", updated_at: "2026-11-04" };
    const before = ADAPTERS.greenhouse.version(job, { name: "Rubrik Job Board" });
    const after = ADAPTERS.greenhouse.version(job, { name: "Rubrik" });
    expect(before).not.toBe(after);
  });

  it("maps a Lever posting, including its requirement lists", () => {
    const board = { name: "Palantir", ats: "lever", token: "palantir" };
    const job = {
      id: "774cf5c9",
      text: "Deployment Strategist, Internship",
      categories: { commitment: "Internship", location: "Paris, France", allLocations: ["Paris, France"] },
      createdAt: 1778517108152,
      workplaceType: "onsite",
      hostedUrl: "https://jobs.lever.co/palantir/774cf5c9",
      descriptionPlain: "A world-changing company.",
      lists: [{ text: "What you need", content: "<li>Python</li><li>SQL</li>" }],
      additionalPlain: "Equal opportunity employer.",
    };
    const out = ADAPTERS.lever.toJob(board, job);
    expect(out.company).toBe("Palantir");
    expect(out.location).toBe("Paris, France");
    expect(out.remoteType).toBe("Onsite");
    expect(out.description).toContain("A world-changing company.");
    expect(out.description).toContain("• Python");
    expect(out.description).toContain("Equal opportunity employer.");
    expect(out.postedAt).toBe(new Date(1778517108152).toISOString());
    expect(ADAPTERS.lever.classify({ text: "Engineer", categories: { commitment: "Intern" } })).toBe("Internship");
  });

  it("maps an Ashby posting and skips unlisted ones", () => {
    const board = { name: "Notion", ats: "ashby", token: "notion" };
    const job = {
      id: "3fba1c39",
      title: "Software Engineer Intern (Summer 2027)",
      employmentType: "Intern",
      location: "San Francisco, California",
      secondaryLocations: [{ location: "New York, New York" }],
      isRemote: true,
      workplaceType: "Hybrid",
      publishedAt: "2026-08-14T19:07:13.459+00:00",
      jobUrl: "https://jobs.ashbyhq.com/notion/3fba1c39",
      descriptionPlain: "WHO WE ARE",
      isListed: true,
    };
    const out = ADAPTERS.ashby.toJob(board, job);
    expect(out.location).toBe("San Francisco, California • New York, New York");
    expect(out.remoteType).toBe("Hybrid");
    expect(out.employmentType).toBe("Internship");
    expect(out.url).toBe("https://jobs.ashbyhq.com/notion/3fba1c39");
    const list = ADAPTERS.ashby.parseList({ jobs: [job, { ...job, id: "x", isListed: false }] });
    expect(list).toHaveLength(1);
  });

  it("rejects unexpected response shapes", () => {
    expect(ADAPTERS.greenhouse.parseList({ nope: 1 })).toBeNull();
    expect(ADAPTERS.lever.parseList({ jobs: [] })).toBeNull();
    expect(ADAPTERS.ashby.parseList(null)).toBeNull();
  });

  it("builds URLs with the token safely encoded", () => {
    expect(ADAPTERS.greenhouse.listUrl("a b")).toBe("https://boards-api.greenhouse.io/v1/boards/a%20b/jobs");
    expect(ADAPTERS.lever.listUrl("palantir")).toBe("https://api.lever.co/v0/postings/palantir?mode=json");
    expect(ADAPTERS.ashby.listUrl("notion")).toBe("https://api.ashbyhq.com/posting-api/job-board/notion");
  });
});

describe("fetchJson", () => {
  const ok = (body) => ({ ok: true, status: 200, json: async () => body });
  const bad = (status) => ({ ok: false, status, json: async () => ({}) });

  it("returns parsed JSON", async () => {
    expect(await fetchJson("u", { fetchImpl: async () => ok({ a: 1 }) })).toEqual({ a: 1 });
  });

  it("throws a 404 straight away without retrying", async () => {
    let calls = 0;
    await expect(
      fetchJson("u", { fetchImpl: async () => (calls++, bad(404)), retries: 2 }),
    ).rejects.toMatchObject({ status: 404 });
    expect(calls).toBe(1);
  });
});

describe("syncBoards", () => {
  /** An in-memory stand-in for the jobs table. */
  function fakeStore(known = {}) {
    const calls = { upserts: [], touched: [], closed: [], removed: [] };
    return {
      calls,
      async loadKnown(source, token) {
        return new Map(Object.entries(known[`${source}:${token}`] || {}));
      },
      async upsertJobs(rows) {
        calls.upserts.push(...rows);
      },
      async touchSeen(source, token, ids) {
        calls.touched.push(...ids);
      },
      async deactivateMissing(source, token) {
        calls.closed.push(`${source}:${token}`);
        return 2;
      },
      async deactivateRemovedBoards(source, keepTokens) {
        calls.removed.push({ source, keepTokens });
        return 3;
      },
    };
  }

  const ghBoard = { name: "Acme", ats: "greenhouse", token: "acme" };
  const ghJob = (id, title, updated = "v1") => ({
    id,
    title,
    updated_at: updated,
    location: { name: "Remote" },
    absolute_url: `https://boards.greenhouse.io/acme/jobs/${id}`,
  });

  it("keeps only early-career postings and downloads details for new ones", async () => {
    const store = fakeStore();
    const fetched = [];
    const fetchJsonFake = async (url) => {
      fetched.push(url);
      if (url.endsWith("/jobs")) return { jobs: [ghJob(1, "SWE Intern"), ghJob(2, "Staff Engineer"), ghJob(3, "New Grad Engineer")] };
      return { content: "&lt;p&gt;desc&lt;/p&gt;" };
    };
    const summary = await syncBoards({ boards: [ghBoard], fetchJson: fetchJsonFake, store });
    expect(summary).toMatchObject({ boardsOk: 1, boardsFailed: 0, listed: 3, matched: 2, saved: 2, closed: 2 });
    expect(store.calls.upserts.map((r) => r.externalId).sort()).toEqual(["acme:1", "acme:3"]);
    expect(fetched.filter((u) => u.includes("/jobs/"))).toHaveLength(2);
    expect(store.calls.closed).toEqual(["Greenhouse:acme"]);
  });

  it("does not re-download a Greenhouse posting that has not changed", async () => {
    const store = fakeStore({ "Greenhouse:acme": { "acme:1": "v1|Acme" } });
    const fetched = [];
    const fetchJsonFake = async (url) => {
      fetched.push(url);
      return { jobs: [ghJob(1, "SWE Intern", "v1")] };
    };
    const summary = await syncBoards({ boards: [ghBoard], fetchJson: fetchJsonFake, store });
    expect(summary).toMatchObject({ saved: 0, unchanged: 1 });
    expect(store.calls.touched).toEqual(["acme:1"]);
    expect(fetched).toHaveLength(1); // the list only, no detail call
  });

  it("re-downloads an edited posting", async () => {
    const store = fakeStore({ "Greenhouse:acme": { "acme:1": "v1|Acme" } });
    const fetchJsonFake = async (url) =>
      url.endsWith("/jobs") ? { jobs: [ghJob(1, "SWE Intern", "v2")] } : { content: "new" };
    const summary = await syncBoards({ boards: [ghBoard], fetchJson: fetchJsonFake, store });
    expect(summary).toMatchObject({ saved: 1, unchanged: 0 });
    expect(store.calls.upserts[0].sourceUpdatedAt).toBe("v2|Acme");
  });

  it("keeps an already-saved posting open when its detail download fails", async () => {
    const store = fakeStore({ "Greenhouse:acme": { "acme:1": "v1|Acme" } });
    const fetchJsonFake = async (url) => {
      if (url.endsWith("/jobs")) return { jobs: [ghJob(1, "SWE Intern", "v2"), ghJob(4, "ML Intern", "v1")] };
      throw new Error("boom");
    };
    const summary = await syncBoards({ boards: [ghBoard], fetchJson: fetchJsonFake, store });
    expect(store.calls.touched).toEqual(["acme:1"]); // existing one stays open
    expect(store.calls.upserts).toHaveLength(0); // the new one is retried next run
    expect(summary.boardsFailed).toBe(0);
  });

  it("skips a failed board entirely and closes nothing for it", async () => {
    const store = fakeStore();
    const fetchJsonFake = async () => {
      throw new Error("HTTP 500");
    };
    const summary = await syncBoards({ boards: [ghBoard], fetchJson: fetchJsonFake, store });
    expect(summary).toMatchObject({ boardsOk: 0, boardsFailed: 1 });
    expect(summary.failures[0]).toMatchObject({ board: "Acme", error: "HTTP 500" });
    expect(store.calls.closed).toEqual([]);
    expect(store.calls.upserts).toEqual([]);
  });

  it("leaves out postings more than a year old, and closes them if they were saved before", async () => {
    const store = fakeStore();
    const fetchJsonFake = async (url) =>
      url.endsWith("/jobs")
        ? {
            jobs: [
              { ...ghJob(1, "SWE Intern"), first_published: "2020-03-01T00:00:00Z" },
              { ...ghJob(2, "ML Intern"), first_published: new Date().toISOString() },
            ],
          }
        : { content: "desc" };
    const summary = await syncBoards({ boards: [ghBoard], fetchJson: fetchJsonFake, store });
    expect(summary).toMatchObject({ matched: 1, tooOld: 1, saved: 1 });
    expect(store.calls.upserts.map((r) => r.externalId)).toEqual(["acme:2"]);
    expect(store.calls.closed).toEqual(["Greenhouse:acme"]); // the old one is not touched, so it gets closed
  });

  it("closes postings left behind by companies removed from the list", async () => {
    const store = fakeStore();
    const lever = { name: "Palantir", ats: "lever", token: "palantir" };
    const summary = await syncBoards({
      boards: [ghBoard, lever],
      fetchJson: async (url) => (url.includes("lever.co") ? [] : { jobs: [] }),
      store,
    });
    const bySource = Object.fromEntries(store.calls.removed.map((r) => [r.source, r.keepTokens]));
    expect(bySource).toEqual({ Greenhouse: ["acme"], Lever: ["palantir"], Ashby: [] });
    expect(summary.removedClosed).toBe(9);
  });

  it("does not clean up removed boards after an incomplete run or with an empty list", async () => {
    const incompleteStore = fakeStore();
    await syncBoards({ boards: [ghBoard], fetchJson: async () => ({ jobs: [] }), store: incompleteStore, budgetMs: -1 });
    expect(incompleteStore.calls.removed).toEqual([]);

    const emptyStore = fakeStore();
    await syncBoards({ boards: [], fetchJson: async () => ({ jobs: [] }), store: emptyStore });
    expect(emptyStore.calls.removed).toEqual([]);
  });

  it("does not close anything when a board lists no postings at all", async () => {
    const store = fakeStore();
    const summary = await syncBoards({ boards: [ghBoard], fetchJson: async () => ({ jobs: [] }), store });
    expect(summary.boardsOk).toBe(1);
    expect(store.calls.closed).toEqual([]);
  });

  it("saves Lever and Ashby postings straight from the list", async () => {
    const store = fakeStore();
    const lever = { name: "Palantir", ats: "lever", token: "palantir" };
    const ashby = { name: "Notion", ats: "ashby", token: "notion" };
    const fetchJsonFake = async (url) =>
      url.includes("lever.co")
        ? [{ id: "l1", text: "Engineer Intern", categories: {}, hostedUrl: "https://jobs.lever.co/palantir/l1" }]
        : { jobs: [{ id: "a1", title: "Design Intern", jobUrl: "https://jobs.ashbyhq.com/notion/a1", isListed: true }] };
    const summary = await syncBoards({ boards: [lever, ashby], fetchJson: fetchJsonFake, store });
    expect(summary).toMatchObject({ boardsOk: 2, saved: 2 });
    expect(store.calls.upserts.map((r) => r.source).sort()).toEqual(["Ashby", "Lever"]);
  });

  it("drops postings with no title or link", async () => {
    const store = fakeStore();
    const lever = { name: "Palantir", ats: "lever", token: "palantir" };
    const fetchJsonFake = async () => [{ id: "l1", text: "Engineer Intern", categories: {} }];
    const summary = await syncBoards({ boards: [lever], fetchJson: fetchJsonFake, store });
    expect(summary.saved).toBe(0);
  });

  it("stops starting new boards once the time budget is spent", async () => {
    const store = fakeStore();
    const summary = await syncBoards({
      boards: [ghBoard, { ...ghBoard, token: "b2" }],
      fetchJson: async () => ({ jobs: [] }),
      store,
      budgetMs: -1,
    });
    expect(summary.incomplete).toBe(true);
    expect(summary.boardsOk).toBe(0);
  });
});

describe("store row mapping", () => {
  it("turns a normalised posting into a jobs row", () => {
    const row = toRow(
      {
        externalId: "acme:1",
        boardToken: "acme",
        company: "Acme",
        title: "SWE Intern",
        url: "https://x",
        source: "Greenhouse",
        postedAt: "not a date",
        deadline: "2026-12-01T00:00:00Z",
      },
      "2026-11-10T09:00:00.000Z",
    );
    expect(row).toMatchObject({
      external_id: "acme:1",
      board_token: "acme",
      posted_at: null,
      deadline: "2026-12-01T00:00:00.000Z",
      active: true,
      last_seen_at: "2026-11-10T09:00:00.000Z",
      description: null,
    });
  });
});

describe("job search helpers", () => {
  it("strips characters that are part of the filter syntax", () => {
    expect(cleanTerm('react, (node) "x" %*')).toBe("react node x");
    expect(splitTerms("backend  engineer, python")).toEqual(["backend", "engineer", "python"]);
    expect(splitTerms("a b c d e f g h")).toHaveLength(6);
    expect(cleanTerm(undefined)).toBe("");
  });

  it("maps a row to the camelCase job shape and trims long descriptions", () => {
    const job = rowToJob({
      id: "1",
      company: "Acme",
      title: "SWE Intern",
      description: "x".repeat(5000),
      url: "u",
      source: "Lever",
      location: null,
      remote_type: "Remote",
      employment_type: "Internship",
      experience_level: "Internship",
      posted_at: "2026-11-01T00:00:00Z",
      deadline: null,
    });
    expect(job.description.length).toBe(1500);
    expect(job).toMatchObject({ remoteType: "Remote", employmentType: "Internship", location: undefined });
  });
});

describe("the curated company list", () => {
  it("has well-formed, unique entries", () => {
    expect(boards.length).toBeGreaterThan(50);
    const seen = new Set();
    for (const b of boards) {
      expect(typeof b.name).toBe("string");
      expect(b.name.trim()).not.toBe("");
      expect(["greenhouse", "lever", "ashby"]).toContain(b.ats);
      expect(b.token).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
      const key = `${b.ats}:${b.token}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
