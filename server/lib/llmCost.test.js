import { describe, expect, it } from "vitest";
import { addUsage, createUsageAccumulator, estimateCostUsd, usageMetadata } from "./llmCost.js";

const PRICES = { inputUsdPerM: 0.15, outputUsdPerM: 0.75 };

describe("llmCost", () => {
  it("prices input and output tokens separately", () => {
    // 1M input + 1M output = 0.15 + 0.75
    expect(estimateCostUsd(1_000_000, 1_000_000, PRICES)).toBeCloseTo(0.9, 6);
    expect(estimateCostUsd(2000, 500, PRICES)).toBeCloseTo(0.000675, 6);
    expect(estimateCostUsd(0, 0, PRICES)).toBe(0);
  });

  it("accumulates usage across several LLM calls in one request", () => {
    const acc = createUsageAccumulator();
    addUsage(acc, { prompt_tokens: 1000, completion_tokens: 200 });
    addUsage(acc, { prompt_tokens: 500, completion_tokens: 100 });
    const meta = usageMetadata(acc, PRICES);
    expect(meta).toMatchObject({ llmCalls: 2, promptTokens: 1500, completionTokens: 300, totalTokens: 1800 });
    expect(meta.estCostUsd).toBeCloseTo(0.00045, 6);
  });

  it("ignores missing usage and yields no metadata when nothing was recorded", () => {
    const acc = createUsageAccumulator();
    addUsage(acc, undefined);
    addUsage(undefined, { prompt_tokens: 5 });
    expect(usageMetadata(acc, PRICES)).toEqual({});
  });

  it("never records content — only counts and cost", () => {
    const acc = createUsageAccumulator();
    addUsage(acc, { prompt_tokens: 10, completion_tokens: 5, extra: "resume text" });
    expect(Object.keys(usageMetadata(acc, PRICES)).sort()).toEqual(
      ["completionTokens", "estCostUsd", "llmCalls", "promptTokens", "totalTokens"],
    );
  });
});
