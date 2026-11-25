import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchParamsSchema } from "./mongodb/property-schemas";
import { ENQUIRY_LIMITS } from "./mongodb/limits";
import { REPORT_REASON_KEYS } from "./mongodb/taxonomy";
import type { SearchParams } from "./listing-search";

const server = () => import("./properties.server");
const db = () => import("./community.server");
const auth = () => import("./auth.server");
const cdn = async (s: number, swr: number) => (await import("./cdn-cache.server")).cachePublic(s, swr);
const unavailable = () => ({ items: [], total: 0, page: 1, pageSize: 24, unavailable: true as const });
const visitor = z.string().min(8).max(64);
const idSchema = z.string().min(1).max(64);

/** Public listing search. Cached at the edge for a minute: listings change slowly, searches repeat a lot. */
export const searchListings = createServerFn({ method: "GET" })
  .inputValidator((d) => searchParamsSchema.parse(d))
  .handler(async ({ data }) => {
    await cdn(60, 300);
    try {
      const { withDb } = await db();
      const { searchProperties } = await server();
      return await withDb((d) => searchProperties(d, data as SearchParams));
    } catch (e) {
      console.error("searchListings", e);
      return { ...unavailable(), page: data.page, pageSize: data.pageSize };
    }
  });
/** Pins for the map view. Same filters as the list, so the map and the list never disagree. */
export const searchMapPins = createServerFn({ method: "GET" })
  .inputValidator((d) => searchParamsSchema.parse(d))
  .handler(async ({ data }) => {
    await cdn(60, 300);
    try {
      const { withDb } = await db();
      const { searchMapPins: run } = await server();
      return await withDb((d) => run(d, { ...(data as SearchParams), page: 1 }));
    } catch (e) { console.error("searchMapPins", e); return { pins: [], total: 0 }; }
  });
export const mapPinsQuery = (p: SearchParams) => queryOptions({ queryKey: ["map-pins", { ...p, page: 1, sort: "newest" }], queryFn: () => searchMapPins({ data: { ...p, page: 1, sort: "newest" } }), staleTime: 60_000 });

export const searchQuery = (p: SearchParams) => queryOptions({ queryKey: ["listings", p], queryFn: () => searchListings({ data: p }), staleTime: 60_000 });

/** The listings on the compare page. Public and cached briefly: the same pick gives the same answer. */
export const getCompare = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ ids: z.array(idSchema).min(1).max(4) }).parse(d))
  .handler(async ({ data }) => {
    await cdn(60, 300);
    try { const { withDb } = await db(); const { compareCards } = await server(); return await withDb((d) => compareCards(d, data.ids)); }
    catch (e) { console.error("getCompare", e); return [] as import("./property-dto").PropertyCard[]; }
  });

export const getLocation = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ county: z.string().min(1).max(60), area: z.string().min(1).max(80).nullable() }).parse(d))
  .handler(async ({ data }) => {
    await cdn(300, 1800);
    const { withDb } = await db(); const { loadLocation } = await server();
    return withDb((d) => loadLocation(d, data.county, data.area));
  });
export const locationQuery = (county: string, area: string | null) => queryOptions({ queryKey: ["location", county, area], queryFn: () => getLocation({ data: { county, area } }), staleTime: 300_000 });

export const getHome = createServerFn({ method: "GET" }).handler(async () => {
  await cdn(120, 600);
  try {
    const { withDb } = await db();
    const { loadHome } = await server();
    return { ...(await withDb(loadHome)), unavailable: false as const };
  } catch (e) {
    console.error("getHome", e);
    return { latest: [], featured: [], counties: [], counts: { sale: 0, rent: 0, short_stay: 0 }, unavailable: true as const };
  }
});
export const homeQuery = queryOptions({ queryKey: ["property-home"], queryFn: () => getHome(), staleTime: 120_000 });

/**
 * The home page's lists for one visitor's place. With a chosen area or county the answer is the same for everyone choosing it, so the
 * edge may keep it; with a position or the visitor's own city it is private to them and never cached.
 */
export const getNearbyHome = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ areaSlug: z.string().regex(/^[a-z0-9-]+$/).max(100).optional(), countyCode: z.number().int().min(1).max(47).optional(), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { withDb } = await db();
    const h = await import("./home-nearby.server");
    const chosen = !!(data.areaSlug || data.countyCode) && data.lat === undefined;
    const fromHeaders = !chosen && data.lat === undefined;
    if (chosen) await cdn(120, 600);
    try {
      return await withDb(async (d) => {
        const city = fromHeaders && h.countryFromHeaders() !== null && ["KE", null].includes(h.countryFromHeaders()) ? h.cityFromHeaders() ?? undefined : undefined;
        return h.loadNearbyHome(d, await h.resolvePlace(d, { ...data, city }));
      });
    } catch (e) {
      console.error("getNearbyHome", e);
      return { place: null, featured: [], latest: [], featuredScopes: [], latestScopes: [] };
    }
  });

export const getProperty = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    await cdn(60, 600);
    const { withDb } = await db();
    const { loadPropertyDetail } = await server();
    return withDb((d) => loadPropertyDetail(d, data.slug));
  });
export const propertyQuery = (slug: string) => queryOptions({ queryKey: ["property", slug], queryFn: () => getProperty({ data: { slug } }), staleTime: 60_000 });

export const getAgencyPage = createServerFn({ method: "GET" })
  .inputValidator((d) => {
    // The slug is not a search field, so it is split off before the strict search schema sees the rest.
    const { slug, ...rest } = z.object({ slug: z.string().min(1).max(120) }).passthrough().parse(d);
    return { ...searchParamsSchema.parse(rest), slug };
  })
  .handler(async ({ data }) => {
    await cdn(60, 600);
    const { withDb } = await db();
    const { loadAgencyPage } = await server();
    const { slug, ...params } = data;
    return withDb((d) => loadAgencyPage(d, slug, params as SearchParams));
  });
export const agencyPageQuery = (slug: string, params: SearchParams) => queryOptions({ queryKey: ["agency-page", slug, params], queryFn: () => getAgencyPage({ data: { ...params, slug } }), staleTime: 60_000 });

/** Counts a view of a listing. Called once from the browser after the page shows; never blocks the page. */
export const trackListingEvent = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ propertyId: idSchema, kind: z.enum(["view", "share"]), visitorId: visitor, source: z.enum(["search", "category", "home", "agency", "direct", "external", "alert", "other"]).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { withDb } = await db();
    const { currentUser } = await auth();
    const { propertiesCol, recordEvent } = await server();
    const me = await currentUser().catch(() => null);
    return withDb(async (d) => {
      const p = await propertiesCol(d).findOne({ _id: data.propertyId, status: "published" } as never);
      if (!p) return { recorded: false };
      return { recorded: await recordEvent(d, { property: p, kind: data.kind, userId: me?.id ?? null, visitorId: data.visitorId, source: data.source }) };
    });
  });

/** Phone numbers stay out of the page until someone asks for them. */
export const revealListingContact = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ propertyId: idSchema, via: z.enum(["phone", "whatsapp"]), visitorId: visitor }).parse(d))
  .handler(async ({ data }) => {
    const { withDb } = await db();
    const { currentUser } = await auth();
    const { revealContact } = await server();
    const me = await currentUser().catch(() => null);
    const out = await withDb((d) => revealContact(d, data.propertyId, data.visitorId, me?.id ?? null, data.via));
    if (!out) throw new Error("This listing is no longer available");
    return out;
  });

export const toggleSavedListing = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ propertyId: idSchema, visitorId: visitor }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, authDb } = await auth();
    const { toggleSave } = await server();
    const me = await requireUser();
    return authDb((d) => toggleSave(d, me, data.propertyId, data.visitorId));
  });

export const getSavedState = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ids: z.array(idSchema).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const { currentUser, authDb } = await auth();
    const { savedIds } = await server();
    const me = await currentUser().catch(() => null);
    if (!me) return { signedIn: false as const, saved: [] as string[] };
    return { signedIn: true as const, saved: await authDb((d) => savedIds(d, me.id, data.ids)) };
  });

export const getSavedListings = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser, authDb } = await auth();
  const { listSaved } = await server();
  const me = await requireUser();
  return authDb((d) => listSaved(d, me.id));
});

export const enquiryInput = z.object({
  propertyId: idSchema, visitorId: visitor,
  name: z.string().trim().min(ENQUIRY_LIMITS.nameMin).max(ENQUIRY_LIMITS.nameMax),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(20).nullable(),
  message: z.string().trim().min(ENQUIRY_LIMITS.messageMin).max(ENQUIRY_LIMITS.messageMax),
  preferredViewingAt: z.string().datetime().nullable(),
  consent: z.literal(true, { errorMap: () => ({ message: "Please agree to share your details with the agency" }) }),
  /** Honeypot: real people leave this empty. */
  website: z.string().max(0).optional(),
});

export const sendEnquiry = createServerFn({ method: "POST" })
  .inputValidator((d) => enquiryInput.parse(d))
  .handler(async ({ data }) => {
    const { authDb, currentUser } = await auth();
    const { normalizeKenyaPhone } = await import("./mongodb/kenya");
    const { createEnquiry } = await server();
    const me = await currentUser().catch(() => null);
    let phone: string | null = null;
    if (data.phone) {
      phone = normalizeKenyaPhone(data.phone);
      if (!phone) return { ok: false as const, error: "Enter a Kenyan phone number, like 0712 345 678." };
    }
    return authDb((d) => createEnquiry(d, { propertyId: data.propertyId, name: data.name, email: data.email, phone, message: data.message, preferredViewingAt: data.preferredViewingAt ? new Date(data.preferredViewingAt) : null }, me, data.visitorId));
  });

export const reportListing = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ propertyId: idSchema, reason: z.enum(REPORT_REASON_KEYS), details: z.string().trim().max(1000).nullable() }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, currentUser } = await auth();
    const { createReport } = await server();
    const me = await currentUser().catch(() => null);
    return authDb((d) => createReport(d, data, me));
  });

export const getAgencyDirectory = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().trim().max(80).optional(), countyCode: z.number().int().min(1).max(47).optional(), kind: z.string().max(30).optional(), verifiedOnly: z.boolean().optional(), sort: z.enum(["rating", "listings", "newest", "name"]).default("rating"), page: z.number().int().min(1).max(200).default(1) }).parse(d))
  .handler(async ({ data }) => {
    await cdn(60, 600);
    try {
      const { withDb } = await db();
      const { loadAgencyDirectory } = await server();
      return await withDb((d) => loadAgencyDirectory(d, data));
    } catch (e) { console.error("agency directory", e); return { items: [], total: 0, page: 1, pageSize: 18 }; }
  });
export const agencyDirectoryQuery = (p: z.input<typeof directoryShape>) => queryOptions({ queryKey: ["agency-directory", p], queryFn: () => getAgencyDirectory({ data: p as never }), staleTime: 60_000 });
const directoryShape = z.object({ q: z.string().optional(), countyCode: z.number().optional(), kind: z.string().optional(), verifiedOnly: z.boolean().optional(), sort: z.string().optional(), page: z.number().optional() });
