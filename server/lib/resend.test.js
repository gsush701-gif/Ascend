import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("sendWeeklyReportEmail — graceful no-op when RESEND_API_KEY is absent", () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("reports isResendConfigured as false and skips sending without throwing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { sendWeeklyReportEmail, isResendConfigured } = await import("./resend.js");
    expect(isResendConfigured).toBe(false);

    const result = await sendWeeklyReportEmail({
      to: "user@example.com",
      subject: "Test",
      html: "<p>hi</p>",
      text: "hi",
    });
    expect(result).toEqual({ sent: false, skipped: true, reason: "RESEND_API_KEY not configured" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips cleanly when there is no recipient, even if configured", async () => {
    process.env.RESEND_API_KEY = "test-key";
    const { sendWeeklyReportEmail } = await import("./resend.js");
    const result = await sendWeeklyReportEmail({ to: "", subject: "x", html: "x", text: "x" });
    expect(result.sent).toBe(false);
    expect(result.skipped).toBe(true);
  });
});

describe("sendWeeklyReportEmail — configured", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    vi.restoreAllMocks();
  });

  it("posts to the Resend API and reports sent:true on a 200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    const { sendWeeklyReportEmail } = await import("./resend.js");
    const result = await sendWeeklyReportEmail({
      to: "user@example.com",
      subject: "Weekly report",
      html: "<p>hi</p>",
      text: "hi",
    });
    expect(result).toEqual({ sent: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("reports sent:false with an error message on a non-2xx response, never throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 422, text: async () => "bad request" });
    const { sendWeeklyReportEmail } = await import("./resend.js");
    const result = await sendWeeklyReportEmail({
      to: "user@example.com",
      subject: "Weekly report",
      html: "<p>hi</p>",
      text: "hi",
    });
    expect(result.sent).toBe(false);
    expect(result.error).toMatch(/422/);
  });

  it("reports sent:false when fetch itself throws (network failure), never throwing to the caller", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const { sendWeeklyReportEmail } = await import("./resend.js");
    const result = await sendWeeklyReportEmail({
      to: "user@example.com",
      subject: "Weekly report",
      html: "<p>hi</p>",
      text: "hi",
    });
    expect(result).toEqual({ sent: false, error: "network down" });
  });
});
