import { describe, expect, it } from "vitest";
import { criteriaChips, diffChips, hasFilters } from "./criteria-chips";

describe("criteria chips", () => {
  it("describes filters in words", () => {
    const l = criteriaChips({ bedroomsMin: 4, bathroomsMin: 4, features: ["balcony"] as never, countyCodes: [47] }).map((c) => c.label);
    expect(l).toEqual(expect.arrayContaining(["Nairobi", "4+ bedrooms", "4+ bathrooms"]));
  });
  it("reports what a follow-up added, changed and removed", () => {
    const before = criteriaChips({ countyCodes: [22], bedroomsMin: 4, features: ["balcony"] as never });
    const after = criteriaChips({ countyCodes: [47], bedroomsMin: 4, bathroomsMin: 4 });
    const d = diffChips(before, after).map((c) => `${c.kind}:${c.chip.key}`);
    expect(d).toEqual(expect.arrayContaining(["changed:countyCodes", "added:bathroomsMin", "removed:feature:balcony"]));
    expect(d.some((x) => x.includes("bedroomsMin"))).toBe(false);
  });
  it("knows when nothing is filtered", () => { expect(hasFilters({})).toBe(false); expect(hasFilters({ priceMax: 5 })).toBe(true); });
});
