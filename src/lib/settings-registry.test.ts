import { describe, expect, it } from "vitest";
import { SETTINGS, checkValue, crossCheck, defaults, merge } from "./settings-registry";

describe("settings registry", () => {
  it("has unique keys and defaults inside their own bounds", () => {
    expect(new Set(SETTINGS.map((s) => s.key)).size).toBe(SETTINGS.length);
    for (const s of SETTINGS) expect(checkValue(s.key, s.default).ok, s.key).toBe(true);
  });
  it("defaults pass the cross checks", () => expect(crossCheck(defaults())).toBeNull());
  it("rejects bad values", () => {
    expect(checkValue("boost.maxDays", 0).ok).toBe(false);
    expect(checkValue("boost.maxDays", 1.5).ok).toBe(false);
    expect(checkValue("boost.maxDays", "7").ok).toBe(false);
    expect(checkValue("ai.enabled", 1).ok).toBe(false);
    expect(checkValue("nope", 1).ok).toBe(false);
  });
  it("ignores invalid stored values and keeps defaults", () => {
    const m = merge({ "premium.slots": 25, "premium.priceKes": -5, "ai.enabled": false, bogus: 1 });
    expect(m["premium.slots"]).toBe(25);
    expect(m["premium.priceKes"]).toBe(15000);
    expect(m["ai.enabled"]).toBe(false);
    expect("bogus" in m).toBe(false);
  });
  it("catches limits that contradict each other", () => {
    expect(crossCheck({ ...defaults(), "ai.userLimit": 100 })).toMatch(/AI limits/);
    expect(crossCheck({ ...defaults(), "boost.defaultDays": 400 })).toMatch(/default boost/);
  });
});
