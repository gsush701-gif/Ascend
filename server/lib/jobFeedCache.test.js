import { describe, it, expect } from "vitest";
import { createJobFeedCache } from "./jobFeedCache.js";
import { createJobSyncRunner } from "./jobBoards/sync.js";

function counter(results) {
  let calls = 0;
  const fetchRows = async () => {
    calls += 1;
    const next = results[Math.min(calls - 1, results.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetchRows, calls: () => calls };
}

describe("createJobFeedCache", () => {
  it("reads once and reuses the copy until it expires", async () => {
    let t = 0;
    const c = counter([["a"], ["b"]]);
    const cache = createJobFeedCache({ fetchRows: c.fetchRows, ttlMs: 1000, now: () => t });
    expect(await cache.get()).toEqual(["a"]);
    t = 999;
    expect(await cache.get()).toEqual(["a"]);
    expect(c.calls()).toBe(1);
    t = 1001;
    expect(await cache.get()).toEqual(["b"]);
    expect(c.calls()).toBe(2);
  });

  it("lets simultaneous requests share one read", async () => {
    const c = counter([["a"]]);
    const cache = createJobFeedCache({ fetchRows: c.fetchRows });
    const [x, y, z] = await Promise.all([cache.get(), cache.get(), cache.get()]);
    expect(x).toBe(y);
    expect(y).toBe(z);
    expect(c.calls()).toBe(1);
  });

  it("serves the older copy when a refresh fails, and throws only when there is none", async () => {
    let t = 0;
    const c = counter([["a"], new Error("db down")]);
    const cache = createJobFeedCache({ fetchRows: c.fetchRows, ttlMs: 10, now: () => t });
    expect(await cache.get()).toEqual(["a"]);
    t = 50;
    expect(await cache.get()).toEqual(["a"]); // refresh failed, stale copy served

    const empty = createJobFeedCache({ fetchRows: counter([new Error("db down")]).fetchRows });
    await expect(empty.get()).rejects.toThrow("db down");
  });

  it("forgets the copy when cleared", async () => {
    const c = counter([["a"], ["b"]]);
    const cache = createJobFeedCache({ fetchRows: c.fetchRows });
    expect(await cache.get()).toEqual(["a"]);
    cache.clear();
    expect(await cache.get()).toEqual(["b"]);
  });

  it("recovers after a failed first read", async () => {
    const c = counter([new Error("boom"), ["ok"]]);
    const cache = createJobFeedCache({ fetchRows: c.fetchRows });
    await expect(cache.get()).rejects.toThrow("boom");
    expect(await cache.get()).toEqual(["ok"]);
  });
});

describe("job sync runner", () => {
  it("calls onFinish when a run ends, so the feed cache can be cleared", async () => {
    let finished = 0;
    const store = {
      loadKnown: async () => new Map(),
      upsertJobs: async () => {},
      touchSeen: async () => {},
      deactivateMissing: async () => 0,
      deactivateRemovedBoards: async () => 0,
    };
    const runner = createJobSyncRunner({
      store,
      boards: [],
      fetchJson: async () => ({}),
      log: { log() {}, error() {} },
      onFinish: () => {
        finished += 1;
      },
    });
    expect(runner.start()).toBe(true);
    expect(runner.start()).toBe(false); // already running
    for (let i = 0; i < 50 && runner.isRunning(); i += 1) await new Promise((r) => setTimeout(r, 5));
    expect(runner.isRunning()).toBe(false);
    expect(finished).toBe(1);
    expect(runner.lastRun().error).toBeNull();
  });
});
