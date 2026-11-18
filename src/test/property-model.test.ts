import { describe, expect, it } from "vitest";
import { agencyMemberSchema, agencySchema, developmentSchema, enquirySchema, propertyInputSchema, propertySchema, searchParamsSchema } from "@/lib/mongodb/property-schemas";
import { buildListingSlug, generateReferenceCode, listingExpiry, REFERENCE_CODE } from "@/lib/mongodb/property-rules";
import { FEATURES, PROPERTY_TYPES, canMoveStatus, featuresFor, typesInCategory } from "@/lib/mongodb/taxonomy";
import { LISTING_LIMITS } from "@/lib/mongodb/limits";

const now = new Date("2026-11-12T08:00:00Z");
const image = (n = 1) => ({ id: `img${n}`, url: `https://cdn.hodii.co.ke/p/${n}.jpg`, thumbUrl: null, width: 1600, height: 1067, bytes: 400_000, alt: "Living room", caption: null, order: n - 1 });

const apartment = () => ({
  _id: "p1", schemaVersion: 1 as const, slug: "3-bedroom-apartment-to-rent-kilimani-nairobi-hd-7k3m2q", referenceCode: "HD-7K3M2Q",
  agencyId: "a1", createdBy: "u1", agentId: null, externalRef: null,
  source: { kind: "manual" as const, url: null, externalId: null, importedAt: null },
  listingType: "rent" as const, category: "residential" as const, propertyType: "apartment" as const,
  title: "Spacious 3 bedroom apartment in Kilimani",
  description: "A bright, well-kept three bedroom apartment close to Yaya Centre, with a fitted kitchen, a balcony and secure parking. Water is reliable and a borehole backs up the mains supply.",
  highlights: ["Close to Yaya Centre"],
  price: { amount: 120_000, amountKes: 120_000, currency: "KES" as const, period: "month" as const, negotiable: false }, priceHistory: [],
  location: { countyCode: 47, county: "Nairobi", countySlug: "nairobi", subCounty: null, areaName: "Kilimani", areaSlug: "kilimani", address: null, landmark: "Near Yaya Centre", hideExactLocation: true, point: { type: "Point" as const, coordinates: [36.7872, -1.2921] } },
  details: { bedrooms: 3, bathrooms: 2, ensuiteBedrooms: 1, servantQuarters: 1, parkingSpaces: 2, floorAreaSqm: 140, plotAreaValue: null, plotAreaUnit: null, plotAreaSqm: null, floorLevel: 3, totalFloors: 8, yearBuilt: 2018, condition: "good" as const, furnishing: "unfurnished" as const, zoning: null },
  legal: { titleType: null, leaseYearsRemaining: null, titleDeedReady: null },
  rental: { depositMonths: 2, minLeaseMonths: 12, serviceChargeKes: 8000, utilitiesIncluded: ["garbage" as const], availableFrom: null },
  shortStay: null, sale: null,
  features: ["balcony", "borehole", "security_24h", "parking", "fitted_kitchen"] as never[], customFeatures: [],
  images: [image(1), image(2)], floorPlans: [], videoUrl: null, virtualTourUrl: null, contactPhone: null,
  status: "published" as const, closedReason: null,
  moderation: { reviewedBy: null, reviewedAt: null, rejectionReason: null }, verified: { isVerified: false, verifiedAt: null }, promotion: { tier: "none" as const, until: null },
  stats: { views: 0, saves: 0, enquiries: 0, phoneReveals: 0, whatsappClicks: 0, shares: 0 },
  createdAt: now, updatedAt: now, publishedAt: now, expiresAt: listingExpiry(now), lastConfirmedAt: now,
});
type P = ReturnType<typeof apartment>;
const messages = (p: unknown) => { const r = propertySchema.safeParse(p); return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`); };
const with_ = (patch: Partial<P> | Record<string, unknown>) => ({ ...apartment(), ...patch });

describe("property documents", () => {
  it("accepts a complete published apartment", () => expect(messages(apartment())).toEqual([]));

  it("needs at least one photo to leave draft", () => {
    expect(messages(with_({ images: [] })).join()).toMatch(/at least one photo/);
    expect(messages(with_({ images: [], status: "draft", publishedAt: null, expiresAt: null }))).toEqual([]);
  });
  it("rejects too many photos, and photos that are too small or not secure links", () => {
    expect(messages(with_({ images: Array.from({ length: LISTING_LIMITS.imagesMax + 1 }, (_, i) => image(i + 1)) })).length).toBeGreaterThan(0);
    expect(messages(with_({ images: [{ ...image(), width: 300, height: 200 }] })).join()).toMatch(/at least 640/);
    expect(messages(with_({ images: [{ ...image(), url: "http://insecure.example/x.jpg" }] })).length).toBeGreaterThan(0);
  });
  it("enforces title and description limits once published, but lets drafts be incomplete", () => {
    expect(messages(with_({ title: "Short" })).join()).toMatch(/title needs at least 10/);
    expect(messages(with_({ title: "x".repeat(101) })).length).toBeGreaterThan(0);
    expect(messages(with_({ description: "Too short" })).join()).toMatch(/at least 50/);
    expect(messages(with_({ title: "", description: "", price: null, images: [], status: "draft", publishedAt: null, expiresAt: null }))).toEqual([]);
  });
  it("needs a price, a county and an area to be published", () => {
    expect(messages(with_({ price: null })).join()).toMatch(/Set a price/);
    expect(messages(with_({ location: { ...apartment().location, countyCode: null } })).join()).toMatch(/county/);
    expect(messages(with_({ location: { ...apartment().location, areaName: "" } })).join()).toMatch(/area/);
  });
  it("matches the price period to the listing type", () => {
    expect(messages(with_({ price: { ...apartment().price, period: "total" } })).join()).toMatch(/priced month or year/);
    expect(messages(with_({ listingType: "sale", rental: null, price: { ...apartment().price, period: "total" } }))).toEqual([]);
    expect(messages(with_({ listingType: "sale", rental: null })).join()).toMatch(/priced total/);
  });
  it("keeps property type inside its category", () => {
    expect(messages(with_({ propertyType: "office" })).join()).toMatch(/not a residential/);
    expect(messages(with_({ category: "commercial", propertyType: "office", details: { ...apartment().details, bedrooms: null, bathrooms: null, ensuiteBedrooms: null }, features: [] }))).toEqual([]);
  });
  it("requires rooms for homes but allows zero bedrooms for a bedsitter", () => {
    expect(messages(with_({ details: { ...apartment().details, bedrooms: null } })).join()).toMatch(/bedrooms/);
    expect(messages(with_({ propertyType: "bedsitter", details: { ...apartment().details, bedrooms: 0, ensuiteBedrooms: 0 } }))).toEqual([]);
  });
  it("treats land as land: a size, no bedrooms, only land features", () => {
    const land = { category: "land" as const, propertyType: "residential_plot" as const, listingType: "sale" as const, rental: null, price: { amount: 3_500_000, amountKes: 3_500_000, currency: "KES" as const, period: "total" as const, negotiable: true },
      details: { ...apartment().details, bedrooms: null, bathrooms: null, ensuiteBedrooms: null, servantQuarters: null, parkingSpaces: null, floorAreaSqm: null, floorLevel: null, totalFloors: null, plotAreaValue: 50, plotAreaUnit: "sqm" as const, plotAreaSqm: 464.52, condition: null, furnishing: null, yearBuilt: null, zoning: "residential" as const },
      features: ["fenced", "road_frontage"] as never[] };
    expect(messages(with_(land))).toEqual([]);
    expect(messages(with_({ ...land, details: { ...land.details, plotAreaSqm: null, plotAreaValue: null, plotAreaUnit: null } })).join()).toMatch(/size of the land/);
    expect(messages(with_({ ...land, details: { ...land.details, bedrooms: 3 } })).join()).toMatch(/Land cannot have bedrooms/);
    expect(messages(with_({ ...land, features: ["swimming_pool"] })).join()).toMatch(/does not apply to land/);
  });
  it("only allows short stays in places people can sleep", () => {
    const stay = { listingType: "short_stay" as const, rental: null, shortStay: { maxGuests: 4, minNights: 2, checkInTime: "14:00", checkOutTime: "10:00" }, price: { amount: 6500, amountKes: 6500, currency: "KES" as const, period: "night" as const, negotiable: false } };
    expect(messages(with_(stay))).toEqual([]);
    expect(messages(with_({ ...stay, category: "commercial", propertyType: "warehouse", features: [], details: { ...apartment().details, bedrooms: null, bathrooms: null, ensuiteBedrooms: null } })).join()).toMatch(/places people can stay/);
  });
  it("catches impossible numbers", () => {
    expect(messages(with_({ details: { ...apartment().details, ensuiteBedrooms: 4 } })).join()).toMatch(/En-suite/);
    expect(messages(with_({ details: { ...apartment().details, floorLevel: 12 } })).join()).toMatch(/floor level/);
    expect(messages(with_({ price: { ...apartment().price, amount: 0 } })).length).toBeGreaterThan(0);
  });
  it("rejects unknown, duplicate and mismatched features", () => {
    expect(messages(with_({ features: ["balcony", "balcony"] as never[] })).join()).toMatch(/twice/);
    expect(messages(with_({ features: ["jacuzzi"] as never[] })).length).toBeGreaterThan(0);
  });
  it("keeps pins inside Kenya", () => {
    expect(messages(with_({ location: { ...apartment().location, point: { type: "Point" as const, coordinates: [-1.29, 36.82] } } })).join()).toMatch(/inside Kenya/);
  });
  it("closed listings say why", () => {
    expect(messages(with_({ status: "closed" })).join()).toMatch(/sold, let or withdrawn/);
    expect(messages(with_({ status: "closed", closedReason: "let" }))).toEqual([]);
    expect(messages(with_({ closedReason: "let" })).join()).toMatch(/Only closed/);
  });
  it("published listings carry their dates", () => expect(messages(with_({ expiresAt: null })).join()).toMatch(/expiry dates/));
  it("rejects unknown fields", () => expect(messages(with_({ views: 5 })).length).toBeGreaterThan(0));
});

describe("what a lister may submit", () => {
  it("never accepts system fields from the client", () => {
    const { title, description, listingType, category, propertyType } = apartment();
    const base = { title, description, listingType, category, propertyType };
    expect(propertyInputSchema.safeParse({ ...apartment(), status: "published" }).success).toBe(false);
    expect(propertyInputSchema.safeParse({ ...base, status: "published", stats: {} }).success).toBe(false);
  });
  it("search accepts sensible filters and rejects an inverted price range", () => {
    expect(searchParamsSchema.parse({ listingType: "rent", countyCodes: [47], bedroomsMin: 2 })).toMatchObject({ sort: "relevance", page: 1, pageSize: 24 });
    expect(searchParamsSchema.safeParse({ priceMin: 5, priceMax: 1 }).success).toBe(false);
    expect(searchParamsSchema.safeParse({ areaSqmMin: 500, areaSqmMax: 100 }).success).toBe(false);
  });
});

describe("agencies, team and leads", () => {
  const agency = {
    _id: "a1", schemaVersion: 1 as const, slug: "acme-realty", name: "Acme Realty", kind: "estate_agency" as const, legalName: "Acme Realty Ltd", description: "", logo: null, cover: null,
    contact: { phone: "+254712345678", whatsapp: null, email: "info@acme.co.ke", website: null }, address: { countyCode: 47, area: "Westlands", street: null }, serviceAreas: [47],
    registration: { earbNumber: null, businessRegNumber: null },
    verification: { status: "unverified" as const, submittedAt: null, reviewedAt: null, reviewedBy: null, rejectionReason: null, documents: [] },
    status: "active" as const, suspendedReason: null, createdBy: "u1", createdAt: now, updatedAt: now,
  };
  it("accepts an agency and rejects a bad phone number", () => {
    expect(agencySchema.safeParse(agency).success).toBe(true);
    expect(agencySchema.safeParse({ ...agency, contact: { ...agency.contact, phone: "0712" } }).success).toBe(false);
  });
  it("an estate agency cannot be verified without an EARB number", () => {
    const verified = { ...agency, verification: { ...agency.verification, status: "verified" as const } };
    expect(agencySchema.safeParse(verified).success).toBe(false);
    expect(agencySchema.safeParse({ ...verified, registration: { earbNumber: "EARB/1234", businessRegNumber: null } }).success).toBe(true);
    expect(agencySchema.safeParse({ ...verified, kind: "owner" as const }).success).toBe(true);
  });
  it("members are linked to a user once active, and invited members carry an invitation", () => {
    const member = { _id: "m1", schemaVersion: 1 as const, agencyId: "a1", userId: null, role: "agent" as const, status: "invited" as const, invite: { emailHash: "h", tokenHash: "t", expiresAt: now, invitedBy: "u1" }, title: null, phone: null, whatsapp: null, photoUrl: null, bio: null, joinedAt: null, createdAt: now, updatedAt: now };
    expect(agencyMemberSchema.safeParse(member).success).toBe(true);
    expect(agencyMemberSchema.safeParse({ ...member, status: "active" }).success).toBe(false);
    expect(agencyMemberSchema.safeParse({ ...member, invite: null }).success).toBe(false);
  });
  it("an enquiry needs the enquirer's consent to share their details", () => {
    const enquiry = { _id: "e1", schemaVersion: 1 as const, propertyId: "p1", agencyId: "a1", propertyRef: "HD-7K3M2Q", propertyTitle: "Nice flat", agentId: null, userId: null, name: "Wanjiku", emailEnc: "v1:x", phoneEnc: null, message: "Is it still available?", channel: "form" as const, preferredViewingAt: null, consent: true as const, status: "new" as const, assignedTo: null, notes: [], firstResponseAt: null, ipHash: null, createdAt: now, updatedAt: now };
    expect(enquirySchema.safeParse(enquiry).success).toBe(true);
    expect(enquirySchema.safeParse({ ...enquiry, consent: false }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...enquiry, message: "Hi" }).success).toBe(false);
  });
  it("a development needs a photo to be published and a sensible price range", () => {
    const dev = { _id: "d1", schemaVersion: 1 as const, slug: "palm-heights", agencyId: "a1", createdBy: "u1", name: "Palm Heights", description: "", status: "off_plan" as const, publishStatus: "draft" as const, location: apartment().location, completionDate: null, priceFrom: 5_000_000, priceTo: 9_000_000, currency: "KES" as const, unitTypes: [], features: [], images: [], brochureUrl: null, videoUrl: null, stats: { views: 0, enquiries: 0 }, createdAt: now, updatedAt: now, publishedAt: null };
    expect(developmentSchema.safeParse(dev).success).toBe(true);
    expect(developmentSchema.safeParse({ ...dev, publishStatus: "published" }).success).toBe(false);
    expect(developmentSchema.safeParse({ ...dev, priceFrom: 10_000_000 }).success).toBe(false);
  });
});

describe("taxonomy", () => {
  it("has unique keys and every type belongs to a category", () => {
    expect(new Set(PROPERTY_TYPES.map((t) => t.key)).size).toBe(PROPERTY_TYPES.length);
    expect(new Set(FEATURES.map((f) => f.key)).size).toBe(FEATURES.length);
    for (const c of ["residential", "commercial", "land"] as const) expect(typesInCategory(c).length).toBeGreaterThan(0);
  });
  it("offers features that fit the category", () => {
    expect(featuresFor("land").map((f) => f.key)).toContain("road_frontage");
    expect(featuresFor("land").map((f) => f.key)).not.toContain("swimming_pool");
    expect(featuresFor("residential").map((f) => f.key)).toContain("dsq");
  });
  it("only allows sensible status moves", () => {
    expect(canMoveStatus("draft", "published")).toBe(true);
    expect(canMoveStatus("published", "paused")).toBe(true);
    expect(canMoveStatus("closed", "published")).toBe(false);
    expect(canMoveStatus("rejected", "published")).toBe(false);
  });
});

describe("references and slugs", () => {
  it("makes readable reference codes", () => {
    for (let i = 0; i < 200; i++) expect(generateReferenceCode()).toMatch(REFERENCE_CODE);
    expect(generateReferenceCode(() => new Uint8Array([0, 1, 2, 3, 4, 5]))).toBe("HD-234567");
  });
  it("builds readable, bounded slugs that always end in the reference", () => {
    expect(buildListingSlug({ listingType: "rent", propertyType: "apartment", bedrooms: 3, areaSlug: "kilimani", countySlug: "nairobi", referenceCode: "HD-7K3M2Q" }))
      .toBe("3-bedroom-apartment-to-rent-kilimani-nairobi-hd-7k3m2q");
    expect(buildListingSlug({ listingType: "sale", propertyType: "residential_plot", bedrooms: null, areaSlug: "nairobi", countySlug: "nairobi", referenceCode: "HD-7K3M2Q" }))
      .toBe("residential-plot-for-sale-nairobi-hd-7k3m2q");
    const long = buildListingSlug({ listingType: "sale", propertyType: "serviced_apartment", bedrooms: 2, areaSlug: "a".repeat(200), countySlug: "nairobi", referenceCode: "HD-7K3M2Q" });
    expect(long.length).toBeLessThanOrEqual(LISTING_LIMITS.slugMax);
    expect(long.endsWith("-hd-7k3m2q")).toBe(true);
  });
  it("expires listings after the listing lifetime", () => {
    expect(listingExpiry(now).getTime() - now.getTime()).toBe(90 * 86_400_000);
  });
});
