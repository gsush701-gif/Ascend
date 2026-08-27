import { describe, it, expect } from "vitest";
import { parsePagination, buildPageResult, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./pagination.js";

describe("parsePagination", () => {
  it("defaults to page 1 and the default page size when unset", () => {
    expect(parsePagination({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, offset: 0 });
  });

  it("parses valid page/pageSize query params", () => {
    expect(parsePagination({ page: "3", pageSize: "10" })).toEqual({ page: 3, pageSize: 10, offset: 20 });
  });

  it("clamps pageSize to the max", () => {
    expect(parsePagination({ pageSize: "999" }).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it("falls back to defaults for non-numeric or invalid input", () => {
    expect(parsePagination({ page: "abc", pageSize: "xyz" })).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      offset: 0,
    });
  });

  it("falls back to page 1 for zero/negative page", () => {
    expect(parsePagination({ page: "0" }).page).toBe(1);
    expect(parsePagination({ page: "-5" }).page).toBe(1);
  });

  it("falls back to default pageSize for zero/negative pageSize", () => {
    expect(parsePagination({ pageSize: "0" }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePagination({ pageSize: "-1" }).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("respects custom defaultPageSize/maxPageSize options", () => {
    expect(parsePagination({}, { defaultPageSize: 5 }).pageSize).toBe(5);
    expect(parsePagination({ pageSize: "50" }, { maxPageSize: 25 }).pageSize).toBe(25);
  });

  it("computes offset correctly for page > 1", () => {
    expect(parsePagination({ page: "5", pageSize: "20" }).offset).toBe(80);
  });
});

describe("buildPageResult", () => {
  it("builds the standard shape and computes totalPages", () => {
    expect(buildPageResult({ page: 2, pageSize: 10, total: 25, items: [1, 2, 3] })).toEqual({
      page: 2,
      pageSize: 10,
      total: 25,
      totalPages: 3,
      items: [1, 2, 3],
    });
  });

  it("returns 0 totalPages when total is 0", () => {
    expect(buildPageResult({ page: 1, pageSize: 10, total: 0, items: [] }).totalPages).toBe(0);
  });

  it("returns exactly 1 totalPage when total equals pageSize", () => {
    expect(buildPageResult({ page: 1, pageSize: 10, total: 10, items: [] }).totalPages).toBe(1);
  });
});
