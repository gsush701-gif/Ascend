import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createChatJson, isRateLimitError, modelOrder, AiBusyError } = require("./groq");

const ok = (content = '{"ok":true}') => ({
  choices: [{ message: { content } }],
  usage: { prompt_tokens: 100, completion_tokens: 20 },
});
const rateLimited = () => Object.assign(new Error("Rate limit reached for model"), { status: 429 });

/** A fake client whose model-by-model behaviour is scripted. */
function fakeClient(byModel) {
  const calls = [];
  return {
    calls,
    client: {
      chat: {
        completions: {
          create: vi.fn(async ({ model }) => {
            calls.push(model);
            const outcome = byModel[model];
            if (outcome instanceof Error) throw outcome;
            return outcome;
          }),
        },
      },
    },
  };
}

function build(byModel, models = ["main", "backup"]) {
  const fake = fakeClient(byModel);
  const usage = [];
  const chatJson = createChatJson({
    getClient: () => fake.client,
    models,
    recordUsage: (u, meta) => usage.push({ u, meta }),
  });
  return { chatJson, fake, usage };
}

describe("createChatJson fallback", () => {
  it("uses the main model when it works, and never touches the fallback", async () => {
    const { chatJson, fake, usage } = build({ main: ok(), backup: ok() });
    expect(await chatJson("s", "u")).toEqual({ ok: true });
    expect(fake.calls).toEqual(["main"]);
    expect(usage[0].meta.fallback).toBe(false);
  });

  it("moves to the next model when the first is rate-limited, and says it did", async () => {
    const { chatJson, fake, usage } = build({ main: rateLimited(), backup: ok('{"from":"backup"}') });
    expect(await chatJson("s", "u")).toEqual({ from: "backup" });
    expect(fake.calls).toEqual(["main", "backup"]);
    expect(usage).toHaveLength(1);
    expect(usage[0].meta.fallback).toBe(true);
  });

  it("recognises a rate limit from the message too, not just the status code", async () => {
    const byMessage = new Error("Rate limit reached for model openai/gpt-oss-120b: tokens per day (TPD)");
    const { chatJson, fake } = build({ main: byMessage, backup: ok() });
    await chatJson("s", "u");
    expect(fake.calls).toEqual(["main", "backup"]);
  });

  it("throws a student-safe AiBusyError when every model is rate-limited", async () => {
    const { chatJson } = build({ main: rateLimited(), backup: rateLimited() });
    const err = await chatJson("s", "u").catch((e) => e);
    expect(err).toBeInstanceOf(AiBusyError);
    expect(err.statusCode).toBe(503);
    expect(err.message).toMatch(/busy/i);
  });

  it("does NOT fall back on a real failure, so a broken request isn't repeated", async () => {
    const boom = Object.assign(new Error("invalid request body"), { status: 400 });
    const { chatJson, fake } = build({ main: boom, backup: ok() });
    await expect(chatJson("s", "u")).rejects.toThrow(/invalid request body/);
    expect(fake.calls).toEqual(["main"]);
  });

  it("still reports an unusable answer as a failure, not as busy", async () => {
    const { chatJson } = build({ main: ok("not json at all") });
    await expect(chatJson("s", "u")).rejects.toThrow(/malformed JSON/);
    const empty = build({ main: { choices: [{ message: { content: "" } }], usage: {} } });
    await expect(empty.chatJson("s", "u")).rejects.toThrow(/empty response/);
  });

  it("reports 'not configured' when there is no client", async () => {
    const chatJson = createChatJson({ getClient: () => null, models: ["main"], recordUsage: () => {} });
    await expect(chatJson("s", "u")).rejects.toMatchObject({ name: "GroqNotConfiguredError" });
  });
});

describe("helpers", () => {
  it("orders models main first, drops blanks and duplicates, never repeats the main one", () => {
    expect(modelOrder("a", "b, ,a,c,b")).toEqual(["a", "b", "c"]);
    expect(modelOrder("a", "")).toEqual(["a"]);
    expect(modelOrder("a", undefined)).toEqual(["a"]);
  });

  it("tells a rate limit from other errors", () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
    expect(isRateLimitError(new Error("Too many requests"))).toBe(true);
    expect(isRateLimitError({ status: 500, message: "internal error" })).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
  });
});
