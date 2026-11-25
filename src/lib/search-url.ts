import { cleanRing } from "./geo";
import { searchParamsSchema } from "./mongodb/property-schemas";
import { toSlug } from "./mongodb/kenya";
import type { SearchParams } from "./listing-search";

/**
 * Search lives in the address bar so every search can be shared and bookmarked.
 * Lists are written comma-separated (?type=house,maisonette) and numbers as plain digits; anything unreadable is dropped, never an error.
 */
export type SearchUrl = Partial<Record<"q" | "for" | "cat" | "type" | "county" | "area" | "min" | "max" | "beds" | "baths" | "sqmMin" | "sqmMax" | "features" | "furnishing" | "cond" | "verified" | "sort" | "page" | "lat" | "lng" | "r" | "poly" | "view", string>>;

const list = (v?: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined);
const int = (v?: string) => { if (v === undefined || v === "") return undefined; const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined; };
const nums = (v?: string) => list(v)?.map(Number).filter((n) => Number.isInteger(n));

const num = (v?: string) => { const n = Number(v); return v !== undefined && v !== "" && Number.isFinite(n) ? n : undefined; };
/** A drawn shape travels as lng,lat pairs joined by "_": poly=36.81,-1.29_36.83,-1.29_36.82,-1.31 */
export const polyToUrl = (p: number[][]) => cleanRing(p.map((c) => [c[0]!, c[1]!] as [number, number])).map((c) => `${c[0]!.toFixed(5)},${c[1]!.toFixed(5)}`).join("_");
const polyFromUrl = (v?: string) => v ? v.split("_").map((s) => s.split(",").map(Number)).filter((c) => c.length === 2 && c.every(Number.isFinite)) : undefined;

export function paramsFromUrl(u: SearchUrl): SearchParams {
  const lat = num(u.lat), lng = num(u.lng), r = num(u.r);
  const raw = {
    circle: lat !== undefined && lng !== undefined && r !== undefined ? { lat, lng, radiusM: Math.round(r) } : undefined, polygon: polyFromUrl(u.poly),
    q: u.q?.trim() || undefined, listingType: u.for, category: u.cat, propertyTypes: list(u.type), countyCodes: nums(u.county), areaSlugs: list(u.area),
    priceMin: int(u.min), priceMax: int(u.max), bedroomsMin: int(u.beds), bathroomsMin: int(u.baths), areaSqmMin: int(u.sqmMin), areaSqmMax: int(u.sqmMax),
    features: list(u.features), furnishing: u.furnishing, conditions: list(u.cond), verifiedOnly: u.verified === "1" ? true : undefined,
    sort: u.sort ?? "relevance", page: 1,
  };
  // Drop empty keys, then keep only the pieces that validate one at a time, so one bad value does not erase the whole search.
  const clean = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)));
  const whole = searchParamsSchema.safeParse(clean);
  if (whole.success) return whole.data as SearchParams;
  const bad = new Set(whole.error.issues.map((i) => String(i.path[0] ?? "")));
  // A rule across fields (min above max) has no single culprit: drop the ranges.
  if (bad.has("")) for (const k of ["priceMin", "priceMax", "areaSqmMin", "areaSqmMax"]) bad.add(k);
  const kept = Object.fromEntries(Object.entries(clean).filter(([k]) => !bad.has(k)));
  const retry = searchParamsSchema.safeParse(kept);
  return (retry.success ? retry.data : searchParamsSchema.parse({})) as SearchParams;
}

export function urlFromParams(p: Partial<SearchParams>): SearchUrl {
  const out: SearchUrl = {};
  const set = <K extends keyof SearchUrl>(k: K, v: string | undefined) => { if (v) out[k] = v; };
  set("q", p.q); set("for", p.listingType); set("cat", p.category);
  set("type", p.propertyTypes?.join(",")); set("county", p.countyCodes?.join(",")); set("area", p.areaSlugs?.join(","));
  set("min", p.priceMin !== undefined ? String(p.priceMin) : undefined); set("max", p.priceMax !== undefined ? String(p.priceMax) : undefined);
  set("beds", p.bedroomsMin !== undefined ? String(p.bedroomsMin) : undefined); set("baths", p.bathroomsMin !== undefined ? String(p.bathroomsMin) : undefined);
  set("sqmMin", p.areaSqmMin !== undefined ? String(p.areaSqmMin) : undefined); set("sqmMax", p.areaSqmMax !== undefined ? String(p.areaSqmMax) : undefined);
  set("features", p.features?.join(",")); set("furnishing", p.furnishing); set("cond", p.conditions?.join(","));
  if (p.verifiedOnly) out.verified = "1";
  if (p.circle) { out.lat = p.circle.lat.toFixed(5); out.lng = p.circle.lng.toFixed(5); out.r = String(p.circle.radiusM); }
  else if (p.polygon) out.poly = polyToUrl(p.polygon);
  if (p.sort && p.sort !== "relevance") out.sort = p.sort;
  if (p.page && p.page > 1) out.page = String(p.page);
  return out;
}

/** The search each navigation category opens. Footer and header links go to /section/<slug>, which redirects here. */
export const CATEGORY_SEARCHES: Record<string, { title: string; description: string; search: SearchUrl }> = {
  "houses-for-sale": { title: "Houses for sale in Kenya", description: "Houses, maisonettes, bungalows and townhouses for sale across Kenya.", search: { for: "sale", type: "house,maisonette,bungalow,townhouse" } },
  "houses-to-rent": { title: "Houses to rent in Kenya", description: "Houses and maisonettes to rent across Kenya.", search: { for: "rent", type: "house,maisonette,bungalow,townhouse" } },
  "apartments-for-rent": { title: "Apartments to rent in Kenya", description: "Apartments to rent in Nairobi, Mombasa, Kisumu and beyond.", search: { for: "rent", type: "apartment" } },
  "apartments-for-sale": { title: "Apartments for sale in Kenya", description: "Apartments for sale across Kenya.", search: { for: "sale", type: "apartment" } },
  "bedsitters-and-studios": { title: "Bedsitters and studios in Kenya", description: "Affordable bedsitters and studio apartments to rent.", search: { for: "rent", type: "bedsitter,studio" } },
  "land-for-sale": { title: "Land for sale in Kenya", description: "Plots, farms and acreage for sale across Kenya.", search: { for: "sale", cat: "land" } },
  "farms-and-ranches": { title: "Farms and ranches for sale in Kenya", description: "Farms, ranches and agricultural land for sale.", search: { for: "sale", type: "agricultural_land,farm_ranch" } },
  "commercial-property": { title: "Commercial property in Kenya", description: "Offices, shops, warehouses and other commercial property.", search: { cat: "commercial" } },
  "offices": { title: "Offices in Kenya", description: "Offices for sale and to rent.", search: { type: "office" } },
  "shops-and-retail": { title: "Shops and retail space in Kenya", description: "Shops and retail space for sale and to rent.", search: { type: "shop" } },
  "warehouses": { title: "Warehouses in Kenya", description: "Warehouses and industrial property.", search: { type: "warehouse" } },
  "short-stays": { title: "Short stays in Kenya", description: "Furnished apartments, villas and holiday homes for short stays.", search: { for: "short_stay" } },
  "holiday-homes": { title: "Holiday homes in Kenya", description: "Holiday homes and villas for short stays.", search: { for: "short_stay", type: "villa,cottage" } },
  "serviced-apartments": { title: "Serviced apartments in Kenya", description: "Serviced apartments to rent or stay in.", search: { type: "serviced_apartment" } },
  "student-housing": { title: "Student housing in Kenya", description: "Hostels and bedsitters near universities.", search: { for: "rent", type: "bedsitter,student_hostel" } },
  "new-developments": { title: "New developments in Kenya", description: "Newly built and off-plan homes.", search: { cond: "new,under_construction" } },
};
export const categorySearch = (slug: string) => CATEGORY_SEARCHES[toSlug(slug)] ?? null;
