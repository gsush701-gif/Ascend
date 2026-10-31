import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// getUserPlanKey is the one DB-touching dependency; stub it on the real
// module object before the middleware (which destructures it) is loaded.
const usage = require("../lib/usage");
const getUserPlanKey = vi.fn();
usage.getUserPlanKey = getUserPlanKey;
const { userHasPlanFeature, requirePlanFeature } = require("./requirePlanFeature");

function run(user) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  const done = requirePlanFeature("voiceInterview", "Voice interview")({ user, requestId: "r1" }, res, next);
  return { res, next, done };
}

describe("voice interview paywall", () => {
  beforeEach(() => getUserPlanKey.mockReset());

  it("gives free users no voice interview, pro users yes", async () => {
    getUserPlanKey.mockResolvedValue("free");
    expect(await userHasPlanFeature("u1", "voiceInterview")).toBe(false);
    getUserPlanKey.mockResolvedValue("pro");
    expect(await userHasPlanFeature("u1", "voiceInterview")).toBe(true);
  });

  it("denies an unknown plan and an unknown feature (fail closed)", async () => {
    getUserPlanKey.mockResolvedValue("enterprise-typo");
    expect(await userHasPlanFeature("u1", "voiceInterview")).toBe(false);
    getUserPlanKey.mockResolvedValue("pro");
    expect(await userHasPlanFeature("u1", "doesNotExist")).toBe(false);
  });

  it("401s with no user and never looks up a plan", async () => {
    const { res, next, done } = run(undefined);
    await done;
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(getUserPlanKey).not.toHaveBeenCalled();
  });

  it("403s a free user and never calls next", async () => {
    getUserPlanKey.mockResolvedValue("free");
    const { res, next, done } = run({ id: "u1" });
    await done;
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next for a pro user", async () => {
    getUserPlanKey.mockResolvedValue("pro");
    const { res, next, done } = run({ id: "u1" });
    await done;
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });
});
