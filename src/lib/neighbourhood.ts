import { z } from "zod";

/** Neighbourhood ratings, as pure rules shared by the pages and the server. */
export const ASPECTS = [
  { key: "security", label: "Security", hint: "Feeling safe at night, patrols, crime" },
  { key: "amenities", label: "Amenities", hint: "Shops, clinics, banks, restaurants nearby" },
  { key: "transport", label: "Transport", hint: "Matatus, roads, commute times" },
  { key: "quiet", label: "Quietness", hint: "Noise from traffic, bars and neighbours" },
  { key: "utilities", label: "Water and power", hint: "How reliable water and electricity are" },
  { key: "family", label: "Family life", hint: "Schools, parks and child-friendliness" },
  { key: "value", label: "Value for money", hint: "Rent and prices for what you get" },
] as const;
export type AspectKey = (typeof ASPECTS)[number]["key"];
export const ASPECT_KEYS = ASPECTS.map((a) => a.key) as unknown as [AspectKey, ...AspectKey[]];
export const aspectLabel = (k: string) => ASPECTS.find((a) => a.key === k)?.label ?? k;

export const RELATIONS = [{ key: "live", label: "I live here" }, { key: "lived", label: "I used to live here" }, { key: "work", label: "I work here" }, { key: "visit", label: "I visit often" }] as const;
export const RELATION_KEYS = RELATIONS.map((r) => r.key) as unknown as [string, ...string[]];

export const NB_LIMITS = { reviewMax: 800, postMax: 600, postsPerArea: 40, burst: 5, burstSeconds: 60, replyDepth: 3 } as const;

const star = z.number().int().min(1).max(5);
export const reviewInput = z.object({
  areaKey: z.string().regex(/^[a-z0-9-]{2,60}\/[a-z0-9-]{2,80}$/),
  ratings: z.object(Object.fromEntries(ASPECT_KEYS.map((k) => [k, star.optional()])) as Record<AspectKey, z.ZodOptional<typeof star>>).strict()
    .refine((r) => Object.values(r).some((v) => v !== undefined), "Rate at least one thing"),
  text: z.string().trim().max(NB_LIMITS.reviewMax),
  relation: z.enum(RELATION_KEYS),
}).strict();
export type ReviewInput = z.infer<typeof reviewInput>;

export type Ratings = Partial<Record<AspectKey, number>>;
export type Summary = { count: number; overall: number | null; aspects: Partial<Record<AspectKey, { avg: number; n: number }>> };

/** Averages every aspect over the reviews that rated it; "overall" is the mean of the aspect averages. */
export function summarise(rows: readonly Ratings[]): Summary {
  const aspects: Summary["aspects"] = {};
  for (const k of ASPECT_KEYS) {
    const v = rows.map((r) => r[k]).filter((x): x is number => typeof x === "number");
    if (v.length) aspects[k] = { avg: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10, n: v.length };
  }
  const avgs = Object.values(aspects).map((a) => a!.avg);
  return { count: rows.length, overall: avgs.length ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10 : null, aspects };
}

/** Ranking that does not let one 5-star review beat fifty 4.6s: pulls small samples toward 3.5. */
export const rankScore = (s: Summary) => (s.overall === null ? 0 : (s.count * s.overall + 3 * 3.5) / (s.count + 3));

export type NbFilter = { minRating?: number | undefined; aspect?: AspectKey | undefined; minAspect?: number | undefined };
/** Keeps an area when it meets the overall minimum and the minimum for the chosen aspect. Areas with no reviews never pass a rating filter. */
export function passes(s: Summary, f: NbFilter): boolean {
  if (f.minRating !== undefined && (s.overall === null || s.overall < f.minRating)) return false;
  if (f.aspect && f.minAspect !== undefined) { const a = s.aspects[f.aspect]; if (!a || a.avg < f.minAspect) return false; }
  return true;
}
export const makeKey = (countySlug: string, areaSlug: string) => `${countySlug}/${areaSlug}`;
export const splitKey = (k: string) => { const [c, a] = k.split("/"); return { countySlug: c ?? "", areaSlug: a ?? "" }; };
