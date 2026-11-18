import { describe, expect, it } from "vitest";
import { formatCountdown, limitFor, quotaState } from "./ai-quota";

const v = { "ai.guestLimit": 3, "ai.userLimit": 10, "ai.agencyLimit": 40, "ai.premiumLimit": 120 };
const now = new Date("2026-06-01T12:00:00Z").getTime();

describe("quota", () => {
  it("picks the limit by tier", () => {
    expect([limitFor("guest", v), limitFor("user", v), limitFor("agency", v), limitFor("premium", v)]).toEqual([3, 10, 40, 120]);
  });
  it("starts full", () => {
    expect(quotaState(null, 10, 24, now)).toEqual({ limit: 10, used: 0, remaining: 10, resetsAt: null });
  });
  it("counts inside the window and says when it restarts", () => {
    const s = quotaState({ windowStart: new Date(now - 3_600_000), count: 4 }, 10, 24, now);
    expect(s.remaining).toBe(6);
    expect(s.resetsAt?.getTime()).toBe(now + 23 * 3_600_000);
  });
  it("gives everything back after the window", () => {
    expect(quotaState({ windowStart: new Date(now - 25 * 3_600_000), count: 10 }, 10, 24, now).remaining).toBe(10);
  });
  it("never goes negative when the limit was lowered", () => {
    expect(quotaState({ windowStart: new Date(now), count: 12 }, 10, 24, now).remaining).toBe(0);
  });
  it("formats a countdown", () => {
    expect(formatCountdown(2 * 3_600_000 + 5 * 60_000 + 7000)).toBe("2h 05m 07s");
    expect(formatCountdown(14 * 60_000 + 3000)).toBe("14m 03s");
    expect(formatCountdown(-5)).toBe("0m 00s");
  });
});
