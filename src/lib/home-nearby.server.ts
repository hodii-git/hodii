import type { Db, Document, Filter } from "mongodb";
import { getRequestHeader } from "@tanstack/react-start/server";
import { COUNTY_LIST, countyByCode, regionOfCounty, toSlug } from "./mongodb/kenya";
import { CARD_PROJECTION, PAID_NOW, cardsFor } from "./properties.server";
import type { PropertyCard } from "./property-dto";
import { liveFilter } from "./listing-search";

// Server-only: the home page's "near you" lists.

export const HOME_FEATURED = 6;
export const HOME_LATEST = 8;

export type Place = { areaSlug: string | null; area: string | null; subCounty: string | null; countyCode: number | null; county: string | null; label: string };
export type Scope = { level: "area" | "subCounty" | "county" | "region" | "country"; label: string; count: number };
export type NearbyHome = { place: Place | null; featured: PropertyCard[]; latest: PropertyCard[]; featuredScopes: Scope[]; latestScopes: Scope[] };
export type PlaceInput = { areaSlug?: string | undefined; countyCode?: number | undefined; lat?: number | undefined; lng?: number | undefined };

type Level = { level: Scope["level"]; label: string; filter: Filter<Document> };

/** From the narrowest match to the widest: area, sub-county, county, region, then the whole country. */
export function levelsFor(place: Place): Level[] {
  const levels: Level[] = [];
  if (place.areaSlug) levels.push({ level: "area", label: place.area ?? place.label, filter: { "location.areaSlug": place.areaSlug } });
  if (place.subCounty && place.countyCode) levels.push({ level: "subCounty", label: place.subCounty, filter: { "location.countyCode": place.countyCode, "location.subCounty": place.subCounty } });
  if (place.countyCode) {
    levels.push({ level: "county", label: place.county ?? "your county", filter: { "location.countyCode": place.countyCode } });
    const region = regionOfCounty(place.countyCode);
    if (region) levels.push({ level: "region", label: region.name, filter: { "location.countyCode": { $in: [...region.counties] } } });
  }
  levels.push({ level: "country", label: "Kenya", filter: {} });
  return levels;
}

/**
 * Fills `want` places by going up the levels until there are enough. A listing is only used once, at the narrowest level it matches,
 * so the nearest listings always come first.
 */
export async function fillByLevels<T extends { id: string }>(levels: Level[], want: number, fetchAt: (filter: Filter<Document>, exclude: string[], limit: number) => Promise<T[]>) {
  const items: T[] = [];
  const scopes: Scope[] = [];
  for (const l of levels) {
    if (items.length >= want) break;
    const got = await fetchAt(l.filter, items.map((i) => i.id), want - items.length);
    if (got.length) { items.push(...got); scopes.push({ level: l.level, label: l.label, count: got.length }); }
  }
  return { items, scopes };
}

const placeFromDoc = (loc: Document): Place => {
  const area = typeof loc["areaName"] === "string" && loc["areaSlug"] ? String(loc["areaName"]) : null;
  const county = typeof loc["county"] === "string" ? String(loc["county"]) : null;
  return {
    areaSlug: area ? String(loc["areaSlug"]) : null, area, subCounty: typeof loc["subCounty"] === "string" ? String(loc["subCounty"]) : null,
    countyCode: typeof loc["countyCode"] === "number" ? loc["countyCode"] : null, county,
    label: [area, county].filter(Boolean).join(", ") || "Kenya",
  };
};

/** A visitor's city, as sent by the hosting edge. Only a hint; the visitor can always change it. */
export function cityFromHeaders(): string | null {
  const raw = getRequestHeader("x-vercel-ip-city") ?? getRequestHeader("cf-ipcity") ?? null;
  if (!raw) return null;
  try { return decodeURIComponent(raw).trim().slice(0, 80) || null; } catch { return raw.slice(0, 80); }
}
export function countryFromHeaders(): string | null {
  return getRequestHeader("x-vercel-ip-country") ?? getRequestHeader("cf-ipcountry") ?? null;
}

/** Turns what we know (a chosen area or county, a position, or a city name) into a place, or null when there is no match in Kenya. */
export async function resolvePlace(db: Db, input: PlaceInput & { city?: string | undefined }): Promise<Place | null> {
  const col = db.collection("properties");
  const live = liveFilter(new Date());
  if (input.areaSlug) {
    const d = await col.findOne({ ...live, "location.areaSlug": input.areaSlug }, { projection: { location: 1 } }) as Document | null;
    if (d) return placeFromDoc(d["location"] as Document);
  }
  if (input.countyCode) {
    const c = countyByCode(input.countyCode);
    if (c) return { areaSlug: null, area: null, subCounty: null, countyCode: c.code, county: c.name, label: c.name };
  }
  if (typeof input.lat === "number" && typeof input.lng === "number") {
    const near = await col.aggregate([
      { $geoNear: { near: { type: "Point", coordinates: [input.lng, input.lat] }, distanceField: "d", maxDistance: 60_000, spherical: true, query: live, key: "location.point" } },
      { $limit: 1 }, { $project: { location: 1 } },
    ]).toArray();
    if (near[0]) return placeFromDoc(near[0]["location"] as Document);
  }
  if (input.city) {
    const slug = toSlug(input.city);
    const area = await col.findOne({ ...live, "location.areaSlug": slug }, { projection: { location: 1 } }) as Document | null;
    if (area) return placeFromDoc(area["location"] as Document);
    const county = COUNTY_LIST.find((c) => c.slug === slug);
    if (county) return { areaSlug: null, area: null, subCounty: null, countyCode: county.code, county: county.name, label: county.name };
  }
  return null;
}

export async function loadNearbyHome(db: Db, place: Place | null): Promise<NearbyHome> {
  if (!place) return { place: null, featured: [], latest: [], featuredScopes: [], latestScopes: [] };
  const col = db.collection("properties");
  const now = new Date();
  const live = liveFilter(now);
  const levels = levelsFor(place);
  const run = async (extra: Filter<Document>, sort: Document, want: number) => fillByLevels<PropertyCard>(levels, want, async (filter, exclude, limit) => {
    const docs = await col.aggregate([
      { $match: { ...live, ...extra, ...filter, ...(exclude.length ? { _id: { $nin: exclude } } : {}) } },
      { $sort: sort }, { $limit: limit }, { $project: CARD_PROJECTION },
    ]).toArray();
    return cardsFor(db, docs);
  });
  const [featured, latest] = await Promise.all([
    run(PAID_NOW(now), { publishedAt: -1, _id: 1 }, HOME_FEATURED),
    run({}, { publishedAt: -1, _id: 1 }, HOME_LATEST),
  ]);
  return { place, featured: featured.items, latest: latest.items, featuredScopes: featured.scopes, latestScopes: latest.scopes };
}
