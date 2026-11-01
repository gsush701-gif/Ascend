import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { canonicalJobUrl } = require("./jobUrl");

describe("canonicalJobUrl — LinkedIn", () => {
  it("keeps a job page's id and drops tracking parameters", () => {
    expect(
      canonicalJobUrl("https://www.linkedin.com/jobs/view/4123456789/?refId=abc&trackingId=xyz", "LinkedIn"),
    ).toBe("https://www.linkedin.com/jobs/view/4123456789/");
  });

  it("reads the id out of a slug-style address", () => {
    expect(
      canonicalJobUrl("https://www.linkedin.com/jobs/view/software-engineer-intern-at-acme-4123456789", "LinkedIn"),
    ).toBe("https://www.linkedin.com/jobs/view/4123456789/");
  });

  it("uses the selected job on a search-results page, not the search itself", () => {
    expect(
      canonicalJobUrl("https://www.linkedin.com/jobs/search/?keywords=intern&currentJobId=4123456789&geoId=1", "LinkedIn"),
    ).toBe("https://www.linkedin.com/jobs/view/4123456789/");
  });

  it("returns null when no job is identifiable", () => {
    expect(canonicalJobUrl("https://www.linkedin.com/jobs/search/?keywords=intern", "LinkedIn")).toBeNull();
  });
});

describe("canonicalJobUrl — Indeed", () => {
  it("rebuilds the job's own page from jk or from vjk on a search page", () => {
    expect(canonicalJobUrl("https://www.indeed.com/viewjob?jk=abcdef1234567890&from=serp", "Indeed")).toBe(
      "https://www.indeed.com/viewjob?jk=abcdef1234567890",
    );
    expect(canonicalJobUrl("https://www.indeed.com/jobs?q=intern&vjk=abcdef1234567890", "Indeed")).toBe(
      "https://www.indeed.com/viewjob?jk=abcdef1234567890",
    );
  });

  it("returns null for an Indeed page with no job key", () => {
    expect(canonicalJobUrl("https://www.indeed.com/jobs?q=intern", "Indeed")).toBeNull();
  });
});

describe("canonicalJobUrl — safety", () => {
  it("never returns an address for an unrecognised page, source mismatch, or bad input", () => {
    expect(canonicalJobUrl("https://example.com/jobs/view/4123456789", "LinkedIn")).toBeNull();
    expect(canonicalJobUrl("https://www.linkedin.com/jobs/view/4123456789", "Indeed")).toBeNull();
    expect(canonicalJobUrl("https://mybank.com/account?jk=abcdef1234567890", null)).toBeNull();
    expect(canonicalJobUrl("not a url", "LinkedIn")).toBeNull();
    expect(canonicalJobUrl("javascript:alert(1)", "LinkedIn")).toBeNull();
    // a look-alike host must not pass
    expect(canonicalJobUrl("https://linkedin.com.evil.test/jobs/view/4123456789", "LinkedIn")).toBeNull();
  });
});
