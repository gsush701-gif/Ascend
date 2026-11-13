import { describe, expect, it } from "vitest";
import { claimPersonalData, clearPersonalData } from "./localData";

/** A minimal in-memory stand-in for localStorage. */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const LEFT_BY_SOMEONE = {
  internos_resume_lab_history_v1: '[{"input":"Built a chat app for my team"}]',
  internos_alignment_history_v1: '[{"alignment":72}]',
  internos_last_resume_v1: "Jordan_Rivera_Resume.pdf",
  "ascend.advisor.plan": '{"userId":"a","plan":{}}',
  "ascend.advisor.dismissed": '{"ids":["x"]}',
  "ascend.kairos.thread.user-a": '[{"role":"user","text":"Should I apply to Stripe?"}]',
  "ascend.kairos.thread.user-b": "[]",
};

describe("clearPersonalData", () => {
  it("removes every personal key, including one per account", () => {
    const storage = fakeStorage({ ...LEFT_BY_SOMEONE, "ascend.owner": "user-a" });
    clearPersonalData(storage);
    expect([...storage.map.keys()]).toEqual([]);
  });

  it("keeps display choices and the sign-in session", () => {
    const storage = fakeStorage({
      ...LEFT_BY_SOMEONE,
      internos_roles_sort: "deadline:asc",
      internos_checklist_dismissed_v1: "true",
      "ascend.vid": "visitor-1",
      "sb-project-auth-token": "{}",
    });
    clearPersonalData(storage);
    expect([...storage.map.keys()].sort()).toEqual([
      "ascend.vid",
      "internos_checklist_dismissed_v1",
      "internos_roles_sort",
      "sb-project-auth-token",
    ]);
  });

  it("does nothing when storage is not available", () => {
    expect(() => clearPersonalData(null)).not.toThrow();
  });

  it("does not throw when storage itself throws", () => {
    const broken = {
      length: 1,
      key: () => {
        throw new Error("blocked");
      },
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => clearPersonalData(broken)).not.toThrow();
  });
});

describe("claimPersonalData", () => {
  it("clears what a different account left behind, then records the new owner", () => {
    const storage = fakeStorage({ ...LEFT_BY_SOMEONE, "ascend.owner": "user-a" });
    expect(claimPersonalData("user-b", storage)).toBe(true);
    expect(storage.getItem("internos_resume_lab_history_v1")).toBeNull();
    expect(storage.getItem("internos_last_resume_v1")).toBeNull();
    expect(storage.getItem("ascend.kairos.thread.user-a")).toBeNull();
    expect(storage.getItem("ascend.owner")).toBe("user-b");
  });

  it("clears what an anonymous visitor left before anyone signed in", () => {
    const storage = fakeStorage({ internos_last_resume_v1: "Someone_Else.pdf" });
    expect(claimPersonalData("user-b", storage)).toBe(true);
    expect(storage.getItem("internos_last_resume_v1")).toBeNull();
  });

  it("keeps everything when the same person comes back", () => {
    const storage = fakeStorage({ ...LEFT_BY_SOMEONE, "ascend.owner": "user-a" });
    expect(claimPersonalData("user-a", storage)).toBe(false);
    expect(storage.getItem("internos_resume_lab_history_v1")).toBe(LEFT_BY_SOMEONE.internos_resume_lab_history_v1);
    expect(storage.getItem("ascend.kairos.thread.user-a")).toBe(LEFT_BY_SOMEONE["ascend.kairos.thread.user-a"]);
  });

  it("returns false when storage is not available", () => {
    expect(claimPersonalData("user-a", null)).toBe(false);
  });
});
