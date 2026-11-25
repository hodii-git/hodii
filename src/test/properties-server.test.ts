import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));

import { agencyBadge, cardOf } from "@/lib/properties.server";
import { foreignNewPhotos, isOwnImageUrl, signUpload, thumbOf } from "@/lib/images.server";

const NOW = Date.parse("2026-11-12T00:00:00Z");
const doc = (over: Record<string, unknown> = {}) => ({
  _id: "p1", slug: "3-bedroom-apartment-to-rent-kilimani-nairobi-hd-abc234", referenceCode: "HD-ABC234", title: "Bright three bedroom apartment",
  listingType: "rent", category: "residential", propertyType: "apartment", agencyId: "a1",
  price: { amount: 85000, currency: "KES", period: "month", negotiable: false }, priceHistory: [],
  location: { county: "Nairobi", areaName: "Kilimani" }, details: { bedrooms: 3, bathrooms: 2, parkingSpaces: 1, floorAreaSqm: 140, plotAreaSqm: null },
  images: [{ url: "https://res.cloudinary.com/x/image/upload/hodii/listings/a1/1.jpg", alt: "Living room", width: 1200, height: 800 }],
  verified: { isVerified: true }, promotion: { tier: "none", until: null }, publishedAt: new Date(NOW), ...over,
});
const agencies = new Map([["a1", { _id: "a1", slug: "acme", name: "Acme Homes", kind: "estate_agency", verification: { status: "verified" } }]]);

describe("cardOf", () => {
  it("builds a card from a stored listing", () => {
    const c = cardOf(doc(), agencies, NOW);
    expect(c).toMatchObject({ id: "p1", bedrooms: 3, sizeSqm: 140, county: "Nairobi", verified: true, imageCount: 1, tier: "none" });
    expect(c.agency).toMatchObject({ slug: "acme", verified: true });
    expect(c.image?.url).toContain("/1.jpg");
    expect(c.publishedAt).toBe("2026-11-12T00:00:00.000Z");
  });
  it("falls back to plot size for land and tolerates a missing agency", () => {
    const c = cardOf(doc({ details: { plotAreaSqm: 4047, floorAreaSqm: null } }), new Map(), NOW);
    expect(c.sizeSqm).toBe(4047);
    expect(c.agency).toBeNull();
  });
  it("shows a tier only while its run is going, and premium over boost", () => {
    const boost = doc({ promotion: { tier: "boost", until: new Date(NOW + 1000), boostUntil: new Date(NOW + 1000) } });
    const over = doc({ promotion: { tier: "boost", until: new Date(NOW - 1000), boostUntil: new Date(NOW - 1000) } });
    const both = doc({ promotion: { tier: "premium", until: new Date(NOW + 5000), boostUntil: new Date(NOW + 1000), premiumUntil: new Date(NOW + 5000) } });
    expect(cardOf(boost, agencies, NOW).tier).toBe("boost");
    expect(cardOf(over, agencies, NOW).tier).toBe("none");
    expect(cardOf(both, agencies, NOW).tier).toBe("premium");
  });
  it("handles an unverified agency without a logo", () => {
    expect(agencyBadge({ slug: "s", name: "S", kind: "owner", verification: { status: "pending" } })).toMatchObject({ verified: false, logo: null });
    expect(agencyBadge(undefined)).toBeNull();
  });
});

describe("images", () => {
  afterEach(() => { vi.unstubAllEnvs(); });
  const env = () => { vi.stubEnv("CLOUDINARY_CLOUD_NAME", "democloud"); vi.stubEnv("CLOUDINARY_API_KEY", "key123"); vi.stubEnv("CLOUDINARY_API_SECRET", "secret456"); };

  it("signs the sorted parameters followed by the secret", async () => {
    env();
    const s = await signUpload("a1", "listing", 1700000000);
    const toSign = "allowed_formats=jpg,jpeg,png,webp&folder=hodii/listings/a1&timestamp=1700000000secret456";
    const sha = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(toSign))), (b) => b.toString(16).padStart(2, "0")).join("");
    expect(s.signature).toBe(sha);
    expect(s.uploadUrl).toBe("https://api.cloudinary.com/v1_1/democloud/image/upload");
    expect(s.params["folder"]).toBe("hodii/listings/a1");
  });
  it("puts logos in their own folder", async () => {
    env();
    expect((await signUpload("a1", "logo", 1)).params["folder"]).toBe("hodii/logos/a1");
  });
  it("refuses to sign when uploads are not configured", async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", ""); vi.stubEnv("CLOUDINARY_API_KEY", ""); vi.stubEnv("CLOUDINARY_API_SECRET", "");
    await expect(signUpload("a1", "listing")).rejects.toThrow(/not configured/);
  });
  it("accepts only this agency's own photos", () => {
    env();
    expect(isOwnImageUrl("https://res.cloudinary.com/democloud/image/upload/v1/hodii/listings/a1/x.jpg", "a1")).toBe(true);
    expect(isOwnImageUrl("https://res.cloudinary.com/democloud/image/upload/v1/hodii/listings/a2/x.jpg", "a1")).toBe(false);
    expect(isOwnImageUrl("https://res.cloudinary.com/other/image/upload/v1/hodii/listings/a1/x.jpg", "a1")).toBe(false);
    expect(isOwnImageUrl("https://evil.example/hodii/listings/a1/x.jpg", "a1")).toBe(false);
  });
  it("keeps linked photos already on a listing but accepts only uploads as new ones", () => {
    env();
    const own = { url: "https://res.cloudinary.com/democloud/image/upload/v1/hodii/listings/a1/new.jpg" };
    const linked = { url: "https://other-site.example/photo.jpg" };
    expect(foreignNewPhotos([linked, own], [linked], "a1")).toEqual([]);
    expect(foreignNewPhotos([linked, { url: "https://another.example/x.jpg" }], [linked], "a1")).toEqual(["https://another.example/x.jpg"]);
    expect(foreignNewPhotos([linked], [], "a1")).toEqual([linked.url]);
  });
  it("shows linked photos as they are", () => {
    expect(thumbOf("https://other-site.example/photo.jpg")).toBe("https://other-site.example/photo.jpg");
  });
  it("builds a thumbnail url", () => {
    expect(thumbOf("https://res.cloudinary.com/c/image/upload/v1/hodii/a.jpg", 300)).toBe("https://res.cloudinary.com/c/image/upload/c_limit,w_300,q_auto,f_auto/v1/hodii/a.jpg");
  });
});
