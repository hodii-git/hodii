import { z } from "zod";
import { LISTING_LIMITS, USD_TO_KES_DEFAULT, toKes } from "./mongodb/limits";
import { countyByCode, toSlug } from "./mongodb/kenya";
import { buildListingSlug, listingExpiry } from "./mongodb/property-rules";
import { detailsSchema, imageSchema, legalSchema, priceSchema, rentalSchema, saleSchema, shortStaySchema, type PropertyDocument } from "./mongodb/property-schemas";
import { LISTING_TYPE_KEYS, NEARBY_KEYS, PROPERTY_TYPE_KEYS, FEATURE_KEYS, propertyTypeInfo, toSqm, type ListingStatus } from "./mongodb/taxonomy";

/**
 * What the listing form submits, and how it becomes a stored listing.
 * The form is deliberately forgiving (a draft can be half-filled); `composeListing` fills in everything the system owns
 * (ids, slug, county names, converted prices, photo order, dates) and the result is then checked by `propertySchema`.
 */
const looseImage = imageSchema.innerType().omit({ order: true });

export const listingFormSchema = z.object({
  agentId: z.string().max(64).nullable(),
  externalRef: z.string().trim().max(LISTING_LIMITS.externalRefMax).nullable(),
  listingType: z.enum(LISTING_TYPE_KEYS),
  propertyType: z.enum(PROPERTY_TYPE_KEYS),
  title: z.string().trim().max(LISTING_LIMITS.titleMax),
  description: z.string().trim().max(LISTING_LIMITS.descriptionMax),
  highlights: z.array(z.string().trim().min(1).max(LISTING_LIMITS.highlightMax)).max(LISTING_LIMITS.highlightsMax),
  price: priceSchema.omit({ amountKes: true }).nullable(),
  location: z.object({
    countyCode: z.number().int().min(1).max(47).nullable(),
    subCounty: z.string().trim().max(60).nullable(),
    areaName: z.string().trim().max(LISTING_LIMITS.areaNameMax),
    address: z.string().trim().max(LISTING_LIMITS.addressMax).nullable(),
    landmark: z.string().trim().max(LISTING_LIMITS.landmarkMax).nullable(),
    point: z.object({ lat: z.number(), lng: z.number() }).nullable(),
    hideExactLocation: z.boolean(),
  }).strict(),
  details: detailsSchema.omit({ plotAreaSqm: true }),
  legal: legalSchema,
  rental: rentalSchema.omit({ availableFrom: true }).extend({ availableFrom: z.string().datetime({ offset: true }).nullable() }).nullable(),
  shortStay: shortStaySchema.nullable(),
  sale: saleSchema.nullable(),
  features: z.array(z.enum(FEATURE_KEYS)).max(LISTING_LIMITS.featuresMax),
  customFeatures: z.array(z.string().trim().min(1).max(LISTING_LIMITS.customFeatureMax)).max(LISTING_LIMITS.customFeaturesMax),
  nearby: z.array(z.object({ category: z.enum(NEARBY_KEYS), name: z.string().trim().min(2).max(LISTING_LIMITS.nearbyNameMax), distanceM: z.number().int().min(10).max(LISTING_LIMITS.nearbyMaxMeters).nullable() }).strict()).max(LISTING_LIMITS.nearbyMax),
  images: z.array(looseImage).max(LISTING_LIMITS.imagesMax),
  floorPlans: z.array(looseImage).max(LISTING_LIMITS.floorPlansMax),
  videoUrl: z.string().max(500).regex(/^https:\/\//).nullable(),
  virtualTourUrl: z.string().max(500).regex(/^https:\/\//).nullable(),
  contactPhone: z.string().nullable(),
}).strict();
export type ListingForm = z.infer<typeof listingFormSchema>;

export type ComposeArgs = {
  form: ListingForm;
  existing: PropertyDocument | null;
  agencyId: string; userId: string; now: Date;
  /** The status this save should leave the listing in; null keeps the current one (or draft for a new listing). */
  status: ListingStatus | null;
  /** Only for a new listing. */
  newId?: string; referenceCode?: string;
  usdRate?: number;
};

const ordered = <T extends object>(items: readonly T[]) => items.map((it, order) => ({ ...it, order }));

export function composeListing(a: ComposeArgs): PropertyDocument {
  const { form, existing, now } = a;
  const info = propertyTypeInfo(form.propertyType);
  const category = info?.category ?? "residential";
  const county = form.location.countyCode ? countyByCode(form.location.countyCode) : undefined;
  const areaSlug = toSlug(form.location.areaName) || null;
  const rate = a.usdRate ?? USD_TO_KES_DEFAULT;

  const price = form.price ? { ...form.price, amountKes: toKes(form.price.amount, form.price.currency, rate) } : null;
  // Previous prices are kept so a later drop can be shown.
  let priceHistory = existing?.priceHistory ?? [];
  if (existing?.price && price && existing.price.amount !== price.amount) {
    priceHistory = [...priceHistory, { amount: existing.price.amount, changedAt: now }].slice(-LISTING_LIMITS.priceHistoryMax);
  }

  const { plotAreaValue, plotAreaUnit } = form.details;
  const details = { ...form.details, plotAreaSqm: plotAreaValue && plotAreaUnit ? toSqm(plotAreaValue, plotAreaUnit) : null };

  const status = a.status ?? existing?.status ?? "draft";
  const becomesLive = status === "published";
  const wasLive = existing?.status === "published";
  const needsFreshExpiry = becomesLive && (!wasLive || !existing?.expiresAt || existing.expiresAt < now);

  const base = existing ?? null;
  const id = base?._id ?? a.newId ?? crypto.randomUUID();
  const referenceCode = base?.referenceCode ?? a.referenceCode ?? "";
  return {
    _id: id, schemaVersion: 1,
    // The address of a listing stays stable once it exists, so shared links keep working.
    slug: base?.slug ?? buildListingSlug({ listingType: form.listingType, propertyType: form.propertyType, bedrooms: form.details.bedrooms, areaSlug: areaSlug ?? "kenya", countySlug: county?.slug ?? "kenya", referenceCode }),
    referenceCode, agencyId: a.agencyId, createdBy: base?.createdBy ?? a.userId, agentId: form.agentId, externalRef: form.externalRef || null,
    source: base?.source ?? { kind: "manual", url: null, externalId: null, importedAt: null },
    listingType: form.listingType, category, propertyType: form.propertyType,
    title: form.title, description: form.description, highlights: form.highlights,
    price, priceHistory,
    location: {
      countyCode: county?.code ?? null, county: county?.name ?? null, countySlug: county?.slug ?? null, subCounty: form.location.subCounty || null,
      areaName: form.location.areaName, areaSlug, address: form.location.address || null, landmark: form.location.landmark || null,
      ...(form.location.point ? { point: { type: "Point" as const, coordinates: [form.location.point.lng, form.location.point.lat] } } : {}),
      hideExactLocation: form.location.hideExactLocation,
    },
    details,
    legal: form.legal,
    // Only the terms that belong to this kind of listing are kept.
    rental: form.listingType === "rent" ? (form.rental ? { ...form.rental, availableFrom: form.rental.availableFrom ? new Date(form.rental.availableFrom) : null } : null) : null,
    shortStay: form.listingType === "short_stay" ? form.shortStay : null,
    sale: form.listingType === "sale" ? form.sale : null,
    features: form.features, customFeatures: form.customFeatures, nearby: form.nearby,
    images: ordered(form.images), floorPlans: ordered(form.floorPlans), videoUrl: form.videoUrl, virtualTourUrl: form.virtualTourUrl,
    contactPhone: form.contactPhone,
    status, closedReason: base?.closedReason && status === "closed" ? base.closedReason : null,
    moderation: base?.moderation ?? { reviewedBy: null, reviewedAt: null, rejectionReason: null },
    verified: base?.verified ?? { isVerified: false, verifiedAt: null },
    promotion: base?.promotion ?? { tier: "none", until: null },
    stats: base?.stats ?? { views: 0, saves: 0, enquiries: 0, phoneReveals: 0, whatsappClicks: 0, shares: 0 },
    createdAt: base?.createdAt ?? now, updatedAt: now,
    publishedAt: becomesLive ? (needsFreshExpiry ? now : base?.publishedAt ?? now) : base?.publishedAt ?? null,
    expiresAt: needsFreshExpiry ? listingExpiry(now) : base?.expiresAt ?? null,
    lastConfirmedAt: becomesLive ? now : base?.lastConfirmedAt ?? null,
  } as PropertyDocument;
}

/** An empty form for "Add a listing". */
export function blankListingForm(): ListingForm {
  return {
    agentId: null, externalRef: null, listingType: "rent", propertyType: "apartment", title: "", description: "", highlights: [], price: null,
    location: { countyCode: null, subCounty: null, areaName: "", address: null, landmark: null, point: null, hideExactLocation: false },
    details: { bedrooms: null, bathrooms: null, ensuiteBedrooms: null, servantQuarters: null, parkingSpaces: null, floorAreaSqm: null, plotAreaValue: null, plotAreaUnit: null, floorLevel: null, totalFloors: null, yearBuilt: null, condition: null, furnishing: null, zoning: null },
    legal: { titleType: null, leaseYearsRemaining: null, titleDeedReady: null },
    rental: null, shortStay: null, sale: null, features: [], customFeatures: [], nearby: [], images: [], floorPlans: [], videoUrl: null, virtualTourUrl: null, contactPhone: null,
  };
}

/** The reverse of composeListing: a stored listing as form values. */
export function formFromListing(p: PropertyDocument): ListingForm {
  const { plotAreaSqm: _drop, ...details } = p.details;
  return {
    agentId: p.agentId, externalRef: p.externalRef, listingType: p.listingType, propertyType: p.propertyType, title: p.title, description: p.description, highlights: p.highlights,
    price: p.price ? { amount: p.price.amount, currency: p.price.currency, period: p.price.period, negotiable: p.price.negotiable } : null,
    location: { countyCode: p.location.countyCode, subCounty: p.location.subCounty, areaName: p.location.areaName, address: p.location.address, landmark: p.location.landmark, point: p.location.point ? { lat: p.location.point.coordinates[1]!, lng: p.location.point.coordinates[0]! } : null, hideExactLocation: p.location.hideExactLocation },
    details, legal: p.legal,
    rental: p.rental ? { ...p.rental, availableFrom: p.rental.availableFrom ? p.rental.availableFrom.toISOString() : null } : null,
    shortStay: p.shortStay, sale: p.sale, features: p.features, customFeatures: p.customFeatures, nearby: p.nearby ?? [],
    images: p.images.map(({ order: _o, ...i }) => i), floorPlans: p.floorPlans.map(({ order: _o, ...i }) => i), videoUrl: p.videoUrl, virtualTourUrl: p.virtualTourUrl, contactPhone: p.contactPhone,
  };
}
