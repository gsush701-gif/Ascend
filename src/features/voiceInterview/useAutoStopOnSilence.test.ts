import { describe, it, expect } from "vitest";
import {
  getAutoStopDelayMs,
  AUTO_STOP_GRACE_MS,
  AUTO_STOP_SILENCE_MS,
} from "./useAutoStopOnSilence";

describe("getAutoStopDelayMs", () => {
  it("uses the longer grace period before any speech has been recognized", () => {
    expect(getAutoStopDelayMs(false)).toBe(AUTO_STOP_GRACE_MS);
  });

  it("uses the shorter trailing-silence period once there is transcript content", () => {
    expect(getAutoStopDelayMs(true)).toBe(AUTO_STOP_SILENCE_MS);
  });

  it("respects custom grace/silence overrides", () => {
    expect(getAutoStopDelayMs(false, 9000, 1000)).toBe(9000);
    expect(getAutoStopDelayMs(true, 9000, 1000)).toBe(1000);
  });
});
