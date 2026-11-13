import { describe, expect, it } from "vitest";
import { redactContactDetails, scrubErrorEvent, sanitizeTrackMetadata } from "./redact";

describe("redactContactDetails", () => {
  it("replaces email addresses and phone numbers with placeholders", () => {
    const resume = "Jordan Rivera\njordan.rivera@example.com | (555) 019-2837 | github.com/jordanrivera";
    const out = redactContactDetails(resume);
    expect(out).toBe("Jordan Rivera\n[email] | [phone] | github.com/jordanrivera");
  });

  it("handles the common ways a phone number is written", () => {
    for (const phone of ["555-123-4567", "555.123.4567", "555 123 4567", "+1 555 123 4567", "+1-555-123-4567", "5551234567"]) {
      expect(redactContactDetails(`Call ${phone} today`)).toBe("Call [phone] today");
    }
  });

  it("leaves dates, years, scores and metrics alone", () => {
    const text =
      "Software Intern, May 2024 - Aug 2025. GPA 3.85/4.00. Cut load time by 30% for 10,000 users. Handled 1200 requests per second. Built in 2023-2024.";
    expect(redactContactDetails(text)).toBe(text);
  });

  it("leaves bullets untouched so they can still be matched word for word", () => {
    const bullet = "Built a REST API in Node.js serving 2,500 daily users with 99.9% uptime";
    expect(redactContactDetails(bullet)).toBe(bullet);
  });

  it("returns an empty string for anything that is not text", () => {
    expect(redactContactDetails(undefined)).toBe("");
    expect(redactContactDetails(null)).toBe("");
    expect(redactContactDetails(42)).toBe("");
  });
});

describe("scrubErrorEvent", () => {
  it("removes the request body, cookies and query string", () => {
    const event = {
      request: {
        url: "https://api.example.com/api/github/callback?code=abc123&state=xyz",
        method: "POST",
        data: { resumeText: "Jordan Rivera jordan@example.com", code: "RECOVERY-CODE" },
        cookies: { session: "secret" },
        query_string: "code=abc123&state=xyz",
        headers: { "content-type": "application/json" },
      },
    };
    const out = scrubErrorEvent(event);
    expect(out.request.data).toBeUndefined();
    expect(out.request.cookies).toBeUndefined();
    expect(out.request.query_string).toBeUndefined();
    expect(out.request.url).toBe("https://api.example.com/api/github/callback");
    expect(out.request.method).toBe("POST");
    expect(JSON.stringify(out)).not.toContain("jordan@example.com");
    expect(JSON.stringify(out)).not.toContain("abc123");
  });

  it("drops credential headers and keeps harmless ones", () => {
    const event = {
      request: {
        headers: {
          Authorization: "Bearer token",
          cookie: "a=b",
          "X-Cron-Secret": "s3cret",
          "stripe-signature": "sig",
          "user-agent": "Mozilla",
        },
      },
    };
    const out = scrubErrorEvent(event);
    expect(out.request.headers).toEqual({ "user-agent": "Mozilla" });
  });

  it("keeps only the id of the user", () => {
    const out = scrubErrorEvent({ user: { id: "u1", email: "jordan@example.com", ip_address: "1.2.3.4" } });
    expect(out.user).toEqual({ id: "u1" });
  });

  it("copes with events that have no request", () => {
    expect(scrubErrorEvent({ message: "boom" })).toEqual({ message: "boom" });
    expect(scrubErrorEvent(null)).toBeNull();
  });
});

describe("sanitizeTrackMetadata", () => {
  it("keeps short flat values", () => {
    expect(sanitizeTrackMetadata({ example: true, length: 412, where: "banner" })).toEqual({
      example: true,
      length: 412,
      where: "banner",
    });
  });

  it("drops nested objects, arrays and odd keys", () => {
    expect(
      sanitizeTrackMetadata({ ok: 1, nested: { resume: "text" }, list: [1, 2], "bad key!": "x", n: Number.NaN }),
    ).toEqual({ ok: 1 });
  });

  it("cuts long strings so free text cannot be stored", () => {
    const out = sanitizeTrackMetadata({ note: "a".repeat(5000) });
    expect(out.note).toHaveLength(100);
  });

  it("keeps the visitor id for anonymous events and drops it for signed-in ones", () => {
    expect(sanitizeTrackMetadata({ vid: "abc", where: "gate" })).toEqual({ vid: "abc", where: "gate" });
    expect(sanitizeTrackMetadata({ vid: "abc", where: "gate" }, { signedIn: true })).toEqual({ where: "gate" });
    expect(sanitizeTrackMetadata({ vid: "abc" }, { signedIn: true })).toBeNull();
  });

  it("keeps at most ten values", () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(sanitizeTrackMetadata(many))).toHaveLength(10);
  });

  it("returns null for anything that is not an object", () => {
    expect(sanitizeTrackMetadata(null)).toBeNull();
    expect(sanitizeTrackMetadata("text")).toBeNull();
    expect(sanitizeTrackMetadata([1, 2])).toBeNull();
    expect(sanitizeTrackMetadata({})).toBeNull();
  });
});
