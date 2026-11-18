import { describe, expect, it } from "vitest";
import { isTransient, retry, waitFor } from "@/lib/retry";

const instant = { sleep: async () => {} };
describe("retry", () => {
  it("retries a transient failure and then succeeds", async () => {
    let n = 0;
    const r = await retry(async () => { if (++n < 3) throw new TypeError("Failed to fetch"); return "ok"; }, instant);
    expect(r).toBe("ok"); expect(n).toBe(3);
  });
  it("gives up after the last try with the last error", async () => {
    let n = 0;
    await expect(retry(async () => { n++; throw new TypeError("x"); }, { ...instant, tries: 2 })).rejects.toThrow("x");
    expect(n).toBe(2);
  });
  it("does not retry a refusal", async () => {
    let n = 0;
    await expect(retry(async () => { n++; throw Object.assign(new Error("bad file"), { status: 400 }); }, instant)).rejects.toThrow("bad file");
    expect(n).toBe(1);
  });
  it("classifies errors", () => {
    expect(isTransient(Object.assign(new Error(), { status: 503 }))).toBe(true);
    expect(isTransient(Object.assign(new Error(), { status: 429 }))).toBe(true);
    expect(isTransient(Object.assign(new Error(), { status: 403 }))).toBe(false);
    expect(isTransient(new Error("Photos must be at least 640"))).toBe(false);
  });
  it("waits longer each time but never past the cap", () => {
    const mid = () => 0.5;
    expect(waitFor(0, 600, 6000, mid)).toBe(600);
    expect(waitFor(1, 600, 6000, mid)).toBe(1200);
    expect(waitFor(9, 600, 6000, mid)).toBe(6000);
  });
});
