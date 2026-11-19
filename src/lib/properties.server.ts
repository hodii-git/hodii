import { revealLimits } from "./reveal-cap";
import { rank, rankDocOf } from "./rank";
import { mixPaid, tierNow } from "./promotions";
import { getRequestHeader } from "@tanstack/react-start/server";
import type { Db, Document, Filter } from "mongodb";
import { ensureCollectionIndexes } from "./mongodb/ensure";
import { countyBySlug } from "./mongodb/kenya";
import { buildSearchFilter, buildSort, escapeRegex, liveFilter, type SearchParams } from "./listing-search";
import { ENQUIRY_LIMITS, SAVED_LIMITS } from "./mongodb/limits";
import { enquirySchema, type PropertyDocument } from "./mongodb/property-schemas";
import type { EventKind } from "./mongodb/taxonomy";
import { isPriceDrop, type JsonObject, type AgencyBadge, type ImageDto, type PropertyCard, type PropertyDetail, type PriceDto, type SearchResult } from "./property-dto";
import { decrypt, encrypt } from "./community.server";
import { sha256 } from "./password.server";

// Server-only: everything the public pages read and write about listings.
export const propertiesCol = (db: Db) => db.collection<PropertyDocument>("properties");
export const ensurePropertyIndexes = (db: Db) => ensureCollectionIndexes(db, ["properties", "propertyEvents", "propertyDailyStats", "enquiries", "savedProperties", "listingReports", "agencies", "agencyMembers"]);

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const clientIp = () => getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
export const hashIp = (scope: string) => sha256(`hodii-${scope}:${clientIp()}`);
/** Dates become ISO strings, so the value can travel to the browser. */
const json = (v: unknown): JsonObject | null => (v && typeof v === "object" ? (JSON.parse(JSON.stringify(v)) as JsonObject) : null);
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null);

/* ───────────────────────────── DTO conversion ───────────────────────────── */

const imageDto = (i: Document): ImageDto => ({
  url: str(i["url"]), thumbUrl: typeof i["thumbUrl"] === "string" ? i["thumbUrl"] : null, alt: str(i["alt"]),
  width: numOrNull(i["width"]) ?? 0, height: numOrNull(i["height"]) ?? 0, caption: typeof i["caption"] === "string" ? i["caption"] : null,
});

const ratingOf = (a: Document) => { const r = a["rating"] as Document | undefined; return r && Number(r["count"]) > 0 ? { count: Number(r["count"]), avg: Number(r["avg"]) } : null; };
export function agencyBadge(a: Document | undefined): AgencyBadge | null {
  if (!a) return null;
  return { slug: str(a["slug"]), name: str(a["name"]), logo: typeof a["logo"] === "object" && a["logo"] ? str((a["logo"] as Document)["url"]) || null : null, verified: (a["verification"] as Document | undefined)?.["status"] === "verified", kind: str(a["kind"]), rating: ratingOf(a) };
}

export function cardOf(d: Document, agencies: Map<string, Document>, now = Date.now()): PropertyCard {
  const details = (d["details"] ?? {}) as Document;
  const loc = (d["location"] ?? {}) as Document;
  const cover = (d["cover"] ?? (Array.isArray(d["images"]) ? d["images"][0] : null)) as Document | null;
  const price = d["price"] as Document | null | undefined;
  const promotion = (d["promotion"] ?? {}) as Document;
  return {
    id: str(d["_id"]), slug: str(d["slug"]), referenceCode: str(d["referenceCode"]), title: str(d["title"]),
    listingType: d["listingType"] as PropertyCard["listingType"], category: d["category"] as PropertyCard["category"], propertyType: str(d["propertyType"]),
    price: price ? { amount: Number(price["amount"]), currency: str(price["currency"], "KES"), period: str(price["period"], "total"), negotiable: price["negotiable"] === true } : null,
    county: typeof loc["county"] === "string" ? loc["county"] : null, areaName: str(loc["areaName"]),
    bedrooms: numOrNull(details["bedrooms"]), bathrooms: numOrNull(details["bathrooms"]), parking: numOrNull(details["parkingSpaces"]),
    sizeSqm: numOrNull(details["floorAreaSqm"]) ?? numOrNull(details["plotAreaSqm"]),
    image: cover ? imageDto(cover) : null,
    more: (Array.isArray(d["more"]) ? (d["more"] as Document[]) : Array.isArray(d["images"]) ? (d["images"] as Document[]).slice(1, 5) : []).map(imageDto), imageCount: numOrNull(d["imageCount"]) ?? (Array.isArray(d["images"]) ? d["images"].length : 0),
    verified: (d["verified"] as Document | undefined)?.["isVerified"] === true,
    tier: tierNow({ boostUntil: promotion["boostUntil"] as Date | null | undefined, premiumUntil: promotion["premiumUntil"] as Date | null | undefined }, now),
    priceDrop: isPriceDrop(price ? Number(price["amount"]) : null, d["priceHistory"] as never, now),
    publishedAt: iso(d["publishedAt"]), agency: agencyBadge(agencies.get(str(d["agencyId"]))),
  };
}

/** Fields a card needs; keeps long text and the other photos out of list queries. */
export const CARD_PROJECTION = {
  slug: 1, referenceCode: 1, title: 1, listingType: 1, category: 1, propertyType: 1, price: 1, priceHistory: 1, agencyId: 1, publishedAt: 1, promotion: 1,
  "verified.isVerified": 1, "location.county": 1, "location.areaName": 1,
  "details.bedrooms": 1, "details.bathrooms": 1, "details.parkingSpaces": 1, "details.floorAreaSqm": 1, "details.plotAreaSqm": 1,
  cover: { $arrayElemAt: ["$images", 0] }, more: { $slice: ["$images", 1, 4] }, imageCount: { $size: "$images" },
};

export async function agenciesById(db: Db, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, Document>();
  const rows = await db.collection("agencies").find({ _id: { $in: unique } as never }, { projection: { slug: 1, name: 1, logo: 1, kind: 1, "verification.status": 1, status: 1 } }).toArray();
  return new Map(rows.map((r) => [String(r["_id"]), r]));
}

export async function cardsFor(db: Db, docs: Document[]): Promise<PropertyCard[]> {
  const agencies = await agenciesById(db, docs.map((d) => str(d["agencyId"])));
  return docs.map((d) => cardOf(d, agencies));
}

/* ───────────────────────────────── Reads ───────────────────────────────── */

/** How many of the best candidates are ranked in memory. Deeper pages fall back to newest-first. */
export const RANK_POOL = 240;
const RANK_PROJECTION = {
  ...CARD_PROJECTION, descriptionHead: { $substrCP: ["$description", 0, 600] }, highlights: 1, customFeatures: 1, features: 1, "nearby.name": 1,
  "location.subCounty": 1, "location.address": 1, "location.landmark": 1,
};

/** Counts what people search for (words only) so staff can see what is missing. First page only, and never slows or breaks the search. */
function track(db: Db, p: SearchParams, total: number, fuzzy: boolean) {
  if (p.page !== 1 || !p.q) return;
  void import("./search-terms.server").then((m) => m.logSearch(db, p.q, total, fuzzy)).catch(() => {});
}

export async function searchProperties(db: Db, original: SearchParams): Promise<SearchResult> {
  const col = propertiesCol(db);
  let p = original;
  let fuzzy = false;
  let nearest: string[] | undefined;
  let filter = buildSearchFilter(p);
  // Nothing matched the words exactly: try close spellings before giving up (typos, "jilimani" for Kilimani).
  if (p.q && !/^HD-[A-Z0-9]{6}$/i.test(p.q.trim()) && (await col.countDocuments(filter, { limit: 1 })) === 0) {
    const loose = buildSearchFilter(p, new Date(), true);
    if ((await col.countDocuments(loose, { limit: 1 })) > 0) { filter = loose; fuzzy = true; }
  }
  // Still nothing: loosen the search a step at a time and show the nearest matches, saying what was loosened.
  if ((await col.countDocuments(filter, { limit: 1 })) === 0 && !fuzzy) {
    const { relaxations } = await import("./nearest");
    for (const step of relaxations({ ...p, page: 1 })) {
      const f = buildSearchFilter(step.params);
      if ((await col.countDocuments(f, { limit: 1 })) > 0) {
        p = { ...step.params, page: original.page, pageSize: original.pageSize, sort: original.sort }; filter = f;
        nearest = relaxations(original).slice(0, relaxations(original).findIndex((x) => x.label === step.label) + 1).map((x) => x.label);
        break;
      }
    }
  }
  const ranked = p.sort === "relevance" && (p.page - 1) * p.pageSize + p.pageSize <= RANK_POOL;
  if (ranked) {
    const { getSettings } = await import("./settings.server");
    const [v, pool, total] = await Promise.all([
      getSettings(),
      col.aggregate([{ $match: filter }, { $sort: { publishedAt: -1, _id: 1 } }, { $limit: RANK_POOL }, { $project: RANK_PROJECTION }]).toArray(),
      col.countDocuments(filter),
    ]);
    const now = Date.now();
    const byId = new Map(pool.map((d) => [String(d["_id"]), d]));
    const order = rank(pool.map((d) => rankDocOf(d, now)), p.q, { boostLift: Number(v["rank.boostLift"]), premiumLift: Number(v["rank.premiumLift"]), freshDays: Number(v["rank.freshDays"]) }, now);
    const mixed = mixPaid(order, p.pageSize, Number(v["rank.maxPaidSharePct"]));
    const slice = mixed.slice((p.page - 1) * p.pageSize, p.page * p.pageSize).map((r) => byId.get(r.id)!);
    track(db, original, nearest ? 0 : total, fuzzy);
    return { items: await cardsFor(db, slice), total, page: p.page, pageSize: p.pageSize, unavailable: false, ...(fuzzy && { fuzzy }), ...(nearest && { nearest }) };
  }
  const [docs, total] = await Promise.all([
    col.aggregate([{ $match: filter }, { $sort: buildSort(p.sort) }, { $skip: (p.page - 1) * p.pageSize }, { $limit: p.pageSize }, { $project: CARD_PROJECTION }]).toArray(),
    col.countDocuments(filter),
  ]);
  track(db, original, nearest ? 0 : total, fuzzy);
  return { items: await cardsFor(db, docs), total, page: p.page, pageSize: p.pageSize, unavailable: false, ...(fuzzy && { fuzzy }), ...(nearest && { nearest }) };
}

/** Listings picked for comparison, in the order asked. Anything no longer live is simply left out. */
export async function compareCards(db: Db, ids: string[]): Promise<PropertyCard[]> {
  const unique = [...new Set(ids)].slice(0, 4);
  if (!unique.length) return [];
  const docs = await propertiesCol(db).aggregate([{ $match: { ...liveFilter(new Date()), _id: { $in: unique } } }, { $project: CARD_PROJECTION }]).toArray();
  const cards = await cardsFor(db, docs);
  return unique.flatMap((id) => cards.filter((c) => c.id === id));
}

export type LocationPage = {
  name: string; countyName: string; countySlug: string; areaSlug: string | null; countyCode: number;
  counts: { sale: number; rent: number }; avgSale: number | null; avgRent: number | null;
  areas: { slug: string; name: string; count: number }[]; latest: PropertyCard[];
};

/** A county, or one area of it, for the location landing pages. Returns null when the place is unknown. */
export async function loadLocation(db: Db, countySlug: string, areaSlug: string | null): Promise<LocationPage | null> {
  const county = countyBySlug(countySlug);
  if (!county) return null;
  const match: Document = { ...liveFilter(new Date()), "location.countyCode": county.code };
  if (areaSlug) match["location.areaSlug"] = areaSlug;
  const col = propertiesCol(db);
  const [types, avgs, areas, latest] = await Promise.all([
    col.aggregate([{ $match: match }, { $group: { _id: "$listingType", n: { $sum: 1 } } }]).toArray(),
    col.aggregate([{ $match: { ...match, "price.amountKes": { $gt: 0 } } }, { $group: { _id: { t: "$listingType", p: "$price.period" }, avg: { $avg: "$price.amountKes" } } }]).toArray(),
    col.aggregate([{ $match: { ...liveFilter(new Date()), "location.countyCode": county.code, "location.areaSlug": { $type: "string" } } }, { $group: { _id: { s: "$location.areaSlug", n: "$location.areaName" }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 24 }]).toArray(),
    // Best match first (paid visibility included), not newest first.
    searchProperties(db, { countyCodes: [county.code], ...(areaSlug ? { areaSlugs: [areaSlug] } : {}), sort: "relevance", page: 1, pageSize: 12 }),
  ]);
  const n = (t: string) => Number(types.find((x) => x["_id"] === t)?.["n"] ?? 0);
  const avg = (t: string, period: string | null) => { const v = avgs.find((x) => x["_id"]?.t === t && (period === null || x["_id"]?.p === period))?.["avg"]; return typeof v === "number" ? Math.round(v) : null; };
  const areaList = areas.map((a) => ({ slug: str(a["_id"].s), name: str(a["_id"].n), count: Number(a["count"]) }));
  // An area nobody has listed in is not a page worth showing (and not one to index).
  if (areaSlug && !latest.items.length) return null;
  const cards = latest.items;
  const areaName = areaSlug ? cards[0]?.areaName ?? null : null;
  return {
    name: areaName ?? county.name, countyName: county.name, countySlug: county.slug, countyCode: county.code, areaSlug,
    counts: { sale: n("sale"), rent: n("rent") }, avgSale: avg("sale", null), avgRent: avg("rent", "month"),
    areas: areaList, latest: cards,
  };
}

export type MapPin = { id: string; slug: string; title: string; lat: number; lng: number; price: PriceDto | null; listingType: string; approximate: boolean; image: string | null; place: string };
/** Pins for the map view: the same filter as the list, capped, with hidden addresses rounded to the neighbourhood. */
export async function searchMapPins(db: Db, p: SearchParams): Promise<{ pins: MapPin[]; total: number }> {
  const base = buildSearchFilter(p);
  const filter = { ...base, "location.point": { ...(base["location.point"] as object | undefined), $exists: true } };
  const [docs, total] = await Promise.all([
    propertiesCol(db).aggregate([{ $match: filter }, { $sort: buildSort(p.sort) }, { $limit: 300 }, { $project: { slug: 1, title: 1, price: 1, listingType: 1, cover: { $arrayElemAt: ["$images", 0] }, "location.areaName": 1, "location.county": 1, "location.point": 1, "location.hideExactLocation": 1 } }]).toArray(),
    propertiesCol(db).countDocuments(filter),
  ]);
  const pins = docs.flatMap((d) => {
    const hide = (d["location"] as Document)?.["hideExactLocation"] === true;
    const pt = roundedPoint(d, hide);
    return pt ? [{ id: String(d["_id"]), slug: String(d["slug"]), title: String(d["title"]), lat: pt.lat, lng: pt.lng, price: d["price"] ? { amount: Number((d["price"] as Document)["amount"]), currency: str((d["price"] as Document)["currency"], "KES"), period: str((d["price"] as Document)["period"], "total"), negotiable: (d["price"] as Document)["negotiable"] === true } : null, listingType: String(d["listingType"]), approximate: hide, image: d["cover"] ? (imageDto(d["cover"] as Document).thumbUrl ?? imageDto(d["cover"] as Document).url) : null, place: [str((d["location"] as Document)?.["areaName"], ""), str((d["location"] as Document)?.["county"], "")].filter(Boolean).join(", ") }] : [];
  });
  return { pins, total };
}

/** Listings with a boost or a Premium package running at `now`. Reads the raw end dates, never the stored summary, so an ended run cannot linger. */
export const PAID_NOW = (now: Date): Document => ({ $or: [{ "promotion.boostUntil": { $gt: now } }, { "promotion.premiumUntil": { $gt: now } }] });

export type HomeData = { latest: PropertyCard[]; featured: PropertyCard[]; counties: { code: number; name: string; count: number }[]; counts: { sale: number; rent: number; short_stay: number } };
export async function loadHome(db: Db): Promise<HomeData> {
  const col = propertiesCol(db);
  const now = new Date();
  const live = liveFilter(now);
  const [latest, featured, counties, types] = await Promise.all([
    col.aggregate([{ $match: live }, { $sort: { publishedAt: -1, _id: 1 } }, { $limit: 8 }, { $project: CARD_PROJECTION }]).toArray(),
    col.aggregate([{ $match: { ...live, ...PAID_NOW(now) } }, { $sort: { publishedAt: -1 } }, { $limit: 6 }, { $project: CARD_PROJECTION }]).toArray(),
    col.aggregate([{ $match: live }, { $group: { _id: { code: "$location.countyCode", name: "$location.county" }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]).toArray(),
    col.aggregate([{ $match: live }, { $group: { _id: "$listingType", count: { $sum: 1 } } }]).toArray(),
  ]);
  const counts = { sale: 0, rent: 0, short_stay: 0 };
  for (const t of types) if (t["_id"] in counts) counts[t["_id"] as keyof typeof counts] = Number(t["count"]);
  return {
    latest: await cardsFor(db, latest), featured: await cardsFor(db, featured),
    counties: counties.filter((c) => c["_id"]?.code).map((c) => ({ code: Number(c["_id"].code), name: str(c["_id"].name), count: Number(c["count"]) })), counts,
  };
}

const roundedPoint = (d: Document, approximate: boolean) => {
  const c = ((d["location"] as Document | undefined)?.["point"] as Document | undefined)?.["coordinates"] as number[] | undefined;
  if (!c || c.length !== 2) return null;
  // Hidden locations are rounded to about a kilometre, so the map shows the neighbourhood and not the door.
  const r = (n: number) => (approximate ? Math.round(n * 100) / 100 : n);
  return { lat: r(c[1]!), lng: r(c[0]!) };
};

export async function loadPropertyDetail(db: Db, slug: string): Promise<{ property: PropertyDetail; similar: PropertyCard[]; moreFromAgency: PropertyCard[] } | null> {
  const d = await propertiesCol(db).findOne({ slug, ...liveFilter(new Date()) } as Filter<PropertyDocument>) as Document | null;
  if (!d) return null;
  const agencyId = str(d["agencyId"]);
  const [agency, member, related] = await Promise.all([
    db.collection("agencies").findOne({ _id: agencyId as never }),
    d["agentId"] ? db.collection("agencyMembers").findOne({ agencyId, userId: d["agentId"], status: "active" }) : null,
    import("./similar.server").then((m) => m.loadSimilar(db, d)).catch((e) => { console.error("loadSimilar", e); return { similar: [] as PropertyCard[], moreFromAgency: [] as PropertyCard[] }; }),
  ]);
  const agent = member && d["agentId"] ? await db.collection("users").findOne({ _id: d["agentId"] as never }, { projection: { username: 1 } }) : null;
  const agencies = new Map(agency ? [[agencyId, agency as Document]] : []);
  const loc = (d["location"] ?? {}) as Document;
  const hide = loc["hideExactLocation"] === true;
  const card = cardOf(d, agencies);
  const a = agency as Document | null;
  const property: PropertyDetail = {
    ...card, imageCount: Array.isArray(d["images"]) ? d["images"].length : 0, image: Array.isArray(d["images"]) && d["images"][0] ? imageDto(d["images"][0]) : null,
    description: str(d["description"]), highlights: (d["highlights"] as string[]) ?? [], features: (d["features"] as string[]) ?? [], customFeatures: (d["customFeatures"] as string[]) ?? [], nearby: ((d["nearby"] as Document[] | undefined) ?? []).map((n) => ({ category: str(n["category"]), name: str(n["name"]), distanceM: numOrNull(n["distanceM"]) })),
    images: ((d["images"] as Document[]) ?? []).map(imageDto), floorPlans: ((d["floorPlans"] as Document[]) ?? []).map(imageDto),
    videoUrl: typeof d["videoUrl"] === "string" ? d["videoUrl"] : null, virtualTourUrl: typeof d["virtualTourUrl"] === "string" ? d["virtualTourUrl"] : null,
    location: {
      county: typeof loc["county"] === "string" ? loc["county"] : null, countySlug: typeof loc["countySlug"] === "string" ? loc["countySlug"] : null, areaName: str(loc["areaName"]),
      areaSlug: typeof loc["areaSlug"] === "string" ? loc["areaSlug"] : null, address: hide ? null : typeof loc["address"] === "string" ? loc["address"] : null,
      landmark: typeof loc["landmark"] === "string" ? loc["landmark"] : null, point: roundedPoint(d, hide), approximate: hide,
    },
    details: json(d["details"]) ?? {}, legal: json(d["legal"]) ?? {},
    rental: json(d["rental"]), shortStay: json(d["shortStay"]), sale: json(d["sale"]),
    expiresAt: iso(d["expiresAt"]), stats: { views: numOrNull((d["stats"] as Document)?.["views"]) ?? 0, saves: numOrNull((d["stats"] as Document)?.["saves"]) ?? 0 },
    agencyProfile: a ? { ...(agencyBadge(a) as AgencyBadge), description: str(a["description"]), website: typeof (a["contact"] as Document)?.["website"] === "string" ? (a["contact"] as Document)["website"] : null, area: typeof (a["address"] as Document)?.["area"] === "string" ? (a["address"] as Document)["area"] : null } : null,
    agent: member ? { name: str(agent?.["username"], "Agent"), title: typeof member["title"] === "string" ? member["title"] : null, photoUrl: typeof member["photoUrl"] === "string" ? member["photoUrl"] : null } : null,
    contact: { hasPhone: true, hasWhatsapp: true },
  };
  return { property, ...related };
}

/** Public agency page: its profile and live listings. */
/**
 * The public agency profile: the agency's own story and details, its team, its rating, and its live listings.
 * The listings use the same filters as the main search, limited to this agency.
 */
export async function loadAgencyPage(db: Db, slug: string, p: SearchParams) {
  const a = await db.collection("agencies").findOne({ slug, status: "active" });
  if (!a) return null;
  const agencyId = String(a["_id"]);
  const filter = { ...buildSearchFilter(p), agencyId };
  const [docs, total, liveTotal, members, byType] = await Promise.all([
    propertiesCol(db).aggregate([{ $match: filter }, { $sort: buildSort(p.sort) }, { $skip: (p.page - 1) * p.pageSize }, { $limit: p.pageSize }, { $project: CARD_PROJECTION }]).toArray(),
    propertiesCol(db).countDocuments(filter as never),
    propertiesCol(db).countDocuments({ ...liveFilter(new Date()), agencyId } as never),
    db.collection("agencyMembers").find({ agencyId, status: "active" }).limit(24).toArray(),
    propertiesCol(db).aggregate([{ $match: { ...liveFilter(new Date()), agencyId } }, { $group: { _id: "$listingType", n: { $sum: 1 } } }]).toArray(),
  ]);
  const names = new Map((await db.collection("users").find({ _id: { $in: members.map((m) => m["userId"]) as never[] } }, { projection: { username: 1, avatar: 1 } }).toArray()).map((u) => [String(u["_id"]), u]));
  const badge = agencyBadge(a)!;
  const contact = (a["contact"] as Document) ?? {};
  const address = (a["address"] as Document) ?? {};
  const socials = (a["socials"] as Document) ?? {};
  const cover = a["cover"] as Document | null | undefined;
  return {
    agency: {
      ...badge, description: str(a["description"]), story: str(a["story"]), tagline: str(a["tagline"]), services: ((a["services"] as string[]) ?? []).map(String),
      hours: typeof a["hours"] === "string" ? a["hours"] : null, foundedYear: numOrNull(a["foundedYear"]), memberSince: iso(a["createdAt"]),
      cover: cover && typeof cover["url"] === "string" ? cover["url"] : null,
      website: typeof contact["website"] === "string" ? contact["website"] : null, area: typeof address["area"] === "string" ? address["area"] : null, countyCode: numOrNull(address["countyCode"]),
      serviceAreas: (a["serviceAreas"] as number[]) ?? [], teamSize: members.length, liveTotal,
      listingCounts: Object.fromEntries(byType.map((r) => [String(r["_id"]), Number(r["n"])])),
      socials: Object.fromEntries(["facebook", "instagram", "x", "tiktok", "linkedin", "youtube"].flatMap((k) => (typeof socials[k] === "string" ? [[k, socials[k] as string]] : []))) as Record<string, string>,
      id: agencyId,
    },
    team: members.map((m) => { const u = names.get(String(m["userId"])); return { name: str(u?.["username"]) || "Agent", title: typeof m["title"] === "string" ? m["title"] : null, photo: typeof m["photoUrl"] === "string" ? m["photoUrl"] : (u?.["avatar"] as Document | null | undefined)?.["url"] as string | undefined ?? null }; }),
    items: await cardsFor(db, docs), total, page: p.page, pageSize: p.pageSize,
  };
}

/* ───────────────────────────── Contact and analytics ───────────────────────────── */

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit/i;
const STAT_KEY: Partial<Record<EventKind, string>> = { view: "views", save: "saves", enquiry: "enquiries", phone_reveal: "phoneReveals", whatsapp_click: "whatsappClicks", share: "shares" };
const DEDUPED: EventKind[] = ["view", "phone_reveal", "whatsapp_click", "share"];
const DAILY_COUNTERS = ["impressions", "views", "uniqueViews", "saves", "enquiries", "phoneReveals", "whatsappClicks", "shares"] as const;
const deviceOf = (ua: string) => (/ipad|tablet/i.test(ua) ? "tablet" : /mobi|android|iphone/i.test(ua) ? "mobile" : ua ? "desktop" : "unknown");
const SOURCES = ["search", "category", "home", "agency", "direct", "external", "alert", "other"] as const;
export type EventSource = (typeof SOURCES)[number];
export const eventSources = SOURCES;

/**
 * Records one thing that happened to a listing: an event row, the listing's running total and the day's rollup.
 * Views, phone reveals and the like are counted once per visitor per day. Bots are ignored. Returns false if nothing was recorded.
 */
export async function recordEvent(db: Db, input: { property: Pick<PropertyDocument, "_id" | "agencyId" | "listingType" | "category"> & { location: { countyCode: number | null } }; kind: EventKind; userId: string | null; visitorId: string; source?: EventSource | undefined; ipHash?: string | undefined }): Promise<boolean> {
  const ua = getRequestHeader("user-agent") ?? "";
  if (BOT.test(ua)) return false;
  await ensureCollectionIndexes(db, ["propertyEvents", "propertyDailyStats"]);
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const visitorHash = await sha256(`hodii-visitor:${input.visitorId}`);
  const events = db.collection("propertyEvents");
  if (DEDUPED.includes(input.kind)) {
    const start = new Date(`${day}T00:00:00.000Z`);
    if (await events.findOne({ propertyId: input.property._id, visitorHash, kind: input.kind, occurredAt: { $gte: start } }, { projection: { _id: 1 } })) return false;
  }
  const { property } = input;
  await events.insertOne({
    _id: crypto.randomUUID() as never, schemaVersion: 1, propertyId: property._id, agencyId: property.agencyId, kind: input.kind, userId: input.userId, visitorHash,
    listingType: property.listingType, category: property.category, countyCode: property.location.countyCode, source: input.source ?? "other", device: deviceOf(ua), occurredAt: now, ...(input.ipHash && { ipHash: input.ipHash }),
  });
  const delta = input.kind === "unsave" ? -1 : 1;
  const key = input.kind === "unsave" ? "saves" : STAT_KEY[input.kind];
  if (key) await propertiesCol(db).updateOne({ _id: property._id }, { $inc: { [`stats.${key}`]: delta } } as never);
  const inc: Record<string, number> = Object.fromEntries(DAILY_COUNTERS.map((c) => [c, 0]));
  if (key && DAILY_COUNTERS.includes(key as never)) inc[key] = delta;
  if (input.kind === "view") inc["uniqueViews"] = 1;
  await db.collection("propertyDailyStats").updateOne(
    { propertyId: property._id, date: day },
    { $inc: inc, $set: { updatedAt: now }, $setOnInsert: { _id: `${property._id}:${day}`, schemaVersion: 1, agencyId: property.agencyId, listingType: property.listingType, category: property.category, countyCode: property.location.countyCode } } as never,
    { upsert: true },
  );
  return true;
}

export class RevealLimitError extends Error {}

/**
 * Scraping protection: one visitor may reveal only so many different listings' numbers in a day, and so may one network.
 * Revealing a listing already revealed today is free, so a person can come back to the number they just looked at.
 */
export async function checkRevealCap(db: Db, propertyId: string, visitorId: string, userId: string | null) {
  const ip = await hashIp("net");
  const visitorHash = await sha256(`hodii-visitor:${visitorId}`);
  const since = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const kinds = ["phone_reveal", "whatsapp_click"];
  const events = db.collection("propertyEvents");
  const [mine, net] = await Promise.all([
    events.distinct("propertyId", { visitorHash, kind: { $in: kinds }, occurredAt: { $gte: since } }),
    events.distinct("propertyId", { ipHash: ip, kind: { $in: kinds }, occurredAt: { $gte: since } }),
  ]);
  const cap = await revealLimits(userId !== null);
  if (!mine.includes(propertyId as never) && mine.length >= cap.perVisitor) return { ok: false as const, message: userId ? "You have viewed a lot of numbers today. Please message the agent on the listing or try again tomorrow." : "You have reached today's limit for viewing phone numbers. Sign in to see more, or send the agent an enquiry." };
  if (!net.includes(propertyId as never) && net.length >= cap.perNetwork) return { ok: false as const, message: "Too many numbers have been viewed from this connection today. Try again tomorrow, or send the agent an enquiry." };
  return { ok: true as const, ipHash: ip };
}

/** The phone numbers are never in the page: they are fetched when someone asks, which is also what lets us count that. */
export async function revealContact(db: Db, propertyId: string, visitorId: string, userId: string | null, via: "phone" | "whatsapp") {
  const p = await propertiesCol(db).findOne({ _id: propertyId, ...liveFilter(new Date()) } as Filter<PropertyDocument>);
  if (!p) return null;
  const [agency, member] = await Promise.all([
    db.collection("agencies").findOne({ _id: p.agencyId as never }, { projection: { contact: 1, name: 1 } }),
    p.agentId ? db.collection("agencyMembers").findOne({ agencyId: p.agencyId, userId: p.agentId, status: "active" }, { projection: { phone: 1, whatsapp: 1 } }) : null,
  ]);
  const reveal = await checkRevealCap(db, p._id, visitorId, userId);
  if (!reveal.ok) throw new RevealLimitError(reveal.message);
  const contact = (agency?.["contact"] ?? {}) as Document;
  const phone = p.contactPhone ?? str(member?.["phone"]) ?? str(contact["phone"]);
  const resolvedPhone = p.contactPhone ?? (str(member?.["phone"]) || str(contact["phone"]));
  const whatsapp = str(member?.["whatsapp"]) || str(contact["whatsapp"]) || resolvedPhone;
  void phone;
  await recordEvent(db, { property: p, kind: via === "phone" ? "phone_reveal" : "whatsapp_click", userId, visitorId, source: "other", ipHash: reveal.ipHash });
  return { phone: resolvedPhone, whatsapp, name: str(agency?.["name"]), reference: p.referenceCode, title: p.title };
}

/* ───────────────────────────── Saves, enquiries, reports ───────────────────────────── */

export async function toggleSave(db: Db, user: { id: string }, propertyId: string, visitorId: string) {
  await ensurePropertyIndexes(db);
  const col = db.collection("savedProperties");
  const existing = await col.findOne({ userId: user.id, propertyId });
  const property = await propertiesCol(db).findOne({ _id: propertyId } as Filter<PropertyDocument>);
  if (!property) throw new Error("This listing no longer exists");
  if (existing) {
    await col.deleteOne({ _id: existing["_id"] });
    await recordEvent(db, { property, kind: "unsave", userId: user.id, visitorId });
    return { saved: false };
  }
  if (property.status !== "published") throw new Error("This listing is no longer available");
  if ((await col.countDocuments({ userId: user.id })) >= SAVED_LIMITS.propertiesPerUser) throw new Error(`You can save up to ${SAVED_LIMITS.propertiesPerUser} properties`);
  try { await col.insertOne({ _id: crypto.randomUUID() as never, schemaVersion: 1, userId: user.id, propertyId, priceAtSave: property.price?.amount ?? null, createdAt: new Date() }); }
  catch (e) { if ((e as { code?: number }).code !== 11000) throw e; return { saved: true }; }
  await recordEvent(db, { property, kind: "save", userId: user.id, visitorId });
  return { saved: true };
}

export async function savedIds(db: Db, userId: string, ids: string[]) {
  if (!ids.length) return [] as string[];
  const rows = await db.collection("savedProperties").find({ userId, propertyId: { $in: ids } }, { projection: { propertyId: 1 } }).toArray();
  return rows.map((r) => str(r["propertyId"]));
}

export async function listSaved(db: Db, userId: string) {
  const saves = await db.collection("savedProperties").find({ userId }).sort({ createdAt: -1 }).limit(SAVED_LIMITS.propertiesPerUser).toArray();
  const ids = saves.map((s) => str(s["propertyId"]));
  const docs = ids.length ? await propertiesCol(db).aggregate([{ $match: { _id: { $in: ids }, ...liveFilter(new Date()) } }, { $project: CARD_PROJECTION }]).toArray() : [];
  const cards = await cardsFor(db, docs);
  const order = new Map(ids.map((id, i) => [id, i]));
  cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { items: cards, unavailable: ids.length - cards.length };
}

export type EnquiryInput = { propertyId: string; name: string; email: string; phone: string | null; message: string; preferredViewingAt: Date | null };
export async function createEnquiry(db: Db, input: EnquiryInput, user: { id: string } | null, visitorId: string) {
  await ensurePropertyIndexes(db);
  const ip = await hashIp("enquiry");
  const hourAgo = new Date(Date.now() - 3_600_000);
  if ((await db.collection("enquiries").countDocuments({ ipHash: ip, createdAt: { $gte: hourAgo } })) >= 5) return { ok: false as const, error: "You have sent several enquiries in a short time. Please try again in an hour." };
  const p = await propertiesCol(db).findOne({ _id: input.propertyId, ...liveFilter(new Date()) } as Filter<PropertyDocument>);
  if (!p) return { ok: false as const, error: "This listing is no longer available." };
  const agency = await db.collection("agencies").findOne({ _id: p.agencyId as never, status: "active" }, { projection: { _id: 1 } });
  if (!agency) return { ok: false as const, error: "This agency is not accepting enquiries right now." };
  const now = new Date();
  const doc = enquirySchema.parse({
    _id: crypto.randomUUID(), schemaVersion: 1, propertyId: p._id, agencyId: p.agencyId, propertyRef: p.referenceCode, propertyTitle: p.title.slice(0, 100),
    agentId: p.agentId, userId: user?.id ?? null, name: input.name, emailEnc: await encrypt(input.email.toLowerCase()), phoneEnc: input.phone ? await encrypt(input.phone) : null,
    message: input.message, channel: "form", preferredViewingAt: input.preferredViewingAt, consent: true, status: "new", assignedTo: p.agentId, notes: [], firstResponseAt: null, ipHash: ip, createdAt: now, updatedAt: now,
  });
  await db.collection("enquiries").insertOne(doc as never);
  await recordEvent(db, { property: p, kind: "enquiry", userId: user?.id ?? null, visitorId });
  try {
    const { notify, agencyPeople } = await import("./notifications.server");
    await notify(db, await agencyPeople(db, p.agencyId, ["owner", "admin"], [p.agentId]), { kind: "enquiry", title: `New enquiry: ${p.title.slice(0, 80)}`, body: `${input.name} wrote to you about ${p.referenceCode}.`, link: `/dashboard/agency/${(await db.collection("agencies").findOne({ _id: p.agencyId as never }, { projection: { slug: 1 } }))?.["slug"] ?? ""}/enquiries` });
  } catch (e) { console.error("enquiry notification", e); }
  return { ok: true as const };
}

export async function createReport(db: Db, input: { propertyId: string; reason: string; details: string | null }, user: { id: string } | null) {
  await ensurePropertyIndexes(db);
  const ip = await hashIp("report");
  if ((await db.collection("listingReports").countDocuments({ reporterIpHash: ip, createdAt: { $gte: new Date(Date.now() - 3_600_000) } })) >= 10) return { ok: false as const, error: "Too many reports from this connection. Please try again later." };
  const p = await propertiesCol(db).findOne({ _id: input.propertyId } as Filter<PropertyDocument>, { projection: { agencyId: 1 } });
  if (!p) return { ok: false as const, error: "This listing no longer exists." };
  await db.collection("listingReports").insertOne({ _id: crypto.randomUUID() as never, schemaVersion: 1, propertyId: input.propertyId, agencyId: p.agencyId, reporterUserId: user?.id ?? null, reporterIpHash: ip, reason: input.reason, details: input.details, status: "open", handledBy: null, handledAt: null, resolution: null, createdAt: new Date() });
  return { ok: true as const };
}

/** Enquiries decrypted for the agency dashboard. */
export async function readEnquiry(d: Document) {
  return {
    id: str(d["_id"]), propertyId: str(d["propertyId"]), propertyRef: str(d["propertyRef"]), propertyTitle: str(d["propertyTitle"]), name: str(d["name"]),
    email: await decrypt(str(d["emailEnc"])), phone: d["phoneEnc"] ? await decrypt(str(d["phoneEnc"])) : null, message: str(d["message"]),
    preferredViewingAt: iso(d["preferredViewingAt"]), status: str(d["status"], "new"), assignedTo: typeof d["assignedTo"] === "string" ? d["assignedTo"] : null, agentId: typeof d["agentId"] === "string" ? d["agentId"] : null,
    notes: ((d["notes"] as Document[]) ?? []).map((n) => ({ id: str(n["id"]), authorId: str(n["authorId"]), text: str(n["text"]), createdAt: iso(n["createdAt"]) ?? "" })),
    firstResponseAt: iso(d["firstResponseAt"]), createdAt: iso(d["createdAt"]) ?? "",
  };
}
export const ENQUIRY_INPUT_LIMITS = ENQUIRY_LIMITS;
export { searchProperties as _search };

export type AgencyDirectoryParams = { q?: string | undefined; countyCode?: number | undefined; kind?: string | undefined; verifiedOnly?: boolean | undefined; sort: "rating" | "listings" | "newest" | "name"; page: number };
export const DIRECTORY_PAGE_SIZE = 18;

/** The agencies directory. Counts live listings only for the page being shown, so it stays cheap. */
export async function loadAgencyDirectory(db: Db, p: AgencyDirectoryParams) {
  const filter: Document = { status: "active" };
  if (p.q) filter["name"] = { $regex: escapeRegex(p.q), $options: "i" };
  if (p.kind) filter["kind"] = p.kind;
  if (p.verifiedOnly) filter["verification.status"] = "verified";
  if (p.countyCode) filter["$or"] = [{ "address.countyCode": p.countyCode }, { serviceAreas: p.countyCode }];
  const col = db.collection("agencies");
  const sort: Document = p.sort === "rating" ? { "rating.avg": -1, "rating.count": -1, name: 1 } : p.sort === "newest" ? { createdAt: -1 } : { name: 1 };
  // "Most listings" needs the counts first, so it ranks a wider set and then pages it.
  const wide = p.sort === "listings";
  const [rows, total] = await Promise.all([
    col.find(filter).sort(wide ? { name: 1 } : sort).skip(wide ? 0 : (p.page - 1) * DIRECTORY_PAGE_SIZE).limit(wide ? 300 : DIRECTORY_PAGE_SIZE).toArray(),
    col.countDocuments(filter),
  ]);
  const counts = new Map((await propertiesCol(db).aggregate([{ $match: { ...liveFilter(new Date()), agencyId: { $in: rows.map((r) => String(r["_id"])) } } }, { $group: { _id: "$agencyId", n: { $sum: 1 } } }]).toArray()).map((r) => [String(r["_id"]), Number(r["n"])]));
  let list = rows.map((a) => ({ ...(agencyBadge(a) as AgencyBadge), tagline: str(a["tagline"]), area: typeof (a["address"] as Document)?.["area"] === "string" ? (a["address"] as Document)["area"] as string : null, countyCode: numOrNull((a["address"] as Document)?.["countyCode"]), listings: counts.get(String(a["_id"])) ?? 0 }));
  if (wide) list = list.sort((x, y) => y.listings - x.listings).slice((p.page - 1) * DIRECTORY_PAGE_SIZE, p.page * DIRECTORY_PAGE_SIZE);
  return { items: list, total, page: p.page, pageSize: DIRECTORY_PAGE_SIZE };
}
