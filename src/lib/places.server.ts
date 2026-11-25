import type { Db } from "mongodb";
import { COUNTY_LIST } from "./mongodb/kenya";
import { closest, norm, type Named } from "./fuzzy";
import { liveFilter } from "./listing-search";
import { GAZETTEER } from "./gazetteer";

// Server-only. Finds the place a person means: counties, areas and estates that already have listings, then map data (Photon, built on OpenStreetMap).

export type PlaceHit = { id: string; label: string; detail: string; kind: "county" | "area" | "place"; countyCode?: number; areaSlug?: string; lat?: number; lng?: number };

type Area = { name: string; countyCode: number | null; county: string; areaSlug: string };
let cache: { at: number; areas: Area[] } | null = null;
/** Areas that have a live listing. Cached for ten minutes: place suggestions run on every few keystrokes. */
export async function knownAreas(db: Db): Promise<Area[]> {
  if (cache && Date.now() - cache.at < 600_000) return cache.areas;
  const rows = await db.collection("properties").aggregate([
    { $match: { ...liveFilter(new Date()), "location.areaSlug": { $type: "string" } } },
    { $group: { _id: { c: "$location.countySlug", a: "$location.areaSlug" }, name: { $first: "$location.areaName" }, county: { $first: "$location.county" }, code: { $first: "$location.countyCode" } } },
    { $limit: 3000 },
  ]).toArray();
  const areas = rows.map((r) => ({ name: String(r["name"] ?? ""), county: String(r["county"] ?? ""), countyCode: typeof r["code"] === "number" ? r["code"] : null, areaSlug: String(r["_id"].a) })).filter((a) => a.name);
  cache = { at: Date.now(), areas };
  return areas;
}

type Photon = { features?: { geometry?: { coordinates?: [number, number] }; properties?: { name?: string; street?: string; district?: string; locality?: string; city?: string; county?: string; state?: string; osm_value?: string; countrycode?: string } }[] };

/** Map search limited to Kenya. Any failure just means no map suggestions. */
export async function mapPlaces(q: string, limit = 6): Promise<PlaceHit[]> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit + 4}&lang=en&bbox=33.8,-4.9,42.0,5.2`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500), headers: { "user-agent": "Hodii/1.0 (place suggestions)" } });
    if (!res.ok) return [];
    const j = (await res.json()) as Photon;
    const seen = new Set<string>();
    const out: PlaceHit[] = [];
    for (const f of j.features ?? []) {
      const p = f.properties ?? {}, c = f.geometry?.coordinates;
      if (!p.name || !c || (p.countrycode && p.countrycode !== "KE")) continue;
      const detail = [p.district ?? p.locality, p.city ?? p.county, p.state].filter((x, i, a) => x && a.indexOf(x) === i && x !== p.name).slice(0, 2).join(", ");
      const key = norm(`${p.name} ${detail}`);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: `m:${c[1]},${c[0]}:${p.name}`, label: p.name, detail: detail || "Kenya", kind: "place", lat: c[1], lng: c[0] });
      if (out.length >= limit) break;
    }
    return out;
  } catch { return []; }
}

const countyNames: Named<number>[] = COUNTY_LIST.map((c) => ({ name: c.name, item: c.code }));

/** Suggestions for a place being typed: counties first, then areas with listings, then map places. */
export async function suggestPlaces(db: Db | null, text: string): Promise<PlaceHit[]> {
  const t = norm(text);
  if (t.length < 2) return [];
  const hits: PlaceHit[] = [];
  for (const c of COUNTY_LIST) if (norm(c.name).startsWith(t)) hits.push({ id: `c:${c.code}`, label: c.name, detail: "County", kind: "county", countyCode: c.code });
  if (db) {
    try {
      const areas = await knownAreas(db);
      for (const a of areas) if (norm(a.name).startsWith(t) || norm(a.name).split(" ").some((w) => w.startsWith(t) && t.length >= 3)) hits.push({ id: `a:${a.areaSlug}:${a.countyCode}`, label: a.name, detail: `${a.county} · has listings`, kind: "area", ...(a.countyCode ? { countyCode: a.countyCode } : {}), areaSlug: a.areaSlug });
    } catch { /* no database: map suggestions still work */ }
  }
  if (hits.length < 8 && t.length >= 3) hits.push(...(await mapPlaces(text, 8 - hits.length)));
  // Nothing typed correctly? Offer the closest county or area by spelling.
  if (!hits.length) {
    const m = closest(text, countyNames);
    if (m) hits.push({ id: `c:${m.item}`, label: m.name, detail: "County · did you mean", kind: "county", countyCode: m.item });
  }
  return hits.slice(0, 8);
}

/** Reads a place word the language rules could not place: a county by spelling, a known area, or a spot on the map. */
export async function resolvePlace(db: Db | null, phrase: string): Promise<{ note: string; countyCodes?: number[]; q?: string; circle?: { lat: number; lng: number; radiusM: number } } | null> {
  const words = norm(phrase).split(" ").filter((x) => x.length > 1);
  if (!words.length) return null;
  // Try the longest runs of words first, so "south b" beats "south", and stray words ("said", "make it") are ignored.
  const runs: string[] = [];
  for (let n = Math.min(3, words.length); n >= 1; n--) for (let i = 0; i + n <= words.length; i++) runs.push(words.slice(i, i + n).join(" "));
  let areas: Area[] = [];
  if (db) { try { areas = await knownAreas(db); } catch { /* use the built-in list */ } }
  const areaList = areas.map((x) => ({ name: x.name, item: x }));
  const gazList = GAZETTEER.map((g) => ({ name: g.name, item: g }));
  let best: { score: number; out: { note: string; countyCodes?: number[]; q?: string } } | null = null;
  const offer = (score: number, out: { note: string; countyCodes?: number[]; q?: string }) => { if (!best || score > best.score) best = { score, out }; };
  for (const w of runs) {
    if (w.length < 3) continue;
    const len = w.split(" ").length;
    const county = closest(w, countyNames);
    const gz = closest(w, gazList);
    const ar = areaList.length ? closest(w, areaList) : null;
    if (county?.exact) offer(100 + len, { note: `${county.name} county`, countyCodes: [county.item] });
    if (gz?.exact) offer(100 + len, { note: `${gz.name}, ${COUNTY_LIST.find((c) => c.code === gz.item.code)?.name ?? ""}`.replace(/, $/, ""), countyCodes: [gz.item.code], q: gz.name });
    if (ar?.exact) offer(100 + len, { note: ar.name, q: ar.name, ...(ar.item.countyCode ? { countyCodes: [ar.item.countyCode] } : {}) });
    if (gz && !gz.exact) offer(50 + len, { note: `read “${w}” as ${gz.name}`, countyCodes: [gz.item.code], q: gz.name });
    if (ar && !ar.exact) offer(45 + len, { note: `read “${w}” as ${ar.name}`, q: ar.name, ...(ar.item.countyCode ? { countyCodes: [ar.item.countyCode] } : {}) });
    if (county && !county.exact) offer(40 + len, { note: `read “${w}” as ${county.name} county`, countyCodes: [county.item] });
  }
  if (best) return (best as { out: { note: string; countyCodes?: number[]; q?: string } }).out;
  // Last resort: the map. Only real places that look like what was typed; never a business that happens to share a word.
  for (const w of runs.filter((r) => r.length >= 4).slice(0, 2)) {
    const hits = await mapPlaces(w, 4);
    const m = hits.find((h) => h.lat !== undefined && h.kind !== "county" && !/\b(bed|breakfast|hotel|lodge|guest|restaurant|hostel|apartments?|school|church|bar|club)\b/i.test(h.label) && closest(w, [{ name: h.label, item: h }]));
    if (m) return { note: `${m.label}${m.detail ? `, ${m.detail}` : ""} on the map`, q: m.label };
  }
  return null;
}
