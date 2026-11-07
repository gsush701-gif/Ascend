import { describe, it, expect } from "vitest";
import { filterJobRows, parseJobFilters, isEmptyFilter } from "./jobFilter.js";

const rows = [
  {
    id: "1",
    title: "Backend Software Engineer Intern",
    company: "Stripe",
    description: "Build APIs in Python and SQL with Docker.",
    location: "Seattle, WA",
    remote_type: "Hybrid",
    experience_level: "Internship",
    employment_type: "Internship",
  },
  {
    id: "2",
    title: "Software Engineer, New Grad",
    company: "Palantir",
    description: "Distributed systems in Java and C++.",
    location: "New York, NY",
    remote_type: null,
    experience_level: "Entry",
    employment_type: null,
  },
  {
    id: "3",
    title: "Data Science Intern",
    company: "Figma",
    description: "Analysis with Python, pandas and statistics.",
    location: "San Francisco, CA",
    remote_type: "Remote",
    experience_level: "Internship",
    employment_type: "Internship",
  },
];
const ids = (list) => list.map((r) => r.id);
const f = (over) => ({ ...parseJobFilters({}), ...over });

describe("filterJobRows", () => {
  it("returns everything when no filter is set", () => {
    expect(filterJobRows(rows, f({}))).toBe(rows);
    expect(isEmptyFilter(f({}))).toBe(true);
    expect(isEmptyFilter(f({ company: "x" }))).toBe(false);
  });

  it("requires every keyword, in the title, company or description, ignoring case", () => {
    expect(ids(filterJobRows(rows, f({ keywords: "software engineer" })))).toEqual(["1", "2"]);
    expect(ids(filterJobRows(rows, f({ keywords: "python stripe" })))).toEqual(["1"]);
    expect(ids(filterJobRows(rows, f({ keywords: "PYTHON" })))).toEqual(["1", "3"]);
    expect(filterJobRows(rows, f({ keywords: "kubernetes" }))).toEqual([]);
  });

  it("matches part of the location and part of the company", () => {
    expect(ids(filterJobRows(rows, f({ location: "ny" })))).toEqual(["2"]);
    expect(ids(filterJobRows(rows, f({ location: "wa" })))).toEqual(["1"]);
    expect(ids(filterJobRows(rows, f({ company: "fig" })))).toEqual(["3"]);
  });

  it("matches work style exactly", () => {
    expect(ids(filterJobRows(rows, f({ remoteType: "Remote" })))).toEqual(["3"]);
    expect(ids(filterJobRows(rows, f({ remoteType: "Hybrid" })))).toEqual(["1"]);
  });

  it("matches level against the level or the employment type", () => {
    expect(ids(filterJobRows(rows, f({ experienceLevel: "Internship" })))).toEqual(["1", "3"]);
    expect(ids(filterJobRows(rows, f({ experienceLevel: "Entry" })))).toEqual(["2"]);
  });

  it("matches any one of the skills, from a list or a comma-separated string", () => {
    expect(ids(filterJobRows(rows, f({ skills: "java, sql" })))).toEqual(["1", "2"]);
    expect(ids(filterJobRows(rows, f({ skills: ["pandas"] })))).toEqual(["3"]);
    expect(filterJobRows(rows, f({ skills: "rust" }))).toEqual([]);
  });

  it("combines filters (all must hold)", () => {
    expect(ids(filterJobRows(rows, f({ experienceLevel: "Internship", skills: "python", remoteType: "Remote" })))).toEqual([
      "3",
    ]);
    expect(filterJobRows(rows, f({ experienceLevel: "Entry", remoteType: "Remote" }))).toEqual([]);
  });

  it("copes with rows that have missing fields", () => {
    expect(() => filterJobRows([{ id: "x" }], f({ keywords: "a", location: "b", company: "c", skills: "d" }))).not.toThrow();
  });
});

describe("parseJobFilters", () => {
  it("keeps short strings and known values, and drops anything else", () => {
    expect(
      parseJobFilters({
        keywords: "  python  ",
        location: "Austin",
        company: "x".repeat(500),
        remoteType: "Remote",
        experienceLevel: "Entry",
        skills: "a,b",
      }),
    ).toEqual({
      keywords: "python",
      location: "Austin",
      company: "x".repeat(200),
      remoteType: "Remote",
      experienceLevel: "Entry",
      skills: "a,b",
    });
    expect(parseJobFilters({ remoteType: "Mars", experienceLevel: "Senior", keywords: { a: 1 }, skills: ["x"] })).toEqual({
      keywords: "",
      location: "",
      company: "",
      remoteType: "",
      experienceLevel: "",
      skills: "",
    });
    expect(parseJobFilters(undefined)).toEqual(parseJobFilters({}));
  });
});
