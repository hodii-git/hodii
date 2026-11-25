import { describe, expect, it } from "vitest";
import { demandTier, extendedUntil, normalizeMpesaPhone, valueMultiplier } from "./pricing";

import { defaults } from "./settings-registry";
import { boostConfig, quoteBoost, quoteBoostPresets } from "./pricing";
const cfg = boostConfig(defaults());
const nairobiRent = { countyCode: 47, listingType: "rent" as const, category: "residential", amountKes: 45_000 };

describe("boost pricing", () => {
  it("prices busier counties higher", () => {
    expect(demandTier(47)).toBe("high"); expect(demandTier(42)).toBe("mid"); expect(demandTier(5)).toBe("base"); expect(demandTier(null)).toBe("base");
    expect(quoteBoost(nairobiRent, 7, cfg)!.amountKes).toBeGreaterThan(quoteBoost({ ...nairobiRent, countyCode: 5 }, 7, cfg)!.amountKes);
  });
  it("gives longer runs a lower daily price", () => {
    const d7 = quoteBoost(nairobiRent, 7, cfg)!, d14 = quoteBoost(nairobiRent, 14, cfg)!, d30 = quoteBoost(nairobiRent, 30, cfg)!, d90 = quoteBoost(nairobiRent, 90, cfg)!;
    expect(d7.discountPct).toBe(0); expect(d14.perDayKes).toBeLessThan(d7.perDayKes); expect(d30.perDayKes).toBeLessThan(d14.perDayKes); expect(d90.perDayKes).toBeLessThan(d30.perDayKes);
  });
  it("accepts any whole number of days up to the maximum, and nothing else", () => {
    expect(quoteBoost(nairobiRent, 9, cfg)).not.toBeNull(); expect(quoteBoost(nairobiRent, 365, cfg)).not.toBeNull();
    for (const bad of [0, -1, 366, 1.5, NaN]) expect(quoteBoost(nairobiRent, bad, cfg)).toBeNull();
  });
  it("follows the admin settings", () => {
    const pricey = boostConfig({ ...defaults(), "boost.dailyHigh": 120, "boost.maxDays": 30 });
    expect(quoteBoost(nairobiRent, 7, pricey)!.amountKes).toBeGreaterThan(quoteBoost(nairobiRent, 7, cfg)!.amountKes);
    expect(quoteBoost(nairobiRent, 31, pricey)).toBeNull();
    expect(quoteBoostPresets(nairobiRent, pricey).map((q) => q.days)).toEqual([7, 14, 30]);
  });
  it("scales with the value of the listing", () => {
    expect(valueMultiplier({ listingType: "sale", amountKes: 80_000_000 })).toBe(1.5);
    expect(valueMultiplier({ listingType: "rent", amountKes: 9_000 })).toBe(0.8);
  });
  it("rounds to 10 and never goes below the minimum", () => {
    for (const q of quoteBoostPresets(nairobiRent, cfg)) { expect(q.amountKes % 10).toBe(0); expect(q.amountKes).toBeGreaterThanOrEqual(cfg.minPrice); }
    expect(quoteBoost({ countyCode: 5, listingType: "rent", category: "residential", amountKes: 3_000 }, 1, cfg)!.amountKes).toBe(cfg.minPrice);
  });
  it("extends from the end of a current run", () => {
    const now = new Date("2026-01-01T00:00:00Z"), end = new Date("2026-01-10T00:00:00Z");
    expect(extendedUntil(end, 7, now).toISOString()).toBe("2026-01-17T00:00:00.000Z");
    expect(extendedUntil(new Date("2025-01-01"), 7, now).toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(extendedUntil(null, 7, now).toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });
  it("normalises Kenyan phone numbers", () => {
    for (const p of ["0712345678", "+254712345678", "254 712 345 678", "712345678", "0112345678"]) expect(normalizeMpesaPhone(p)).toMatch(/^254[17]\d{8}$/);
    expect(normalizeMpesaPhone("0212345678")).toBeNull(); expect(normalizeMpesaPhone("12345")).toBeNull();
  });
});
