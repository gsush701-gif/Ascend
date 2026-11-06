// The daily job-feed sync: for each company board, read its public listing,
// keep the internship and new-grad postings, save them into the `jobs` table,
// and mark postings that have disappeared from a board as closed.
//
// Everything outside this file is injected (`fetchJson`, `store`), so the logic
// is tested without a network or a database (sync.test.js).
//
// Safety rules:
//   - A board that fails to load is skipped entirely and nothing is closed for
//     it, so a flaky response never makes real listings vanish.
//   - Postings are only closed when the board returned a non-empty listing.
//   - A Greenhouse posting is only re-downloaded in full when it is new or the
//     company has edited it; unchanged ones are just marked as still seen.

const { ADAPTERS, fetchJson: defaultFetchJson } = require("./feeds");
const defaultBoards = require("../../data/jobBoards.json");

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_POSTING_AGE_DAYS = 365;
const UPSERT_CHUNK = 100;
const DETAIL_CONCURRENCY = 3;
const BOARD_CONCURRENCY = 4;

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Runs `fn` over `items` with at most `limit` in flight; one failure never stops the rest. */
async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function emptyStats(board) {
  return {
    board: board.name,
    ats: board.ats,
    ok: false,
    listed: 0,
    matched: 0,
    tooOld: 0,
    saved: 0,
    unchanged: 0,
    closed: 0,
    error: null,
  };
}

async function syncBoard(board, { fetchJson, store, nowIso }) {
  const stats = emptyStats(board);
  const adapter = ADAPTERS[board.ats];
  if (!adapter) {
    stats.error = `unknown board system "${board.ats}"`;
    return stats;
  }

  let list;
  try {
    list = adapter.parseList(await fetchJson(adapter.listUrl(board.token)));
  } catch (err) {
    stats.error = err && err.message ? err.message : String(err);
    return stats;
  }
  if (!list) {
    stats.error = "unexpected response shape";
    return stats;
  }

  stats.ok = true;
  stats.listed = list.length;
  // Some boards leave postings open for years. Anything posted more than a year
  // ago is treated as stale: not saved, and closed if it was saved before.
  const cutoffMs = Date.parse(nowIso) - MAX_POSTING_AGE_DAYS * DAY_MS;
  const wanted = list.filter((job) => {
    if (!adapter.classify(job)) return false;
    const posted = adapter.postedAt(job);
    if (posted && Date.parse(posted) < cutoffMs) {
      stats.tooOld += 1;
      return false;
    }
    return true;
  });
  stats.matched = wanted.length;

  const known = await store.loadKnown(adapter.source, board.token);
  const toSave = [];
  const unchangedIds = [];

  if (adapter.detailUrl) {
    // Greenhouse: only fetch the full description for new or edited postings.
    const needDetail = [];
    for (const job of wanted) {
      const id = adapter.externalId(board.token, job);
      const version = adapter.version(job, board);
      if (known.has(id) && version && known.get(id) === version) unchangedIds.push(id);
      else needDetail.push(job);
    }
    await pool(needDetail, DETAIL_CONCURRENCY, async (job) => {
      const id = adapter.externalId(board.token, job);
      try {
        const detail = await fetchJson(adapter.detailUrl(board.token, job));
        toSave.push(adapter.toJob(board, job, detail));
      } catch {
        // Keep an already-saved posting open; a brand new one is retried next run.
        if (known.has(id)) unchangedIds.push(id);
      }
    });
  } else {
    for (const job of wanted) toSave.push(adapter.toJob(board, job));
  }

  // A posting listed twice in one response would make the database reject the batch.
  const byId = new Map();
  for (const job of toSave) {
    if (job.title && job.url) byId.set(job.externalId, job);
  }
  const rows = [...byId.values()];

  for (const part of chunk(rows, UPSERT_CHUNK)) {
    await store.upsertJobs(part, nowIso);
    stats.saved += part.length;
  }
  for (const part of chunk(unchangedIds, UPSERT_CHUNK)) {
    await store.touchSeen(adapter.source, board.token, part, nowIso);
    stats.unchanged += part.length;
  }

  if (stats.listed > 0) {
    stats.closed = await store.deactivateMissing(adapter.source, board.token, nowIso);
  }
  return stats;
}

/**
 * @param {object} opts
 * @param {Array<{name: string, ats: string, token: string}>} [opts.boards]
 * @param {(url: string) => Promise<any>} [opts.fetchJson]
 * @param {object} opts.store loadKnown, upsertJobs, touchSeen, deactivateMissing
 * @param {Date} [opts.now]
 * @param {number} [opts.budgetMs] stop starting new boards after this long
 * @param {number} [opts.concurrency]
 */
async function syncBoards({
  boards = defaultBoards,
  fetchJson = defaultFetchJson,
  store,
  now = new Date(),
  budgetMs = 4 * 60 * 1000,
  concurrency = BOARD_CONCURRENCY,
}) {
  const startedAt = Date.now();
  const nowIso = now.toISOString();
  const perBoard = [];
  let incomplete = false;

  await pool(boards, concurrency, async (board) => {
    if (Date.now() - startedAt > budgetMs) {
      incomplete = true;
      return;
    }
    try {
      perBoard.push(await syncBoard(board, { fetchJson, store, nowIso }));
    } catch (err) {
      const s = emptyStats(board);
      s.error = err && err.message ? err.message : String(err);
      perBoard.push(s);
    }
  });

  const sum = (key) => perBoard.reduce((n, b) => n + b[key], 0);
  return {
    startedAt: nowIso,
    durationMs: Date.now() - startedAt,
    boardsTotal: boards.length,
    boardsOk: perBoard.filter((b) => b.ok && !b.error).length,
    boardsFailed: perBoard.filter((b) => b.error).length,
    incomplete,
    listed: sum("listed"),
    matched: sum("matched"),
    tooOld: sum("tooOld"),
    saved: sum("saved"),
    unchanged: sum("unchanged"),
    closed: sum("closed"),
    failures: perBoard.filter((b) => b.error).map((b) => ({ board: b.board, ats: b.ats, error: b.error })),
  };
}

/**
 * Holds the "is a sync running" flag and the last result in memory, so a
 * second trigger cannot start an overlapping run and the admin page can show
 * the last run (it resets when the server restarts; the jobs table is the
 * durable record).
 */
function createJobSyncRunner({ store, boards = defaultBoards, fetchJson = defaultFetchJson, log = console } = {}) {
  let running = false;
  let last = null;
  return {
    isRunning: () => running,
    lastRun: () => last,
    /** Starts a run in the background. Returns false if one is already going. */
    start() {
      if (running) return false;
      running = true;
      syncBoards({ boards, fetchJson, store })
        .then((summary) => {
          last = { ...summary, finishedAt: new Date().toISOString(), error: null };
          log.log(
            `[jobSync] boards ok=${summary.boardsOk}/${summary.boardsTotal} failed=${summary.boardsFailed} ` +
              `listed=${summary.listed} matched=${summary.matched} saved=${summary.saved} ` +
              `unchanged=${summary.unchanged} closed=${summary.closed} ms=${summary.durationMs}`,
          );
        })
        .catch((err) => {
          last = { finishedAt: new Date().toISOString(), error: err && err.message ? err.message : String(err) };
          log.error("[jobSync] failed:", err);
        })
        .finally(() => {
          running = false;
        });
      return true;
    },
  };
}

module.exports = { syncBoards, syncBoard, createJobSyncRunner, pool, chunk };
