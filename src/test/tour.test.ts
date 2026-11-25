import { describe, expect, it } from "vitest";
import { dismiss, fresh, next, pause, shouldPrompt, snooze, start, resume } from "@/lib/tour";

const DAY = 86_400_000;
describe("tour state", () => {
  it("prompts new people only", () => {
    expect(shouldPrompt(fresh(), 0)).toBe(true);
    expect(shouldPrompt(dismiss(fresh()), 0)).toBe(false);
  });
  it("snooze escalates 1,1,3,7 then stops", () => {
    let s = fresh(), t = 1000;
    const waits: number[] = [];
    for (let i = 0; i < 4; i++) { s = snooze(s, t); waits.push((s.until - t) / DAY); expect(shouldPrompt(s, t)).toBe(false); t = s.until; expect(shouldPrompt(s, t)).toBe(true); }
    expect(waits).toEqual([1, 1, 3, 7]);
    expect(snooze(s, t).status).toBe("dismissed");
  });
  it("pause keeps the step, start from new begins at 0", () => {
    let s = start(fresh());
    s = next(s, 5); s = next(s, 5);
    s = pause(s);
    expect(s.step).toBe(2);
    expect(start(s).step).toBe(2);
    expect(resume(s).status).toBe("running");
  });
  it("finishes after the last step", () => {
    expect(next({ ...fresh(), status: "running", step: 4 }, 5).status).toBe("done");
  });
});
