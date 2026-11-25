import { describe, expect, it } from "vitest";
import { rank, textScore, type RankDoc } from "./rank";

const base: RankDoc = { id: "a", publishedAt: new Date("2026-01-01"), tier: "none", verified: false, title: "", areaName: "", county: "", propertyType: "apartment", description: "", highlights: [], extras: [], nearby: [], place: [] };
const doc = (o: Partial<RankDoc>): RankDoc => ({ ...base, ...o });
const cfg = { boostLift: 12, premiumLift: 8, freshDays: 7 };
const now = new Date("2026-06-01").getTime();

describe("textScore", () => {
  it("scores a word in the title above the same word in the description", () => {
    expect(textScore(doc({ title: "Lovely Kilimani flat" }), ["kilimani"])).toBeGreaterThan(textScore(doc({ description: "near kilimani" }), ["kilimani"]));
  });
  it("is flat when nothing was typed", () => {
    expect(textScore(doc({}), [])).toBe(50);
  });
  it("finds words in nearby places and ignores plurals", () => {
    expect(textScore(doc({ nearby: ["Yaya Centre"] }), ["yaya"])).toBeGreaterThan(0);
    expect(textScore(doc({ title: "Apartment" }), ["apartments"])).toBeGreaterThan(0);
  });
});

describe("rank", () => {
  it("lifts boosted listings a little but not above a clearly better match", () => {
    const strong = doc({ id: "strong", title: "Kilimani 2 bedroom" });
    const paidWeak = doc({ id: "paid", tier: "boost", description: "close to kilimani" });
    expect(rank([paidWeak, strong], "kilimani", cfg, now).map((r) => r.id)).toEqual(["strong", "paid"]);
  });
  it("puts a paid listing ahead of an equal free one", () => {
    const a = doc({ id: "free", title: "Kilimani" }), b = doc({ id: "prem", title: "Kilimani", tier: "premium" });
    expect(rank([a, b], "kilimani", cfg, now)[0]!.id).toBe("prem");
  });
  it("prefers fresh listings among equals", () => {
    const old = doc({ id: "old", publishedAt: new Date("2026-01-01") }), fresh = doc({ id: "new", publishedAt: new Date("2026-05-30") });
    expect(rank([old, fresh], undefined, cfg, now)[0]!.id).toBe("new");
  });
});
