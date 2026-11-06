import { describe, it, expect } from "vitest";
import { parseFeedback } from "./feedback.js";

describe("parseFeedback", () => {
  it("accepts a message and trims it", () => {
    const r = parseFeedback({ message: "  The score confused me  " });
    expect(r).toEqual({ ok: true, value: { message: "The score confused me", email: null, page: null } });
  });

  it("rejects an empty, too-short, non-string or oversized message", () => {
    expect(parseFeedback({ message: "  " }).ok).toBe(false);
    expect(parseFeedback({ message: "hi" }).ok).toBe(false);
    expect(parseFeedback({ message: 42 }).ok).toBe(false);
    expect(parseFeedback(undefined).ok).toBe(false);
    expect(parseFeedback({ message: "x".repeat(2001) }).ok).toBe(false);
    expect(parseFeedback({ message: "x".repeat(2000) }).ok).toBe(true);
  });

  it("treats the email as optional but rejects a malformed one", () => {
    expect(parseFeedback({ message: "good tool", email: "" }).value.email).toBeNull();
    expect(parseFeedback({ message: "good tool", email: "a@b.co" }).value.email).toBe("a@b.co");
    expect(parseFeedback({ message: "good tool", email: "not-an-email" }).ok).toBe(false);
  });

  it("keeps only the path of the page, never a query string", () => {
    expect(parseFeedback({ message: "good tool", page: "/try?token=abc#x" }).value.page).toBe("/try");
    expect(parseFeedback({ message: "good tool", page: "https://evil.example" }).value.page).toBeNull();
  });
});
