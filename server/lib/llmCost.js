// Token + cost accounting for LLM calls, so "what does one analysis cost us?"
// has a real answer (admin AI usage table, and pricing decisions like the Pro
// plan's price). Pure helpers — server/lib/groq.js feeds token counts into an
// accumulator, and server/index.js's callGroq() turns it into `usage_events`
// metadata. Tokens and counts only ever: never prompt/response content.

// USD per 1M tokens. Defaults are Groq's published price for the default
// model (openai/gpt-oss-120b) at the time of writing — verify against
// console.groq.com/docs/models and override with GROQ_INPUT_USD_PER_M /
// GROQ_OUTPUT_USD_PER_M if you change GROQ_MODEL or prices change. Token
// counts are exact (reported by the API); the dollar figure is an estimate
// only as accurate as these two numbers.
function priceFromEnv(name, fallback) {
  const n = Number(process.env[name]);
  return process.env[name] !== undefined && process.env[name].trim() !== "" && Number.isFinite(n) && n >= 0
    ? n
    : fallback;
}

function getGroqPrices() {
  return {
    inputUsdPerM: priceFromEnv("GROQ_INPUT_USD_PER_M", 0.15),
    outputUsdPerM: priceFromEnv("GROQ_OUTPUT_USD_PER_M", 0.75),
  };
}

/** Estimated USD cost of one request's tokens, rounded to 1e-6 dollars. */
function estimateCostUsd(promptTokens, completionTokens, prices = getGroqPrices()) {
  const cost =
    ((promptTokens || 0) * prices.inputUsdPerM + (completionTokens || 0) * prices.outputUsdPerM) / 1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}

/** Mutable per-request tally; a route can make more than one LLM call. */
function createUsageAccumulator() {
  return { llmCalls: 0, promptTokens: 0, completionTokens: 0 };
}

/** Adds one completion's `usage` object ({ prompt_tokens, completion_tokens }). */
function addUsage(acc, usage) {
  if (!acc || !usage) return;
  acc.llmCalls += 1;
  acc.promptTokens += Number(usage.prompt_tokens) || 0;
  acc.completionTokens += Number(usage.completion_tokens) || 0;
}

/**
 * Fields to merge into a usage_events row's `metadata`, or `{}` when no LLM
 * call reported usage (e.g. the call failed before a response, or the route
 * short-circuited) — so "no tokens recorded" stays distinguishable from zero.
 */
function usageMetadata(acc, prices = getGroqPrices()) {
  if (!acc || acc.llmCalls === 0) return {};
  return {
    llmCalls: acc.llmCalls,
    promptTokens: acc.promptTokens,
    completionTokens: acc.completionTokens,
    totalTokens: acc.promptTokens + acc.completionTokens,
    estCostUsd: estimateCostUsd(acc.promptTokens, acc.completionTokens, prices),
  };
}

module.exports = {
  getGroqPrices,
  estimateCostUsd,
  createUsageAccumulator,
  addUsage,
  usageMetadata,
};
