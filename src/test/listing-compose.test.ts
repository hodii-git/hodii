import { describe, expect, it } from "vitest";
import { blankListingForm, composeListing, formFromListing, listingFormSchema, type ListingForm } from "@/lib/listing-compose";
import { propertySchema } from "@/lib/mongodb/property-schemas";
import { publishIssues } from "@/lib/mongodb/property-rules";

const now = new Date("2026-11-12T08:00:00Z");
const img = (n: number) => ({ id: `i${n}`, url: `https://res.cloudinary.com/hodii/p${n}.jpg`, thumbUrl: null, width: 1600, height: 1000, bytes: 300_000, alt: "Lounge", caption: null });
const flat = (): ListingForm => ({
  ...blankListingForm(),
  listingType: "rent", propertyType: "apartment", title: "Modern 2 bedroom apartment in Westlands",
  description: "A modern two bedroom apartment in Westlands with a fitted kitchen, balcony, a lift and secure covered parking. Close to restaurants and offices.",
  price: { amount: 85_000, currency: "KES", period: "month", negotiable: true },
  location: { countyCode: 47, subCounty: null, areaName: "Westlands", address: "Off Ring Road", landmark: null, point: { lat: -1.2676, lng: 36.8108 }, hideExactLocation: true },
  details: { ...blankListingForm().details, bedrooms: 2, bathrooms: 2 },
  rental: { depositMonths: 2, minLeaseMonths: 12, serviceChargeKes: null, utilitiesIncluded: [], availableFrom: "2026-12-01T00:00:00.000Z" },
  features: ["balcony", "lift", "parking"], images: [img(1), img(2)],
});
const compose = (over: Partial<Parameters<typeof composeListing>[0]> = {}) =>
  composeListing({ form: flat(), existing: null, agencyId: "a1", userId: "u1", now, status: "published", newId: "p1", referenceCode: "HD-7K3M2Q", ...over });

describe("composing a listing from the form", () => {
  it("produces a valid stored listing with everything derived", () => {
    const doc = compose();
    expect(propertySchema.safeParse(doc).success).toBe(true);
    expect(doc).toMatchObject({
      category: "residential", slug: "2-bedroom-apartment-to-rent-westlands-nairobi-hd-7k3m2q", agencyId: "a1", createdBy: "u1", status: "published",
      location: { county: "Nairobi", countySlug: "nairobi", areaSlug: "westlands", point: { type: "Point", coordinates: [36.8108, -1.2676] } },
      price: { amount: 85_000, amountKes: 85_000 },
    });
    expect(doc.publishedAt).toEqual(now);
    expect(doc.expiresAt!.getTime() - now.getTime()).toBe(90 * 86_400_000);
    expect(doc.images.map((i) => i.order)).toEqual([0, 1]);
  });
  it("converts dollar prices for searching", () => {
    expect(compose({ form: { ...flat(), price: { amount: 1000, currency: "USD", period: "month", negotiable: false } }, usdRate: 130 }).price?.amountKes).toBe(130_000);
  });
  it("keeps only the terms that fit the listing type", () => {
    const doc = compose({ form: { ...flat(), listingType: "sale", price: { amount: 9_000_000, currency: "KES", period: "total", negotiable: false }, sale: { paymentPlans: ["cash"] } } });
    expect(doc.rental).toBeNull();
    expect(doc.sale).toEqual({ paymentPlans: ["cash"] });
    expect(propertySchema.safeParse(doc).success).toBe(true);
  });
  it("turns land sizes into square metres", () => {
    const form: ListingForm = { ...flat(), listingType: "sale", propertyType: "agricultural_land", rental: null, features: ["fenced"], price: { amount: 2_000_000, currency: "KES", period: "total", negotiable: true },
      details: { ...blankListingForm().details, plotAreaValue: 2, plotAreaUnit: "acre" } };
    const doc = compose({ form });
    expect(doc.category).toBe("land");
    expect(doc.details.plotAreaSqm).toBeCloseTo(8093.71, 1);
    expect(propertySchema.safeParse(doc).success).toBe(true);
  });
  it("lets a draft be saved half-filled, and says what is missing to publish it", () => {
    const form = { ...blankListingForm(), title: "Nice flat" };
    const draft = compose({ form, status: "draft" });
    expect(propertySchema.safeParse(draft).success).toBe(true);
    expect(draft.publishedAt).toBeNull();
    const missing = publishIssues(draft).map((i) => i.path);
    expect(missing).toEqual(expect.arrayContaining(["description", "images", "price", "location.county"]));
  });
  it("refuses to publish an incomplete listing", () => {
    expect(propertySchema.safeParse(compose({ form: { ...flat(), images: [] } })).success).toBe(false);
  });
  it("keeps the address, creator and counters when editing, and records price changes", () => {
    const first = compose();
    const edited = compose({ existing: { ...first, stats: { ...first.stats, views: 40 } }, form: { ...flat(), title: "Modern 2 bedroom apartment in Westlands, Nairobi", price: { amount: 80_000, currency: "KES", period: "month", negotiable: true } }, userId: "u2", status: null, now: new Date("2026-11-20T08:00:00Z") });
    expect(edited.slug).toBe(first.slug);
    expect(edited.createdBy).toBe("u1");
    expect(edited.stats.views).toBe(40);
    expect(edited.priceHistory).toEqual([{ amount: 85_000, changedAt: new Date("2026-11-20T08:00:00Z") }]);
    expect(edited.publishedAt).toEqual(now); // still the original publication date
    expect(edited.expiresAt).toEqual(first.expiresAt);
  });
  it("gives a relisted expired listing a fresh expiry", () => {
    const first = compose();
    const later = new Date("2027-03-01T00:00:00Z");
    const renewed = compose({ existing: { ...first, status: "expired" }, status: "published", now: later });
    expect(renewed.expiresAt!.getTime()).toBeGreaterThan(later.getTime());
    expect(renewed.publishedAt).toEqual(later);
  });
  it("round-trips through the form", () => {
    const doc = compose();
    const form = formFromListing(doc);
    expect(listingFormSchema.safeParse(form).success).toBe(true);
    expect(compose({ existing: doc, form, status: null }).title).toBe(doc.title);
  });
  it("rejects fields the client must not set", () => {
    expect(listingFormSchema.safeParse({ ...flat(), status: "published" }).success).toBe(false);
    expect(listingFormSchema.safeParse({ ...flat(), agencyId: "other" }).success).toBe(false);
  });
});
