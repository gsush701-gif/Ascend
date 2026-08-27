import { describe, it, expect } from "vitest";
import { NullJobProvider } from "./nullProvider.js";

describe("NullJobProvider", () => {
  it("is flagged as not configured", () => {
    expect(NullJobProvider.isConfigured).toBe(false);
  });

  it("search() always resolves to an empty, clearly-flagged result", async () => {
    const result = await NullJobProvider.search({ keywords: "engineer" });
    expect(result.jobs).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.providerConfigured).toBe(false);
  });

  it("never throws, even with no params at all", async () => {
    await expect(NullJobProvider.search()).resolves.toBeDefined();
    await expect(NullJobProvider.search(undefined)).resolves.toBeDefined();
  });

  it("never fabricates a posting regardless of the search params passed in", async () => {
    const result = await NullJobProvider.search({
      keywords: "software engineer",
      location: "San Francisco, CA",
      remoteType: "Remote",
      salaryMin: 100000,
      salaryMax: 200000,
      sponsorship: "Yes",
      skills: ["python", "react"],
      experienceLevel: "Entry",
      company: "Example Co",
      jobType: "Full-time",
    });
    expect(result.jobs).toHaveLength(0);
  });

  it("echoes back a normalized page/pageSize", async () => {
    const result = await NullJobProvider.search({ page: 3, pageSize: 10 });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
  });

  it("falls back to page 1 / a default pageSize for invalid or missing values", async () => {
    const result = await NullJobProvider.search({ page: -1, pageSize: 0 });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBeGreaterThan(0);

    const defaults = await NullJobProvider.search({});
    expect(defaults.page).toBe(1);
    expect(defaults.pageSize).toBeGreaterThan(0);
  });
});

describe("job provider selection (server/lib/jobProviders/index.js)", () => {
  it("defaults to the NullJobProvider and reports providerConfigured: false", async () => {
    // index.js reads JOB_PROVIDER once at require-time (matching this
    // codebase's existing configured-or-no-op modules such as
    // server/lib/stripe.js), and no test in this suite sets JOB_PROVIDER, so
    // importing it here exercises the real default ("none") path.
    const mod = await import("./index.js");
    expect(mod.isJobProviderConfigured).toBe(false);
    expect(mod.activeProvider.isConfigured).toBe(false);
    const result = await mod.activeProvider.search({});
    expect(result.providerConfigured).toBe(false);
    expect(mod.JOB_PROVIDER).toBe("none");
  });
});
