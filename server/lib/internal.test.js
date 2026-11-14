import { describe, expect, it } from "vitest";
import {
  createInternalResolver,
  dropInternalBrowsers,
  dropInternalUsers,
  isValidVisitorId,
  matchInternalUserIds,
  parseEmailList,
} from "./internal";

describe("parseEmailList", () => {
  it("merges lists, trims, lower-cases and removes duplicates", () => {
    const set = parseEmailList(" Me@Example.com , other@example.com", "me@example.com,third@example.com ,");
    expect([...set].sort()).toEqual(["me@example.com", "other@example.com", "third@example.com"]);
  });

  it("ignores missing values", () => {
    expect(parseEmailList(undefined, null, "").size).toBe(0);
  });
});

describe("matchInternalUserIds", () => {
  const users = [
    { id: "a", email: "Owner@Example.com" },
    { id: "b", email: "student@example.com" },
    { id: "c", email: null },
    null,
  ];

  it("matches by email regardless of case", () => {
    expect([...matchInternalUserIds(users, parseEmailList("owner@example.com"))]).toEqual(["a"]);
  });

  it("matches nobody when the list is empty (fails safe: nothing is hidden)", () => {
    expect(matchInternalUserIds(users, new Set()).size).toBe(0);
  });

  it("never matches part of an address", () => {
    expect(matchInternalUserIds(users, parseEmailList("example.com")).size).toBe(0);
  });
});

describe("dropInternalUsers", () => {
  const rows = [{ user_id: "a", n: 1 }, { user_id: "b", n: 2 }, { user_id: null, n: 3 }, { n: 4 }];

  it("removes rows of internal users and keeps anonymous ones", () => {
    expect(dropInternalUsers(rows, new Set(["a"])).map((r) => r.n)).toEqual([2, 3, 4]);
  });

  it("returns every row when nobody is internal", () => {
    expect(dropInternalUsers(rows, new Set())).toHaveLength(4);
  });

  it("can use a different column", () => {
    expect(dropInternalUsers([{ id: "a" }, { id: "b" }], new Set(["a"]), "id")).toEqual([{ id: "b" }]);
  });
});

describe("dropInternalBrowsers", () => {
  const rows = [
    { metadata: { vid: "mine-1234" } },
    { metadata: { vid: "stranger-1" } },
    { metadata: null },
    { metadata: { example: true } },
  ];

  it("removes events from marked browsers only", () => {
    expect(dropInternalBrowsers(rows, new Set(["mine-1234"]))).toHaveLength(3);
  });

  it("keeps everything when no browser is marked", () => {
    expect(dropInternalBrowsers(rows, new Set())).toHaveLength(4);
  });
});

describe("isValidVisitorId", () => {
  it("accepts the ids the app generates and rejects anything else", () => {
    expect(isValidVisitorId("3f2b8c1e-9d4a-4c1b-8e7f-0a1b2c3d4e5f")).toBe(true);
    expect(isValidVisitorId("k3j2h1g0f9e8")).toBe(true);
    expect(isValidVisitorId("short")).toBe(false);
    expect(isValidVisitorId("has spaces in it")).toBe(false);
    expect(isValidVisitorId("<script>alert(1)</script>")).toBe(false);
    expect(isValidVisitorId(undefined)).toBe(false);
  });
});

/** A fake of the two Supabase calls the resolver makes, counting how often each runs. */
function fakeSupabase({ users, marks }) {
  const calls = { listUsers: 0, marks: 0 };
  return {
    calls,
    auth: {
      admin: {
        listUsers: async () => {
          calls.listUsers += 1;
          return { data: { users }, error: null };
        },
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: async () => {
            calls.marks += 1;
            return { data: marks, error: null };
          },
        }),
      }),
    }),
  };
}

describe("createInternalResolver", () => {
  const users = [
    { id: "owner", email: "owner@example.com" },
    { id: "test", email: "tester@example.com" },
    { id: "real", email: "student@example.com" },
  ];
  const marks = [{ metadata: { vid: "my-browser-1" } }, { metadata: { vid: "bad id" } }, { metadata: null }];

  it("finds internal accounts from both lists and the marked browsers", async () => {
    const db = fakeSupabase({ users, marks });
    const resolver = createInternalResolver({
      supabaseAdmin: db,
      getEmailLists: () => ["owner@example.com", "tester@example.com"],
    });
    const { userIds, vids } = await resolver.get();
    expect([...userIds].sort()).toEqual(["owner", "test"]);
    expect([...vids]).toEqual(["my-browser-1"]);
  });

  it("remembers the answer for the cache time, then asks again", async () => {
    const db = fakeSupabase({ users, marks });
    let t = 0;
    const resolver = createInternalResolver({
      supabaseAdmin: db,
      getEmailLists: () => ["owner@example.com"],
      ttlMs: 1000,
      now: () => t,
    });
    await Promise.all([resolver.get(), resolver.get(), resolver.get()]);
    expect(db.calls.listUsers).toBe(1);
    t = 500;
    await resolver.get();
    expect(db.calls.listUsers).toBe(1);
    t = 2000;
    await resolver.get();
    expect(db.calls.listUsers).toBe(2);
  });

  it("asks again straight after clear()", async () => {
    const db = fakeSupabase({ users, marks });
    const resolver = createInternalResolver({ supabaseAdmin: db, getEmailLists: () => ["owner@example.com"] });
    await resolver.get();
    resolver.clear();
    await resolver.get();
    expect(db.calls.marks).toBe(2);
  });

  it("hides nothing when no addresses are configured and no browser is marked", async () => {
    const db = fakeSupabase({ users, marks: [] });
    const resolver = createInternalResolver({ supabaseAdmin: db, getEmailLists: () => [undefined, ""] });
    const { userIds, vids } = await resolver.get();
    expect(userIds.size).toBe(0);
    expect(vids.size).toBe(0);
    expect(db.calls.listUsers).toBe(0);
  });

  it("returns empty sets when the database is not configured", async () => {
    const resolver = createInternalResolver({ supabaseAdmin: null, getEmailLists: () => ["owner@example.com"] });
    const { userIds, vids } = await resolver.get();
    expect(userIds.size + vids.size).toBe(0);
  });

  it("does not cache a failure", async () => {
    let fail = true;
    const db = {
      auth: {
        admin: {
          listUsers: async () => (fail ? { data: null, error: new Error("down") } : { data: { users }, error: null }),
        },
      },
      from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
    };
    const resolver = createInternalResolver({ supabaseAdmin: db, getEmailLists: () => ["owner@example.com"] });
    await expect(resolver.get()).rejects.toThrow("down");
    fail = false;
    const { userIds } = await resolver.get();
    expect([...userIds]).toEqual(["owner"]);
  });
});
