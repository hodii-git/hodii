import { z } from "zod";
import { AGENCY_LIMITS, DEVELOPMENT_LIMITS, ENQUIRY_LIMITS, LISTING_LIMITS, REPORT_LIMITS, SAVED_LIMITS } from "./limits";
import { E164_KENYA, inKenya } from "./kenya";
import { consistencyIssues, publishIssues, REFERENCE_CODE } from "./property-rules";
import {
  AGENCY_KIND_KEYS, ALERT_FREQUENCIES, AREA_UNITS, CONDITION_KEYS, CLOSED_REASONS, FREEZE_REASONS, CURRENCIES, DEVELOPMENT_STATUSES, ENQUIRY_CHANNELS,
  ENQUIRY_STATUSES, EVENT_KINDS, FEATURE_KEYS, FURNISHING_KEYS, LAND_ZONINGS, LISTING_STATUSES, LISTING_TYPE_KEYS, MEMBER_ROLES,
  MEMBER_STATUSES, NEARBY_KEYS, PAYMENT_PLANS, PRICE_PERIODS, PROMOTION_TIERS, PROPERTY_CATEGORY_KEYS, PROPERTY_TYPE_KEYS, PUBLISH_STATUSES,
  REPORT_REASON_KEYS, REPORT_STATUSES, TITLE_TYPE_KEYS, UTILITY_KEYS, VERIFICATION_STATUSES,
} from "./taxonomy";

/*
 * Hodii's property data model.
 * - Documents are keyed by `_id` (a UUID string). Application code exposes it as `id`.
 * - Dates are BSON Dates in the database (see scripts/generate-mongodb-schema.ts); they are `z.date()` here.
 * - Anything personal (email, phone of an enquirer) is stored encrypted as `...Enc`, never in plain text.
 * - Nullable means "not provided"; a field is only absent when it does not apply.
 */

const id = z.string().min(1).max(64);
const slug = z.string().min(1).max(LISTING_LIMITS.slugMax).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const count = z.number().int().min(0);
const date = z.date();
const httpsUrl = z.string().max(500).regex(/^https:\/\//, "Use a secure https:// address");
const phone = z.string().regex(E164_KENYA, "Enter a Kenyan phone number, like 0712 345 678");
const email = z.string().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/);
const document = { _id: id, schemaVersion: z.literal(1) };
const timestamps = { createdAt: date, updatedAt: date };

/* ─────────────────────────── Shared building blocks ─────────────────────────── */

export const geoPointSchema = z.object({
  type: z.literal("Point"),
  /** GeoJSON order: [longitude, latitude]. */
  coordinates: z.array(z.number()).length(2),
}).strict().refine((p) => inKenya(p.coordinates[1]!, p.coordinates[0]!), "The pin must be inside Kenya (check that latitude and longitude are not swapped)");

export const imageSchema = z.object({
  id, url: httpsUrl, thumbUrl: httpsUrl.nullable(),
  width: z.number().int().min(1), height: z.number().int().min(1), bytes: z.number().int().min(1).max(LISTING_LIMITS.imageBytesMax),
  alt: z.string().max(LISTING_LIMITS.imageAltMax), caption: z.string().max(LISTING_LIMITS.imageCaptionMax).nullable(),
  /** Position in the gallery; the photo at index 0 is the cover photo. */
  order: z.number().int().min(0),
}).strict().refine((i) => i.width >= LISTING_LIMITS.imageMinWidth && i.height >= LISTING_LIMITS.imageMinHeight,
  `Photos must be at least ${LISTING_LIMITS.imageMinWidth}×${LISTING_LIMITS.imageMinHeight} pixels`);

export const brandImageSchema = z.object({ url: httpsUrl, width: z.number().int().min(1), height: z.number().int().min(1) }).strict();

export const locationSchema = z.object({
  countyCode: z.number().int().min(1).max(47).nullable(),
  county: z.string().max(40).nullable(),
  countySlug: slug.nullable(),
  subCounty: z.string().max(60).nullable(),
  areaName: z.string().max(LISTING_LIMITS.areaNameMax),
  areaSlug: slug.nullable(),
  /** Street or plot address. Never shown publicly when hideExactLocation is true. */
  address: z.string().max(LISTING_LIMITS.addressMax).nullable(),
  landmark: z.string().max(LISTING_LIMITS.landmarkMax).nullable(),
  point: geoPointSchema.optional(),
  hideExactLocation: z.boolean(),
}).strict();

export const priceSchema = z.object({
  amount: z.number().int().min(LISTING_LIMITS.priceMin).max(LISTING_LIMITS.priceMax),
  /** The amount in shillings (converted when the listing is in dollars), so searches and sorting compare like with like. */
  amountKes: z.number().int().min(1).max(LISTING_LIMITS.priceMax * 1000),
  currency: z.enum(CURRENCIES), period: z.enum(PRICE_PERIODS), negotiable: z.boolean(),
}).strict();

export const detailsSchema = z.object({
  bedrooms: z.number().int().min(0).max(LISTING_LIMITS.bedroomsMax).nullable(),
  bathrooms: z.number().int().min(0).max(LISTING_LIMITS.bathroomsMax).nullable(),
  ensuiteBedrooms: z.number().int().min(0).max(LISTING_LIMITS.bedroomsMax).nullable(),
  servantQuarters: z.number().int().min(0).max(10).nullable(),
  parkingSpaces: z.number().int().min(0).max(LISTING_LIMITS.parkingMax).nullable(),
  floorAreaSqm: z.number().min(1).max(LISTING_LIMITS.floorAreaMaxSqm).nullable(),
  /** The size the lister entered, in the unit they chose, and the same size in square metres for filtering. */
  plotAreaValue: z.number().min(0).nullable(),
  plotAreaUnit: z.enum(AREA_UNITS).nullable(),
  plotAreaSqm: z.number().min(1).max(LISTING_LIMITS.plotAreaMaxSqm).nullable(),
  floorLevel: z.number().int().min(0).max(LISTING_LIMITS.floorsMax).nullable(),
  totalFloors: z.number().int().min(1).max(LISTING_LIMITS.floorsMax).nullable(),
  yearBuilt: z.number().int().min(LISTING_LIMITS.yearBuiltMin).nullable(),
  condition: z.enum(CONDITION_KEYS).nullable(),
  furnishing: z.enum(FURNISHING_KEYS).nullable(),
  zoning: z.enum(LAND_ZONINGS).nullable(),
}).strict();

export const legalSchema = z.object({
  titleType: z.enum(TITLE_TYPE_KEYS).nullable(),
  leaseYearsRemaining: z.number().int().min(1).max(999).nullable(),
  titleDeedReady: z.boolean().nullable(),
}).strict();

export const rentalSchema = z.object({
  depositMonths: z.number().int().min(0).max(12).nullable(),
  minLeaseMonths: z.number().int().min(1).max(120).nullable(),
  serviceChargeKes: z.number().int().min(0).max(100_000_000).nullable(),
  utilitiesIncluded: z.array(z.enum(UTILITY_KEYS)).max(UTILITY_KEYS.length),
  availableFrom: date.nullable(),
}).strict();

export const shortStaySchema = z.object({
  maxGuests: z.number().int().min(1).max(LISTING_LIMITS.maxGuests),
  minNights: z.number().int().min(1).max(365),
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
}).strict();

export const saleSchema = z.object({ paymentPlans: z.array(z.enum(PAYMENT_PLANS)).max(PAYMENT_PLANS.length) }).strict();

/* ─────────────────────────────────── Property ─────────────────────────────────── */

const propertyShape = {
  ...document,
  slug,
  /** Short public code, e.g. HD-7K3M2Q, safe to read out over the phone. */
  referenceCode: z.string().regex(REFERENCE_CODE),
  agencyId: id,
  /** Member who created it; accountable for the content. */
  createdBy: id,
  /** Member shown as the contact person; null means the agency's own contact details. */
  agentId: id.nullable(),
  /** The lister's own reference or stock number. */
  externalRef: z.string().max(LISTING_LIMITS.externalRefMax).nullable(),
  /** Where the listing came from. Scraped or imported listings are deduplicated on (kind, externalId). */
  source: z.object({
    kind: z.enum(["manual", "import", "scraper"]), url: httpsUrl.nullable(), externalId: z.string().max(120).nullable(), importedAt: date.nullable(),
  }).strict(),

  listingType: z.enum(LISTING_TYPE_KEYS),
  category: z.enum(PROPERTY_CATEGORY_KEYS),
  propertyType: z.enum(PROPERTY_TYPE_KEYS),

  title: z.string().max(LISTING_LIMITS.titleMax),
  /** Plain text. Never rendered as HTML. */
  description: z.string().max(LISTING_LIMITS.descriptionMax),
  highlights: z.array(z.string().min(1).max(LISTING_LIMITS.highlightMax)).max(LISTING_LIMITS.highlightsMax),

  price: priceSchema.nullable(),
  priceHistory: z.array(z.object({ amount: z.number().int().min(1), changedAt: date }).strict()).max(LISTING_LIMITS.priceHistoryMax),

  location: locationSchema,
  details: detailsSchema,
  legal: legalSchema,
  rental: rentalSchema.nullable(),
  shortStay: shortStaySchema.nullable(),
  sale: saleSchema.nullable(),
  /** Keys from the feature catalogue (taxonomy.ts), validated against the property category. */
  features: z.array(z.enum(FEATURE_KEYS)).max(LISTING_LIMITS.featuresMax),
  customFeatures: z.array(z.string().min(1).max(LISTING_LIMITS.customFeatureMax)).max(LISTING_LIMITS.customFeaturesMax),

  /** Named places of interest near the property, with the distance in metres when known. Written by the agent, never guessed by us. */
  nearby: z.array(z.object({ category: z.enum(NEARBY_KEYS), name: z.string().trim().min(2).max(LISTING_LIMITS.nearbyNameMax), distanceM: z.number().int().min(10).max(LISTING_LIMITS.nearbyMaxMeters).nullable() }).strict()).max(LISTING_LIMITS.nearbyMax).optional(),

  /** Ordered gallery. A listing needs at least one photo to leave draft. */
  images: z.array(imageSchema).max(LISTING_LIMITS.imagesMax),
  floorPlans: z.array(imageSchema).max(LISTING_LIMITS.floorPlansMax),
  videoUrl: httpsUrl.nullable(),
  virtualTourUrl: httpsUrl.nullable(),
  /** Optional phone for this listing only, instead of the agent's or agency's. */
  contactPhone: phone.nullable(),

  status: z.enum(LISTING_STATUSES),
  closedReason: z.enum(CLOSED_REASONS).nullable(),
  /** Set while status is "frozen": who froze it and when. */
  frozen: z.object({ reason: z.enum(FREEZE_REASONS), at: date }).strict().nullable().optional(),
  moderation: z.object({ reviewedBy: id.nullable(), reviewedAt: date.nullable(), rejectionReason: z.string().max(500).nullable() }).strict(),
  /** Set by Hodii staff after checking the listing against the lister's documents. */
  verified: z.object({ isVerified: z.boolean(), verifiedAt: date.nullable() }).strict(),
  /** `tier` and `until` summarise what is running now (see promotions.ts). The raw ends and the payment or package each came from are kept so every paid listing is traceable. */
  promotion: z.object({
    tier: z.enum(PROMOTION_TIERS), until: date.nullable(),
    boostUntil: date.nullable().optional(), boostPaymentId: id.nullable().optional(),
    premiumUntil: date.nullable().optional(), packageId: id.nullable().optional(), packagePaymentId: id.nullable().optional(),
  }).strict(),

  /** Running totals, incremented atomically. Time series live in propertyDailyStats. */
  stats: z.object({ views: count, saves: count, enquiries: count, phoneReveals: count, whatsappClicks: count, shares: count }).strict(),

  ...timestamps,
  publishedAt: date.nullable(),
  expiresAt: date.nullable(),
  lastConfirmedAt: date.nullable(),
};

export const propertyBase = z.object(propertyShape).strict();

/** Rules every saved listing must satisfy; the "complete" rules apply from the moment it leaves draft. */
function checkProperty(p: z.infer<typeof propertyBase>, ctx: z.RefinementCtx) {
  const issues = [...consistencyIssues(p), ...(p.status === "draft" ? [] : publishIssues(p))];
  for (const i of issues) ctx.addIssue({ code: z.ZodIssueCode.custom, path: i.path.split("."), message: i.message });
  if (p.status === "published" && (!p.publishedAt || !p.expiresAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["publishedAt"], message: "A published listing needs its publication and expiry dates" });
  }
}
export const propertySchema = propertyBase.superRefine(checkProperty);

/** What a lister submits from the listing form. System fields (ids, status, stats, moderation) are never accepted from the client. */
export const propertyInputSchema = propertyBase.pick({
  agentId: true, externalRef: true, listingType: true, category: true, propertyType: true, title: true, description: true, highlights: true,
  price: true, location: true, details: true, legal: true, rental: true, shortStay: true, sale: true, features: true, customFeatures: true, nearby: true,
  images: true, floorPlans: true, videoUrl: true, virtualTourUrl: true, contactPhone: true,
}).strict();
export type PropertyInput = z.infer<typeof propertyInputSchema>;
export type PropertyDocument = z.infer<typeof propertyBase>;

/* ───────────────────────────── Search and alerts ───────────────────────────── */

const priceRangeOk = (c: { priceMin?: number | undefined; priceMax?: number | undefined; areaSqmMin?: number | undefined; areaSqmMax?: number | undefined }) =>
  (c.priceMin === undefined || c.priceMax === undefined || c.priceMin <= c.priceMax) && (c.areaSqmMin === undefined || c.areaSqmMax === undefined || c.areaSqmMin <= c.areaSqmMax);
const RANGE_MESSAGE = "A minimum cannot exceed its maximum";

const searchCriteriaShape = {
  q: z.string().trim().max(100).optional(),
  listingType: z.enum(LISTING_TYPE_KEYS).optional(),
  category: z.enum(PROPERTY_CATEGORY_KEYS).optional(),
  propertyTypes: z.array(z.enum(PROPERTY_TYPE_KEYS)).max(10).optional(),
  countyCodes: z.array(z.number().int().min(1).max(47)).max(10).optional(),
  areaSlugs: z.array(slug).max(10).optional(),
  priceMin: z.number().int().min(0).optional(),
  priceMax: z.number().int().min(0).optional(),
  bedroomsMin: z.number().int().min(0).max(LISTING_LIMITS.bedroomsMax).optional(),
  bathroomsMin: z.number().int().min(0).max(LISTING_LIMITS.bathroomsMax).optional(),
  areaSqmMin: z.number().min(0).optional(),
  areaSqmMax: z.number().min(0).optional(),
  features: z.array(z.enum(FEATURE_KEYS)).max(10).optional(),
  furnishing: z.enum(FURNISHING_KEYS).optional(),
  verifiedOnly: z.boolean().optional(),
  conditions: z.array(z.enum(CONDITION_KEYS)).max(5).optional(),
  /** Map search: listings within a radius of a point (metres). The smallest radius is 500 m so a search cannot pinpoint a hidden address. */
  circle: z.object({ lat: z.number().min(-5).max(5.5), lng: z.number().min(33.5).max(42), radiusM: z.number().int().min(500).max(100_000) }).strict().optional(),
  /** Map search: listings inside a drawn shape, as [longitude, latitude] pairs. The shape is closed for you. */
  polygon: z.array(z.array(z.number()).length(2)).min(3).max(80).optional(),
};
/** The filters a person can set; saved as an alert and used to query the public listings. */
export const searchCriteriaSchema = z.object(searchCriteriaShape).strict().refine(priceRangeOk, RANGE_MESSAGE);
export const searchParamsSchema = z.object({
  ...searchCriteriaShape,
  sort: z.enum(["newest", "price_asc", "price_desc", "size_desc", "relevance"]).default("relevance"),
  page: z.number().int().min(1).max(500).default(1),
  pageSize: z.number().int().min(1).max(48).default(24),
}).strict().refine(priceRangeOk, RANGE_MESSAGE);

export const savedSearchSchema = z.object({
  ...document, userId: id, name: z.string().min(1).max(SAVED_LIMITS.searchNameMax), criteria: searchCriteriaSchema,
  frequency: z.enum(ALERT_FREQUENCIES), lastNotifiedAt: date.nullable(), ...timestamps,
}).strict();

export const savedPropertySchema = z.object({
  ...document, userId: id, propertyId: id,
  /** Price when saved, so a later drop can be shown. */
  priceAtSave: z.number().int().min(1).nullable(), createdAt: date,
}).strict();

export const NOTIFICATION_KINDS = ["invitation", "enquiry", "listing_decision", "agency_decision", "saved_search", "price_drop", "comment_reply", "comment_on_listing", "comment_like", "listing_expiry", "agency_review", "promotion"] as const;
/** A message shown in a person's bell. In-site only: nothing is emailed. */
export const notificationSchema = z.object({
  ...document, userId: id, kind: z.enum(NOTIFICATION_KINDS), title: z.string().min(1).max(120), body: z.string().max(300),
  /** Where the notification leads, a path inside the site. */
  link: z.string().max(300).nullable(),
  /** Set for invitations: the membership the person can accept or decline. */
  inviteId: id.nullable(),
  /** Stops the same event notifying twice. */
  dedupeKey: z.string().max(200).nullable(),
  readAt: date.nullable(), createdAt: date,
}).strict();

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "cancelled", "expired", "refunded"] as const;
export const PAYMENT_KINDS = ["boost", "premium_package", "space_pack"] as const;
/**
 * One attempt to pay. A boost belongs to one listing; a premium package belongs to the agency and its listings are attached afterwards.
 * Nothing is applied until status is "paid". Every attempt is kept, with the price breakdown it was quoted, for accounting and disputes.
 */
export const paymentSchema = z.object({
  ...document, kind: z.enum(PAYMENT_KINDS).optional(), propertyId: id.nullable(), agencyId: id, userId: id, tier: z.enum(["boost", "premium"]).optional(),
  days: z.number().int().min(1).max(365), amountKes: z.number().int().min(1),
  /** Premium packages: how many listing slots were bought, and the package this payment created. */
  slots: z.number().int().min(1).max(2000).nullable().optional(), packageId: id.nullable().optional(),
  /** Renewals: listings to put back into the new package when it starts. */
  attachListingIds: z.array(id).max(2000).optional(), renewedFrom: id.nullable().optional(),
  /** The quote as shown at purchase time, so a later price change never rewrites history. */
  quote: z.object({ perDayKes: z.number().optional(), discountPct: z.number().optional(), fullKes: z.number().optional(), extraSlots: z.number().optional() }).strict().optional(),
  callbackSummary: z.object({ amount: z.number().nullable(), receipt: z.string().max(40).nullable(), transactionDate: z.string().max(20).nullable() }).strict().optional(),
  provider: z.enum(["mpesa", "manual"]), status: z.enum(PAYMENT_STATUSES),
  /** Last three digits only; the full number is not kept. */
  phoneHint: z.string().max(12).nullable(),
  checkoutRequestId: z.string().max(100).nullable(), merchantRequestId: z.string().max(100).nullable(),
  receipt: z.string().max(40).nullable(), resultDesc: z.string().max(300).nullable(),
  createdAt: date, updatedAt: date, paidAt: date.nullable(),
  /** Set when staff refund a paid payment (the money goes back outside the site). The paid benefit ends at the same time. */
  refundedAt: date.nullable().optional(), refundNote: z.string().max(300).nullable().optional(), refundedBy: z.string().max(80).nullable().optional(),
}).strict();

/** A bought Premium package: a number of listing slots for a fixed term. Listings are attached to it, and leave it instantly when removed. */
export const premiumPackageSchema = z.object({
  ...document, agencyId: id, purchasedBy: id, paymentId: id, slots: z.number().int().min(1).max(2000), days: z.number().int().min(1).max(365), priceKes: z.number().int().min(0),
  startsAt: date, endsAt: date, listingIds: z.array(id).max(2000), renewedFrom: id.nullable().optional(),
  /** Which expiry notices have gone out, so each is sent once. */
  noticeSoonAt: date.nullable().optional(), noticeEndedAt: date.nullable().optional(),
  createdAt: date, updatedAt: date,
}).strict();

/** Extra room for Basic listings, bought for a fixed term. The agency's allowance is the free limit plus the slots of every pack still running. */
export const spacePackSchema = z.object({
  ...document, agencyId: id, purchasedBy: id, paymentId: id, slots: z.number().int().min(1).max(1000), days: z.number().int().min(1).max(365), priceKes: z.number().int().min(0),
  startsAt: date, endsAt: date, noticeSoonAt: date.nullable().optional(), noticeEndedAt: date.nullable().optional(), createdAt: date,
}).strict();

/** A comment on a listing. The text is stored encrypted; a deleted comment keeps its place in the thread with no text. */
export const propertyCommentSchema = z.object({
  ...document, propertyId: id, userId: id, parentId: id.nullable(),
  textEnc: z.string().max(8000).nullable(),
  createdAt: date, editedAt: date.nullable(), deletedAt: date.nullable(),
}).strict();

/** One person's rating of a neighbourhood. One per person per area; saving again replaces it. The key is "county-slug/area-slug". */
export const neighbourhoodReviewSchema = z.object({
  ...document, areaKey: z.string().max(150), userId: id,
  ratings: z.object({ security: z.number().int().min(1).max(5).optional(), amenities: z.number().int().min(1).max(5).optional(), transport: z.number().int().min(1).max(5).optional(), quiet: z.number().int().min(1).max(5).optional(), utilities: z.number().int().min(1).max(5).optional(), family: z.number().int().min(1).max(5).optional(), value: z.number().int().min(1).max(5).optional() }).strict(),
  relation: z.enum(["live", "lived", "work", "visit"]), textEnc: z.string().max(8000).nullable(), createdAt: date, updatedAt: date,
  /** People who reported it. Three different reporters hide it until staff decide. */
  reportedBy: z.array(id).max(50).optional(), hidden: z.boolean().optional(),
}).strict();
/** The neighbourhood group chat: threaded, text encrypted at rest, deleted posts keep their place. */
export const neighbourhoodPostSchema = z.object({
  ...document, areaKey: z.string().max(150), userId: id, parentId: id.nullable(), textEnc: z.string().max(8000).nullable(), createdAt: date, deletedAt: date.nullable(),
  reportedBy: z.array(id).max(50).optional(), hidden: z.boolean().optional(),
}).strict();

export const propertyCommentLikeSchema = z.object({ ...document, commentId: id, userId: id, authorId: id, createdAt: date }).strict();

/* ───────────────────────────── Agencies and people ───────────────────────────── */

export const userSchema = z.object({
  ...document, emailHash: z.string().min(1), emailEnc: z.string().min(1), username: z.string().min(3).max(30), passwordHash: z.string().min(1),
  blocked: z.boolean(), createdAt: date, lastSignInAt: date.nullable(),
  /** How the person signed up. Anyone can later create or join an agency regardless of this. Missing on older accounts (treated as "user"). */
  accountType: z.enum(["user", "agency"]).optional(),
  phoneEnc: z.string().nullable().optional(),
  /** When the person accepted the terms and privacy policy, and which version they saw. */
  termsAcceptedAt: date.optional(), termsVersion: z.string().max(20).optional(),
  /** SHA-256 digests of unused one-time recovery codes. The codes themselves are shown once and never stored. */
  recoveryHashes: z.array(z.string()).max(20).optional(), recoveryIssuedAt: date.optional(),
  /** Profile picture, uploaded straight to Cloudinary. */
  avatar: z.object({ url: z.string().url().max(500), publicId: z.string().max(200).nullable() }).strict().nullable().optional(),
}).strict();

export const agencySchema = z.object({
  ...document,
  slug: slug,
  name: z.string().min(AGENCY_LIMITS.nameMin).max(AGENCY_LIMITS.nameMax),
  kind: z.enum(AGENCY_KIND_KEYS),
  legalName: z.string().max(AGENCY_LIMITS.nameMax).nullable(),
  description: z.string().max(AGENCY_LIMITS.descriptionMax),
  logo: brandImageSchema.nullable(),
  cover: brandImageSchema.nullable(),
  contact: z.object({ phone: phone, whatsapp: phone.nullable(), email, website: httpsUrl.nullable() }).strict(),
  address: z.object({ countyCode: z.number().int().min(1).max(47).nullable(), area: z.string().max(LISTING_LIMITS.areaNameMax).nullable(), street: z.string().max(LISTING_LIMITS.addressMax).nullable() }).strict(),
  serviceAreas: z.array(z.number().int().min(1).max(47)).max(AGENCY_LIMITS.serviceAreasMax),
  /** The public profile: a one-line tagline, the agency's own story, what it does, when it is open and where else to find it. */
  tagline: z.string().max(AGENCY_LIMITS.taglineMax).optional(),
  story: z.string().max(AGENCY_LIMITS.storyMax).optional(),
  services: z.array(z.string().min(1).max(40)).max(AGENCY_LIMITS.servicesMax).optional(),
  hours: z.string().max(200).nullable().optional(),
  foundedYear: z.number().int().min(1900).max(2100).nullable().optional(),
  socials: z.object({ facebook: httpsUrl.nullable().optional(), instagram: httpsUrl.nullable().optional(), x: httpsUrl.nullable().optional(), tiktok: httpsUrl.nullable().optional(), linkedin: httpsUrl.nullable().optional(), youtube: httpsUrl.nullable().optional() }).strict().optional(),
  /** Kept up to date whenever a review is written, edited or removed, so cards and sorting need no extra query. */
  rating: z.object({ count: z.number().int().min(0), avg: z.number().min(0).max(5) }).strict().optional(),
  registration: z.object({
    /** Estate Agents Registration Board number, for estate agencies and property managers. */
    earbNumber: z.string().max(AGENCY_LIMITS.registrationNumberMax).nullable(),
    businessRegNumber: z.string().max(AGENCY_LIMITS.registrationNumberMax).nullable(),
  }).strict(),
  verification: z.object({
    status: z.enum(VERIFICATION_STATUSES), submittedAt: date.nullable(), reviewedAt: date.nullable(), reviewedBy: id.nullable(), rejectionReason: z.string().max(500).nullable(),
    /** Private documents (certificates, authorisation letters). Never exposed to the public site. */
    documents: z.array(z.object({ id, kind: z.enum(["earb_certificate", "business_registration", "national_id", "authorisation_letter", "other"]), url: httpsUrl, uploadedAt: date }).strict()).max(10),
  }).strict(),
  status: z.enum(["active", "suspended"]),
  suspendedReason: z.string().max(500).nullable(),
  createdBy: id,
  ...timestamps,
}).strict().superRefine((a, ctx) => {
  if (a.verification.status === "verified" && a.kind === "estate_agency" && !a.registration.earbNumber) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["registration", "earbNumber"], message: "An estate agency needs its EARB registration number to be verified" });
  }
});

export const REVIEW_STATUSES = ["visible", "hidden"] as const;
/** A review of an agency. One per person per agency; the author can edit or delete it, the agency can reply once. */
export const agencyReviewSchema = z.object({
  ...document, agencyId: id, userId: id, username: z.string().min(1).max(40),
  rating: z.number().int().min(1).max(5), body: z.string().min(10).max(AGENCY_LIMITS.reviewBodyMax),
  /** True when the author had sent this agency an enquiry before reviewing. */
  verifiedEnquirer: z.boolean(),
  reply: z.object({ body: z.string().min(1).max(AGENCY_LIMITS.reviewBodyMax), by: id, at: date }).strict().nullable(),
  /** People who flagged the review. Three or more hides it until staff look. */
  reportedBy: z.array(id).max(50), status: z.enum(REVIEW_STATUSES),
  createdAt: date, updatedAt: date,
}).strict();

export const agencyMemberSchema = z.object({
  ...document, agencyId: id,
  /** Null while the invitation is pending; set when the invited person accepts. */
  userId: id.nullable(),
  role: z.enum(MEMBER_ROLES), status: z.enum(MEMBER_STATUSES),
  /** A custom list of what this person may do, chosen by the owner or an admin. Missing or null means the role's defaults. */
  permissions: z.array(z.string().max(40)).max(40).nullable().optional(),
  invite: z.object({ emailHash: z.string().min(1), emailEnc: z.string().min(1).optional(), tokenHash: z.string().min(1), expiresAt: date, invitedBy: id }).strict().nullable(),
  /** Public agent profile shown on listings the person looks after. */
  title: z.string().max(60).nullable(), phone: phone.nullable(), whatsapp: phone.nullable(), photoUrl: httpsUrl.nullable(), bio: z.string().max(500).nullable(),
  joinedAt: date.nullable(), ...timestamps,
}).strict().superRefine((m, ctx) => {
  if (m.status === "active" && !m.userId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["userId"], message: "An active member must be linked to a user" });
  if (m.status === "invited" && !m.invite) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["invite"], message: "An invited member needs an invitation" });
});

/* ─────────────────────────── Leads, reports and developments ─────────────────────────── */

export const enquirySchema = z.object({
  ...document, propertyId: id, agencyId: id,
  /** Snapshot so the lead stays readable if the listing is later removed. */
  propertyRef: z.string().regex(REFERENCE_CODE), propertyTitle: z.string().max(LISTING_LIMITS.titleMax),
  agentId: id.nullable(), userId: id.nullable(),
  name: z.string().min(ENQUIRY_LIMITS.nameMin).max(ENQUIRY_LIMITS.nameMax),
  emailEnc: z.string().min(1), phoneEnc: z.string().nullable(),
  message: z.string().min(ENQUIRY_LIMITS.messageMin).max(ENQUIRY_LIMITS.messageMax),
  channel: z.enum(ENQUIRY_CHANNELS),
  preferredViewingAt: date.nullable(),
  /** The enquirer agreed that their details are shared with the lister (Data Protection Act, 2019). */
  consent: z.literal(true),
  status: z.enum(ENQUIRY_STATUSES), assignedTo: id.nullable(),
  notes: z.array(z.object({ id, authorId: id, text: z.string().min(1).max(ENQUIRY_LIMITS.noteMax), createdAt: date }).strict()).max(ENQUIRY_LIMITS.notesMax),
  firstResponseAt: date.nullable(), ipHash: z.string().nullable(), ...timestamps,
}).strict();

/** One message in an enquiry conversation. Only enquiries sent while signed in can have a thread. */
export const enquiryMessageSchema = z.object({
  ...document, enquiryId: id, agencyId: id, senderRole: z.enum(["agent", "enquirer"]), senderUserId: id,
  body: z.string().min(1).max(ENQUIRY_LIMITS.replyMax), createdAt: date, readAt: date.nullable(),
}).strict();

/** Errors grouped by fingerprint, for the admin Errors tab. Messages are redacted before they are stored. Kept 60 days after last seen. */
export const FEEDBACK_KINDS = ["like", "idea", "confusing", "bug", "down", "other"] as const;
export const FEEDBACK_STATUSES = ["new", "seen", "resolved"] as const;
/** What visitors tell the team through the feedback button. Only what they typed plus where they were; the network address is kept as a hash for rate limits. */
export const feedbackSchema = z.object({
  ...document, kind: z.enum(FEEDBACK_KINDS), rating: z.number().int().min(1).max(5).nullable(), message: z.string().min(3).max(2000),
  page: z.string().max(300), device: z.string().max(200).nullable(), viewport: z.string().max(20).nullable(),
  userId: id.nullable(), name: z.string().max(80).nullable(), email: z.string().max(200).nullable(), contactOk: z.boolean(), ipHash: z.string().max(80),
  status: z.enum(FEEDBACK_STATUSES), adminNote: z.string().max(1000).nullable(), createdAt: date, updatedAt: date,
}).strict();

/** Where a signed-in person is in the onboarding tour, so it follows them to any device. One row per person and tour. */
export const tourProgressSchema = z.object({
  ...document, userId: id, tour: z.string().regex(/^[a-z-]{2,30}$/), status: z.enum(["new", "running", "paused", "snoozed", "dismissed", "done"]), step: z.number().int().min(0).max(50), until: z.number().int().min(0), snoozes: z.number().int().min(0).max(10), updatedAt: date,
}).strict();

/** One row per day and search words: how often people searched them, and how often nothing matched. No person is recorded. */
export const searchTermSchema = z.object({
  ...document, day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), term: z.string().min(2).max(60), searches: count, zero: count, closeMatch: count, updatedAt: date,
}).strict();

export const errorEventSchema = z.object({
  ...document, fingerprint: z.string().min(1).max(20), source: z.enum(["server", "browser"]), message: z.string().max(300), stack: z.string().max(2000).nullable(),
  count: z.number().int().min(1), firstSeen: date, lastSeen: date, lastPath: z.string().max(200).nullable().optional(), lastAlertAt: date.nullable(), resolved: z.boolean().optional(),
}).strict();

/** One person's (or one network's, when signed out) AI search counter for the current window. Holds a count only: what was asked is never stored. */
export const aiUsageSchema = z.object({ ...document, tier: z.enum(["guest", "user", "agency", "premium"]), windowStart: date, count: z.number().int().min(0), expiresAt: date }).strict();

export const listingReportSchema = z.object({
  ...document, propertyId: id, agencyId: id, reporterUserId: id.nullable(), reporterIpHash: z.string().nullable(),
  reason: z.enum(REPORT_REASON_KEYS), details: z.string().max(REPORT_LIMITS.detailsMax).nullable(),
  status: z.enum(REPORT_STATUSES), handledBy: id.nullable(), handledAt: date.nullable(), resolution: z.string().max(500).nullable(), createdAt: date,
}).strict();

export const developmentSchema = z.object({
  ...document, slug, agencyId: id, createdBy: id,
  name: z.string().min(DEVELOPMENT_LIMITS.nameMin).max(DEVELOPMENT_LIMITS.nameMax),
  description: z.string().max(DEVELOPMENT_LIMITS.descriptionMax),
  status: z.enum(DEVELOPMENT_STATUSES), publishStatus: z.enum(PUBLISH_STATUSES),
  location: locationSchema, completionDate: date.nullable(),
  priceFrom: z.number().int().min(1).nullable(), priceTo: z.number().int().min(1).nullable(), currency: z.enum(CURRENCIES),
  unitTypes: z.array(z.object({ label: z.string().min(1).max(60), propertyType: z.enum(PROPERTY_TYPE_KEYS), bedrooms: z.number().int().min(0).max(LISTING_LIMITS.bedroomsMax).nullable(), priceFrom: z.number().int().min(1).nullable(), unitsAvailable: z.number().int().min(0).nullable() }).strict()).max(DEVELOPMENT_LIMITS.unitTypesMax),
  features: z.array(z.enum(FEATURE_KEYS)).max(LISTING_LIMITS.featuresMax),
  images: z.array(imageSchema).max(DEVELOPMENT_LIMITS.imagesMax),
  brochureUrl: httpsUrl.nullable(), videoUrl: httpsUrl.nullable(),
  stats: z.object({ views: count, enquiries: count }).strict(),
  ...timestamps, publishedAt: date.nullable(),
}).strict().superRefine((d, ctx) => {
  if (d.publishStatus === "published" && d.images.length < DEVELOPMENT_LIMITS.imagesMin) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["images"], message: "Add at least one photo or render before publishing" });
  }
  if (d.priceFrom !== null && d.priceTo !== null && d.priceFrom > d.priceTo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["priceTo"], message: "The highest price cannot be below the lowest" });
  }
});

/** Normalised neighbourhoods for search suggestions and area pages. Created when the first listing in an area is published. */
export const areaSchema = z.object({
  ...document, countyCode: z.number().int().min(1).max(47), countySlug: slug, name: z.string().min(LISTING_LIMITS.areaNameMin).max(LISTING_LIMITS.areaNameMax), slug,
  point: geoPointSchema.optional(), createdAt: date,
}).strict();

/* ─────────────────────────────────── Analytics ─────────────────────────────────── */

/** One row per thing that happened. Rolled up into propertyDailyStats; raw rows expire after 24 months, matching the privacy policy. */
export const propertyEventSchema = z.object({
  ...document, propertyId: id, agencyId: id, kind: z.enum(EVENT_KINDS),
  userId: id.nullable(),
  /** Digest of a random browser id: counts unique visitors without identifying anyone. */
  visitorHash: z.string().min(1),
  /** Digest of the network address, kept only on contact reveals to cap number-harvesting. */
  ipHash: z.string().min(1).optional(),
  /** Denormalised so rollups need no join. */
  listingType: z.enum(LISTING_TYPE_KEYS), category: z.enum(PROPERTY_CATEGORY_KEYS), countyCode: z.number().int().min(1).max(47).nullable(),
  source: z.enum(["search", "category", "home", "agency", "direct", "external", "alert", "other"]),
  device: z.enum(["mobile", "tablet", "desktop", "unknown"]),
  occurredAt: date,
}).strict();

export const propertyDailyStatSchema = z.object({
  ...document, propertyId: id, agencyId: id, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  listingType: z.enum(LISTING_TYPE_KEYS), category: z.enum(PROPERTY_CATEGORY_KEYS), countyCode: z.number().int().min(1).max(47).nullable(),
  impressions: count, views: count, uniqueViews: count, saves: count, enquiries: count, phoneReveals: count, whatsappClicks: count, shares: count,
  updatedAt: date,
}).strict();

/* ─────────────────────────────────── Registry ─────────────────────────────────── */

/** Collections of the property marketplace. The generator turns each into a MongoDB validator. */
export const propertyCollectionSchemas = {
  users: userSchema,
  agencies: agencySchema,
  agencyMembers: agencyMemberSchema,
  properties: propertyBase, // structural validator; cross-field rules run in propertySchema
  developments: developmentSchema,
  areas: areaSchema,
  enquiries: enquirySchema,
  enquiryMessages: enquiryMessageSchema,
  errorEvents: errorEventSchema,
  feedback: feedbackSchema,
  tourProgress: tourProgressSchema,
  searchTerms: searchTermSchema,
  aiUsage: aiUsageSchema,
  savedProperties: savedPropertySchema,
  savedSearches: savedSearchSchema,
  notifications: notificationSchema,
  payments: paymentSchema,
  premiumPackages: premiumPackageSchema,
  spacePacks: spacePackSchema,
  agencyReviews: agencyReviewSchema,
  propertyComments: propertyCommentSchema,
  propertyCommentLikes: propertyCommentLikeSchema,
  neighbourhoodReviews: neighbourhoodReviewSchema,
  neighbourhoodPosts: neighbourhoodPostSchema,
  listingReports: listingReportSchema,
  propertyEvents: propertyEventSchema,
  propertyDailyStats: propertyDailyStatSchema,
};

/**
 * Extra MongoDB query-form rules (JSON Schema cannot express "if status is not draft then…").
 * Anything that leaves draft must have a photo and a price, whatever code wrote it.
 */
export const collectionGuards: Record<string, object> = {
  properties: {
    $or: [
      { status: "draft" },
      { "images.0": { $exists: true }, "price.amount": { $gt: 0 }, "location.countyCode": { $type: "number" } },
    ],
  },
  developments: { $or: [{ publishStatus: { $ne: "published" } }, { "images.0": { $exists: true } }] },
};

/** Collections whose validator only applies to new and updated documents, because older documents predate the new fields. */
export const moderateCollections = ["users"] as const;
export type AgencyDocument = z.infer<typeof agencySchema>;
export type AgencyMemberDocument = z.infer<typeof agencyMemberSchema>;
export type EnquiryDocument = z.infer<typeof enquirySchema>;
export type DevelopmentDocument = z.infer<typeof developmentSchema>;
