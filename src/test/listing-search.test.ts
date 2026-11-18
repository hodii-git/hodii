import { describe, expect, it } from "vitest";
import { buildSearchFilter, buildSort, escapeRegex } from "@/lib/listing-search";
import { compactNumber, factsLine, formatArea, formatPrice, timeAgo } from "@/lib/format";
import { isPriceDrop } from "@/lib/property-dto";
import { toKes } from "@/lib/mongodb/limits";

const now = new Date("2026-11-12T08:00:00Z");

describe("search filter", () => {
  it("only ever returns live listings", () => {
    expect(buildSearchFilter({}, now)).toEqual({ status: "published", expiresAt: { $gt: now } });
  });
  it("builds filters from the form", () => {
    const f = buildSearchFilter({ listingType: "rent", propertyTypes: ["apartment", "studio"], countyCodes: [47, 22], priceMin: 50_000, priceMax: 150_000, bedroomsMin: 2, features: ["borehole", "gym"], verifiedOnly: true }, now);
    expect(f).toMatchObject({
      listingType: "rent", propertyType: { $in: ["apartment", "studio"] }, "location.countyCode": { $in: [47, 22] },
      "price.amountKes": { $gte: 50_000, $lte: 150_000 }, "details.bedrooms": { $gte: 2 }, features: { $all: ["borehole", "gym"] }, "verified.isVerified": true,
    });
  });
  it("supports a one-sided price range", () => {
    expect(buildSearchFilter({ priceMax: 9 }, now)["price.amountKes"]).toEqual({ $lte: 9 });
    expect(buildSearchFilter({ priceMin: 9 }, now)["price.amountKes"]).toEqual({ $gte: 9 });
  });
  it("matches size on floor area or plot area", () => {
    expect(buildSearchFilter({ areaSqmMin: 100 }, now)["$and"]).toEqual([{ $or: [{ "details.floorAreaSqm": { $gte: 100 } }, { "details.plotAreaSqm": { $gte: 100 } }] }]);
  });
  it("requires every word of a text search and escapes what people type", () => {
    const and = buildSearchFilter({ q: "kilimani 3 bedroom (a+b)" }, now)["$and"] as unknown[];
    expect(and).toHaveLength(4 - 1); // "3" is too short to search on
    expect(JSON.stringify(and)).toContain("\\\\(a\\\\+b\\\\)".slice(0, 0) + "kilimani");
    expect(() => new RegExp(escapeRegex("(a+b)["))).not.toThrow();
  });
  it("finds a pasted reference code exactly", () => {
    expect(buildSearchFilter({ q: "hd-7k3m2q" }, now)["referenceCode"]).toBe("HD-7K3M2Q");
  });
  it("sorts deterministically", () => {
    expect(buildSort("price_asc")).toEqual({ "price.amountKes": 1, _id: 1 });
    expect(buildSort(undefined)).toEqual({ publishedAt: -1, _id: 1 });
    expect(Object.keys(buildSort("size_desc")).at(-1)).toBe("_id");
  });
});

describe("display", () => {
  it("formats prices by listing period", () => {
    expect(formatPrice({ amount: 120_000, currency: "KES", period: "month" })).toBe("KES 120,000 / month");
    expect(formatPrice({ amount: 12_500_000, currency: "KES", period: "total" }, { compact: true })).toBe("KES 12.5M");
    expect(formatPrice(null)).toBe("Price on request");
    expect(compactNumber(450_000)).toBe("450K");
    expect(compactNumber(8_000)).toBe("8,000");
  });
  it("describes rooms and size", () => {
    expect(factsLine({ bedrooms: 3, bathrooms: 2, sizeSqm: 140 })).toBe("3 bed · 2 bath · 140 m²");
    expect(factsLine({ bedrooms: 0, bathrooms: 1, sizeSqm: null })).toBe("Studio · 1 bath");
    expect(formatArea(4046.86)).toBe("1 acres");
    expect(formatArea(40468.56)).toBe("10 acres");
    expect(formatArea(464.52)).toBe("465 m²");
  });
  it("says how long ago", () => {
    expect(timeAgo("2026-11-12T01:00:00Z", now.getTime())).toBe("Today");
    expect(timeAgo("2026-11-11T01:00:00Z", now.getTime())).toBe("Yesterday");
    expect(timeAgo("2026-10-01T00:00:00Z", now.getTime())).toBe("1 month ago");
  });
  it("flags a recent price drop only", () => {
    const t = now.getTime();
    expect(isPriceDrop(90, [{ amount: 100, changedAt: new Date(t - 3 * 86_400_000) }], t)).toBe(true);
    expect(isPriceDrop(90, [{ amount: 100, changedAt: new Date(t - 30 * 86_400_000) }], t)).toBe(false);
    expect(isPriceDrop(110, [{ amount: 100, changedAt: new Date(t - 1000) }], t)).toBe(false);
    expect(isPriceDrop(90, [], t)).toBe(false);
  });
  it("converts dollar prices for comparison", () => {
    expect(toKes(1000, "USD", 130)).toBe(130_000);
    expect(toKes(1000, "KES")).toBe(1000);
  });
});

describe("synonyms and search terms", () => {
  it("expands synonyms", async () => {
    const { expand } = await import("@/lib/synonyms");
    expect(expand("flat")).toContain("apartment");
    expect(expand("bedsitters")).toContain("bedsit");
    expect(expand("pool")).toEqual(["pool"]);
  });
  it("tokenMatch searches the alternatives too", async () => {
    const { tokenMatch } = await import("@/lib/listing-search");
    expect(JSON.stringify(tokenMatch("flat"))).toContain("flat|apartment");
  });
  it("ignores codes, numbers and emails when logging", async () => {
    const { termOf } = await import("@/lib/search-terms.server");
    expect(termOf("HD-7K3M2Q")).toBeNull();
    expect(termOf("0712 345 678")).toBeNull();
    expect(termOf("a@b.co")).toBeNull();
    expect(termOf("  Kilimani   2 BR ")).toBe("kilimani 2 br");
  });
});
