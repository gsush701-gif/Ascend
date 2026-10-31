import { describe, expect, it } from "vitest";
import { PLANS, USAGE_LABELS, getPlan } from "./plans.js";

describe("plan config", () => {
  it("caps Pro voice interview starts per month and gives free no voice interview at all", () => {
    expect(PLANS.pro.limits["ai.interview_start"]).toBeGreaterThan(0);
    expect(PLANS.pro.features.voiceInterview).toBe(true);
    expect(PLANS.free.features.voiceInterview).toBe(false);
    expect(PLANS.free.limits["ai.interview_start"]).toBeUndefined();
  });

  it("keeps the per-interview cap tighter than the playback backstop", () => {
    // ~10 spoken lines per interview: the start cap must bind first.
    const linesPerInterview = 10;
    expect(PLANS.pro.limits["ai.interview_start"] * linesPerInterview).toBeLessThanOrEqual(
      PLANS.pro.limits["ai.interview_tts"],
    );
  });

  it("labels every limited event type, so the plan panel never shows a raw key", () => {
    for (const plan of Object.values(PLANS)) {
      for (const key of Object.keys(plan.limits)) {
        expect(USAGE_LABELS[key], key).toBeTruthy();
      }
    }
  });

  it("falls back to free for an unknown plan key", () => {
    expect(getPlan("nope")).toBe(PLANS.free);
  });
});
