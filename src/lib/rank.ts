import { tokens } from "./listing-search";
import { tierNow, type Tier } from "./promotions";

/**
 * Search ranking, in one pure place so it is tested and can be explained to agencies.
 *
 * score = how well the listing matches the words typed (0 to 100, or a flat 50 when nothing was typed)
 *       + a small freshness bonus for new listings
 *       + a capped lift for Boosted or Premium listings (admin Settings: rank.boostLift, rank.premiumLift)
 * and the page mixer then makes sure paid listings never fill more than rank.maxPaidSharePct of a page.
 * A listing that does not match the words never appears at all, however much was paid: matching is a filter, the lift only reorders.
 */
export type RankDoc = {
  id: string; publishedAt: Date | null; tier: Tier; verified: boolean;
  title: string; areaName: string; county: string; propertyType: string; description: string;
  highlights: string[]; extras: string[]; nearby: string[]; place: string[];
};
export type RankSettings = { boostLift: number; premiumLift: number; freshDays: number };
export type Ranked = RankDoc & { score: number; paid: boolean };

const WEIGHTS = { title: 10, area: 8, type: 5, county: 4, highlights: 4, extras: 4, place: 3, nearby: 3, description: 2 } as const;

const has = (hay: string, t: string) => hay.toLowerCase().includes(t);

/** 0 to 100: for each word the best place it was found counts, so a word in the title beats the same word in the description. */
export function textScore(d: RankDoc, words: string[]): number {
  if (!words.length) return 50;
  let total = 0;
  for (const w of words) {
    const t = w.length > 3 ? w.replace(/ies$/, "y").replace(/s$/, "") : w;
    let best = 0;
    const hit = (weight: number, cond: boolean) => { if (cond && weight > best) best = weight; };
    hit(WEIGHTS.title, has(d.title, t));
    hit(WEIGHTS.area, has(d.areaName, t));
    hit(WEIGHTS.type, has(d.propertyType, t));
    hit(WEIGHTS.county, has(d.county, t));
    hit(WEIGHTS.highlights, d.highlights.some((h) => has(h, t)));
    hit(WEIGHTS.extras, d.extras.some((h) => has(h, t)));
    hit(WEIGHTS.place, d.place.some((h) => has(h, t)));
    hit(WEIGHTS.nearby, d.nearby.some((h) => has(h, t)));
    hit(WEIGHTS.description, has(d.description, t));
    total += best;
  }
  return (total / (words.length * WEIGHTS.title)) * 100;
}

export function rank(docs: readonly RankDoc[], q: string | undefined, cfg: RankSettings, now = Date.now()): Ranked[] {
  const words = q ? tokens(q) : [];
  const day = 86_400_000;
  return docs.map((d) => {
    const age = d.publishedAt ? (now - d.publishedAt.getTime()) / day : Infinity;
    const fresh = age <= cfg.freshDays ? 10 * (1 - age / Math.max(1, cfg.freshDays)) : 0;
    const lift = d.tier === "premium" ? cfg.premiumLift : d.tier === "boost" ? cfg.boostLift : 0;
    return { ...d, score: textScore(d, words) + fresh + lift + (d.verified ? 3 : 0), paid: d.tier !== "none" };
  }).sort((a, b) => b.score - a.score || (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0) || a.id.localeCompare(b.id));
}

/** Reads a stored listing into what the ranker needs. */
export function rankDocOf(d: Record<string, unknown>, now = Date.now()): RankDoc {
  const loc = (d["location"] ?? {}) as Record<string, string | null>;
  const nearby = Array.isArray(d["nearby"]) ? (d["nearby"] as { name?: string }[]).map((n) => n.name ?? "") : [];
  const arr = (k: string) => (Array.isArray(d[k]) ? (d[k] as unknown[]).map(String) : []);
  return {
    id: String(d["_id"]), publishedAt: d["publishedAt"] instanceof Date ? d["publishedAt"] : null,
    tier: tierNow(d["promotion"] as never, now), verified: (d["verified"] as { isVerified?: boolean } | undefined)?.isVerified === true,
    title: String(d["title"] ?? ""), areaName: String(loc["areaName"] ?? ""), county: String(loc["county"] ?? ""), propertyType: String(d["propertyType"] ?? "").replace(/_/g, " "),
    description: String(d["descriptionHead"] ?? ""), highlights: arr("highlights"), extras: [...arr("customFeatures"), ...arr("features").map((f) => f.replace(/_/g, " "))],
    nearby, place: [loc["address"], loc["landmark"], loc["subCounty"]].filter((x): x is string => !!x),
  };
}
