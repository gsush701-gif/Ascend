import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { hasVoiceInterviewAccess, requireVoiceInterviewAccess } = require("./requireVoiceInterviewAccess");

function run(user) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  requireVoiceInterviewAccess({ user, requestId: "r1" }, res, next);
  return { res, next };
}

describe("voice interview access lock", () => {
  afterEach(() => {
    delete process.env.VOICE_INTERVIEW_EMAILS;
  });

  it("denies everyone when VOICE_INTERVIEW_EMAILS is unset (fail closed)", () => {
    expect(hasVoiceInterviewAccess("owner@example.com")).toBe(false);
  });

  it("allows an allowlisted email, case-insensitively", () => {
    process.env.VOICE_INTERVIEW_EMAILS = "Owner@Example.com";
    expect(hasVoiceInterviewAccess("owner@example.com")).toBe(true);
    expect(hasVoiceInterviewAccess("other@example.com")).toBe(false);
  });

  it("401s with no user and never calls next", () => {
    const { res, next } = run(undefined);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("403s a logged-in user who is not allowlisted", () => {
    process.env.VOICE_INTERVIEW_EMAILS = "owner@example.com";
    const { res, next } = run({ id: "u1", email: "other@example.com" });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next for an allowlisted user", () => {
    process.env.VOICE_INTERVIEW_EMAILS = "owner@example.com";
    const { res, next } = run({ id: "u1", email: "owner@example.com" });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
