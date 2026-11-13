import { describe, expect, it } from "vitest";
import { scrubBreadcrumb, scrubEvent, scrubUrl } from "./scrubReport";

describe("scrubUrl", () => {
  it("cuts off the session a sign-in leaves in the address bar", () => {
    expect(scrubUrl("https://ascendcareers.app/dashboard#access_token=eyJabc&refresh_token=xyz&type=recovery")).toBe(
      "https://ascendcareers.app/dashboard",
    );
  });

  it("cuts off a one-time sign-in code", () => {
    expect(scrubUrl("https://ascendcareers.app/login?code=4f1c2d&next=%2Fjobs")).toBe("https://ascendcareers.app/login");
  });

  it("leaves a plain address as it is", () => {
    expect(scrubUrl("https://ascendcareers.app/roles/123")).toBe("https://ascendcareers.app/roles/123");
    expect(scrubUrl("/roles/123")).toBe("/roles/123");
  });

  it("passes through anything that is not text", () => {
    expect(scrubUrl(undefined)).toBeUndefined();
    expect(scrubUrl(42)).toBe(42);
  });
});

describe("scrubBreadcrumb", () => {
  it("cleans the addresses in a navigation breadcrumb", () => {
    const crumb = scrubBreadcrumb({
      category: "navigation",
      data: { from: "/login#access_token=secret", to: "/dashboard?checkout=success" },
    });
    expect(crumb?.data).toEqual({ from: "/login", to: "/dashboard" });
  });

  it("cleans the address of a network request", () => {
    const crumb = scrubBreadcrumb({
      category: "fetch",
      data: { url: "https://api.example.com/api/jobs/search?q=stripe+intern", method: "GET", status_code: 200 },
    });
    expect(crumb?.data).toEqual({ url: "https://api.example.com/api/jobs/search", method: "GET", status_code: 200 });
  });

  it("drops console output", () => {
    expect(scrubBreadcrumb({ category: "console", message: "insert failed: duplicate key (jordan@example.com)" })).toBeNull();
  });
});

describe("scrubEvent", () => {
  it("removes sign-in secrets, cookies and personal details from a report", () => {
    const event = scrubEvent({
      request: {
        url: "https://ascendcareers.app/dashboard#access_token=eyJabc&refresh_token=xyz",
        query_string: "code=abc",
        cookies: { a: "b" },
        headers: { Referer: "https://ascendcareers.app/login?code=abc", "User-Agent": "Mozilla" },
      },
      user: { id: "u1", email: "jordan@example.com", ip_address: "1.2.3.4" },
      breadcrumbs: [
        { category: "console", message: "resume text here" },
        { category: "navigation", data: { from: "/login#access_token=eyJabc", to: "/dashboard" } },
      ],
    });
    const text = JSON.stringify(event);
    expect(text).not.toContain("eyJabc");
    expect(text).not.toContain("code=abc");
    expect(text).not.toContain("jordan@example.com");
    expect(text).not.toContain("resume text here");
    expect(event.request?.url).toBe("https://ascendcareers.app/dashboard");
    expect(event.request?.headers).toEqual({ Referer: "https://ascendcareers.app/login", "User-Agent": "Mozilla" });
    expect(event.user).toEqual({ id: "u1" });
    expect(event.breadcrumbs).toHaveLength(1);
  });

  it("copes with a report that has none of those parts", () => {
    expect(scrubEvent({})).toEqual({});
  });
});
