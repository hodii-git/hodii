import { searchablePolygon } from "./geo";
import type { z } from "zod";
import { expand } from "./synonyms";
import type { searchParamsSchema } from "./mongodb/property-schemas";
import { FEATURES } from "./mongodb/taxonomy";

/** Builds the MongoDB filter and sort for public listing searches. Pure, so it is tested without a database. */
export type SearchParams = z.infer<typeof searchParamsSchema>;
type Filter = Record<string, unknown>;

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const tokens = (q: string) => q.toLowerCase().split(/[\s,]+/).map((t) => t.trim()).filter((t) => t.length > 1).slice(0, 8);

/** Only listings that are live: published and not past their expiry date. */

/** Every text field a person might be thinking of when they type a word. Searched as a whole, not only the title. */
export const SEARCH_TEXT_FIELDS = ["title", "description", "highlights", "customFeatures", "location.areaName", "location.county", "location.subCounty", "location.address", "location.landmark", "nearby.name", "propertyType", "externalRef"] as const;
const stem = (t: string) => (t.length > 3 ? t.replace(/(ies)$/, "y").replace(/s$/, "") : t);
/** Catalogue features whose name contains the word ("pool" finds the swimming pool tick-box as well as the word in text). */
const featureKeysFor = (t: string) => (t.length < 3 ? [] : FEATURES.filter((f) => f.label.toLowerCase().includes(t)).map((f) => f.key));

/**
 * Close matches for a misspelt word: the word with one letter wrong, missing, extra or swapped ("jilimani" finds Kilimani).
 * Returns a regular-expression source; only for words of 4 to 16 letters, shorter ones would match far too much.
 */
export function fuzzyPattern(word: string): string | null {
  const w = word.toLowerCase();
  if (w.length < 4 || w.length > 16 || /[^a-z0-9]/.test(w)) return null;
  const v = new Set<string>();
  for (let i = 0; i < w.length; i++) {
    v.add(`${w.slice(0, i)}.${w.slice(i + 1)}`); // one letter wrong
    v.add(`${w.slice(0, i)}${w.slice(i + 1)}`); // one letter too many
    v.add(`${w.slice(0, i)}.${w.slice(i)}`); // one letter missing
    if (i < w.length - 1) v.add(`${w.slice(0, i)}${w[i + 1]}${w[i]}${w.slice(i + 2)}`); // two swapped
  }
  v.add(`${w}.`);
  return [...v].join("|");
}
/** Fields close matching looks in: names and short text only, so a typo never matches a stray word in a long description. */
const FUZZY_FIELDS = ["title", "location.areaName", "location.county", "location.subCounty", "location.landmark", "nearby.name", "highlights"] as const;

/** One word must appear somewhere in the listing: in any text field, or as a ticked feature. With `fuzzy`, near misses count too. */
export function tokenMatch(token: string, fuzzy = false): Filter {
  const s = stem(token);
  const rx = { $regex: expand(s).map(escapeRegex).join("|"), $options: "i" };
  const or: Filter[] = SEARCH_TEXT_FIELDS.map((k) => ({ [k]: rx }));
  const fz = fuzzy ? fuzzyPattern(s) : null;
  if (fz) for (const k of FUZZY_FIELDS) or.push({ [k]: { $regex: fz, $options: "i" } });
  const keys = featureKeysFor(s);
  if (keys.length) or.push({ features: { $in: keys } });
  return { $or: or };
}

export const liveFilter = (now: Date): Filter => ({ status: "published", expiresAt: { $gt: now } });

export function buildSearchFilter(p: Partial<SearchParams>, now = new Date(), fuzzy = false): Filter {
  const f: Filter = liveFilter(now);
  const and: Filter[] = [];
  if (p.listingType) f["listingType"] = p.listingType;
  if (p.category) f["category"] = p.category;
  if (p.propertyTypes?.length) f["propertyType"] = { $in: p.propertyTypes };
  if (p.countyCodes?.length) f["location.countyCode"] = { $in: p.countyCodes };
  if (p.areaSlugs?.length) f["location.areaSlug"] = { $in: p.areaSlugs };
  if (p.priceMin !== undefined || p.priceMax !== undefined) {
    f["price.amountKes"] = { ...(p.priceMin !== undefined && { $gte: p.priceMin }), ...(p.priceMax !== undefined && { $lte: p.priceMax }) };
  }
  if (p.bedroomsMin !== undefined) f["details.bedrooms"] = { $gte: p.bedroomsMin };
  if (p.bathroomsMin !== undefined) f["details.bathrooms"] = { $gte: p.bathroomsMin };
  if (p.areaSqmMin !== undefined || p.areaSqmMax !== undefined) {
    const range = { ...(p.areaSqmMin !== undefined && { $gte: p.areaSqmMin }), ...(p.areaSqmMax !== undefined && { $lte: p.areaSqmMax }) };
    and.push({ $or: [{ "details.floorAreaSqm": range }, { "details.plotAreaSqm": range }] });
  }
  if (p.features?.length) f["features"] = { $all: p.features };
  if (p.furnishing) f["details.furnishing"] = p.furnishing;
  if (p.conditions?.length) f["details.condition"] = { $in: p.conditions };
  if (p.circle) f["location.point"] = { $geoWithin: { $centerSphere: [[p.circle.lng, p.circle.lat], p.circle.radiusM / 6_378_100] } };
  else if (p.polygon && searchablePolygon(p.polygon.map((c) => [c[0]!, c[1]!] as [number, number])).length >= 3) {
    const ring = searchablePolygon(p.polygon.map((c) => [c[0]!, c[1]!] as [number, number])).map((c) => [c[0], c[1]]);
    const first = ring[0]!, last = ring[ring.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0]!, first[1]!]);
    f["location.point"] = { $geoWithin: { $geometry: { type: "Polygon", coordinates: [ring] } } };
  }
  if (p.verifiedOnly) f["verified.isVerified"] = true;
  if (p.q) {
    const code = p.q.trim().toUpperCase();
    // A pasted reference code (HD-7K3M2Q) finds that exact listing; anything else must match every word.
    if (/^HD-[A-Z0-9]{6}$/.test(code)) f["referenceCode"] = code;
    else for (const t of tokens(p.q)) and.push(tokenMatch(t, fuzzy));
  }
  if (and.length) f["$and"] = and;
  return f;
}

/** Sort stage. Every sort ends on `_id` so pages never repeat or skip a listing. */
export function buildSort(sort: SearchParams["sort"] | undefined): Record<string, 1 | -1> {
  switch (sort) {
    case "price_asc": return { "price.amountKes": 1, _id: 1 };
    case "price_desc": return { "price.amountKes": -1, _id: 1 };
    case "size_desc": return { "details.floorAreaSqm": -1, "details.plotAreaSqm": -1, _id: 1 };
    default: return { publishedAt: -1, _id: 1 };
  }
}
