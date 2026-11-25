import { describe, expect, it } from "vitest";
import { shouldHide, viewReviews, passes, rankScore, reviewInput, summarise, makeKey, splitKey } from "@/lib/neighbourhood";

describe("neighbourhood ratings", () => {
  it("averages each aspect over the reviews that rated it", () => {
    const s = summarise([{ security: 5, amenities: 3 }, { security: 3 }, {}]);
    expect(s.count).toBe(3);
    expect(s.aspects.security).toEqual({ avg: 4, n: 2 });
    expect(s.aspects.amenities).toEqual({ avg: 3, n: 1 });
    expect(s.overall).toBe(3.5);
  });
  it("has no overall without ratings", () => { expect(summarise([]).overall).toBeNull(); });
  it("ranks many good reviews above one perfect one", () => {
    const one = summarise([{ security: 5 }]);
    const many = summarise(Array.from({ length: 30 }, () => ({ security: 4.6 as number })));
    expect(rankScore(many)).toBeGreaterThan(rankScore(one));
  });
  it("filters by overall and by aspect", () => {
    const s = summarise([{ security: 5, quiet: 2 }, { security: 4, quiet: 2 }]);
    expect(passes(s, { minRating: 3 })).toBe(true);
    expect(passes(s, { aspect: "security", minAspect: 4.5 })).toBe(true);
    expect(passes(s, { aspect: "quiet", minAspect: 3 })).toBe(false);
    expect(passes(summarise([]), { minRating: 1 })).toBe(false);
    expect(passes(summarise([]), {})).toBe(true);
  });
  it("validates a review", () => {
    const base = { areaKey: "nairobi/kilimani", text: "Good", relation: "live" };
    expect(reviewInput.safeParse({ ...base, ratings: { security: 4 } }).success).toBe(true);
    expect(reviewInput.safeParse({ ...base, ratings: {} }).success).toBe(false);
    expect(reviewInput.safeParse({ ...base, ratings: { security: 6 } }).success).toBe(false);
    expect(reviewInput.safeParse({ ...base, ratings: { security: 4, bogus: 3 } }).success).toBe(false);
    expect(reviewInput.safeParse({ ...base, areaKey: "../etc", ratings: { security: 4 } }).success).toBe(false);
  });
  it("builds and splits keys", () => { expect(splitKey(makeKey("nairobi", "kilimani"))).toEqual({ countySlug: "nairobi", areaSlug: "kilimani" }); });
  it("hides after three different reporters, not three reports from one person", () => {
    expect(shouldHide(["a", "b"])).toBe(false);
    expect(shouldHide(["a", "a", "a"])).toBe(false);
    expect(shouldHide(["a", "b", "c"])).toBe(true);
  });
  it("filters and sorts reviews", () => {
    const rows = [
      { id: "1", ratings: { security: 5 }, relation: "live", text: "Very safe at night", at: "2026-01-01" },
      { id: "2", ratings: { security: 2, quiet: 2 }, relation: "visit", text: "Noisy bars", at: "2026-03-01" },
      { id: "3", ratings: { quiet: 4 }, relation: "live", text: "", at: "2026-02-01" },
    ];
    expect(viewReviews(rows, { sort: "newest" }).map((r) => r.id)).toEqual(["2", "3", "1"]);
    expect(viewReviews(rows, { sort: "highest" }).map((r) => r.id)).toEqual(["1", "3", "2"]);
    expect(viewReviews(rows, { sort: "lowest" }).map((r) => r.id)).toEqual(["2", "3", "1"]);
    expect(viewReviews(rows, { sort: "newest", relation: "live" }).map((r) => r.id)).toEqual(["3", "1"]);
    expect(viewReviews(rows, { sort: "newest", q: "NOISY" }).map((r) => r.id)).toEqual(["2"]);
    expect(viewReviews(rows, { sort: "newest", aspect: "security" }).map((r) => r.id)).toEqual(["2", "1"]);
  });
});
