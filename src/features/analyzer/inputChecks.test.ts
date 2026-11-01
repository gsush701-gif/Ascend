import { describe, expect, it } from "vitest";
import { buildNextSteps, jdHint, validateResumeFile, MAX_RESUME_BYTES } from "./inputChecks";

const pdf = (over: Partial<{ name: string; type: string; size: number }> = {}) => ({
  name: "resume.pdf",
  type: "application/pdf",
  size: 120_000,
  ...over,
});

describe("validateResumeFile", () => {
  it("accepts a normal PDF, including one the browser reports with no type", () => {
    expect(validateResumeFile(pdf())).toBeNull();
    expect(validateResumeFile(pdf({ type: "" }))).toBeNull();
  });

  it("accepts a Word .docx, by type or by name", () => {
    expect(validateResumeFile(pdf({ name: "cv.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }))).toBeNull();
    expect(validateResumeFile(pdf({ name: "My Resume.DOCX", type: "" }))).toBeNull();
  });

  it("explains what to do for an old .doc, an image, or something else", () => {
    expect(validateResumeFile(pdf({ name: "cv.doc", type: "application/msword" }))).toMatch(/\.docx or PDF/);
    expect(validateResumeFile(pdf({ name: "scan.jpg", type: "image/jpeg" }))).toMatch(/image/i);
    expect(validateResumeFile(pdf({ name: "notes.txt", type: "text/plain" }))).toMatch(/PDF or Word/);
  });

  it("rejects an empty or oversized file", () => {
    expect(validateResumeFile(pdf({ size: 0 }))).toMatch(/empty/i);
    expect(validateResumeFile(pdf({ size: MAX_RESUME_BYTES + 1 }))).toMatch(/5MB/);
  });
});

describe("jdHint", () => {
  it("is not ready for empty text or a bare link, and says why", () => {
    expect(jdHint("")).toMatchObject({ ready: false });
    const link = jdHint("https://www.linkedin.com/jobs/view/123456");
    expect(link.ready).toBe(false);
    expect(link.message).toMatch(/link/i);
  });

  it("is not ready under the minimum, ready but nudged when short, clean when long", () => {
    expect(jdHint("too short").ready).toBe(false);
    const short = jdHint("We need a backend intern who knows Node and SQL.");
    expect(short.ready).toBe(true);
    expect(short.message).toMatch(/short/i);
    expect(jdHint("x".repeat(400))).toEqual({ ready: true, message: null });
  });
});

describe("buildNextSteps", () => {
  const skills = [
    { name: "Docker", status: "miss" as const, importance: "required" },
    { name: "Kubernetes", status: "miss" as const, importance: "preferred" },
    { name: "React", status: "hit" as const, importance: "required" },
  ];

  it("leads with missing required skills, then a common gap, then the role", () => {
    const steps = buildNextSteps({
      alignment: 60,
      skills,
      missingSignals: ["No deployment/hosting experience mentioned"],
    });
    expect(steps).toHaveLength(3);
    expect(steps[0]).toMatch(/Docker/);
    expect(steps[0]).toMatch(/one true bullet\./); // single skill: no "each"
    expect(steps[0]).not.toMatch(/Kubernetes/);
    expect(steps[1]).toMatch(/deployment/i);
    expect(steps[2]).toMatch(/analyze again/i);
  });

  it("treats missing preferred skills as optional and congratulates a strong fit", () => {
    const steps = buildNextSteps({
      alignment: 90,
      skills: [{ name: "Kubernetes", status: "miss", importance: "preferred" }],
      missingSignals: [],
    });
    expect(steps[0]).toMatch(/Optional/);
    expect(steps[steps.length - 1]).toMatch(/strong fit/i);
  });

  it("falls back to just the closing step when nothing is missing", () => {
    expect(buildNextSteps({ alignment: 95, skills: [], missingSignals: [] })).toHaveLength(1);
  });
});

import { guessRoleAndCompany } from "./inputChecks";

describe("guessRoleAndCompany", () => {
  it("reads a title line followed by a 'Company, City' line", () => {
    const jd = "Software Engineer Intern, Backend (Summer 2027)\nNorthwind Labs, Dallas, TX (hybrid)\n\nAbout the role...";
    expect(guessRoleAndCompany(jd)).toEqual({ role: "Software Engineer Intern, Backend", company: "Northwind Labs" });
  });

  it("splits 'Role at Company' and 'Role - Company' titles", () => {
    expect(guessRoleAndCompany("Backend Intern at Stripe\nWe build payments")).toEqual({ role: "Backend Intern", company: "Stripe" });
    expect(guessRoleAndCompany("Data Analyst Intern - Acme Corp\nRemote")).toEqual({ role: "Data Analyst Intern", company: "Acme Corp" });
  });

  it("uses a labelled company line when the title has none", () => {
    expect(guessRoleAndCompany("Product Design Intern\nCompany: Globex\nResponsibilities...").company).toBe("Globex");
  });

  it("returns nulls rather than guessing from a sentence or an empty posting", () => {
    expect(guessRoleAndCompany("We are looking for someone who loves building things and working with a great team.")).toEqual({ role: null, company: null });
    expect(guessRoleAndCompany("")).toEqual({ role: null, company: null });
  });

  it("does not take a long description line as the company", () => {
    const jd = "Engineering Intern\nYou will work on the platform team to build features that customers use every day.";
    expect(guessRoleAndCompany(jd).company).toBeNull();
  });
});
