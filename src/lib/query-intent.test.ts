import { describe, expect, it } from "vitest";
import { parseMoney, understand } from "./query-intent";

const u = (t: string) => understand(t);

describe("parseMoney", () => {
  it("reads k, m and plain numbers", () => {
    expect(parseMoney("24", "k")).toBe(24_000);
    expect(parseMoney("1.5", "m")).toBe(1_500_000);
    expect(parseMoney("25,000")).toBe(25_000);
    expect(parseMoney("8", "million")).toBe(8_000_000);
  });
});

describe("understand", () => {
  it("leaves a plain place name as the keyword", () => {
    const r = u("jilimani");
    expect(r.understood.criteria).toEqual({ q: "jilimani" });
    expect(r.understood.notes).toEqual([]);
  });
  it("pulls out beds, type, county, price and rent", () => {
    const { criteria } = u("2 bedroom apartment in Nairobi under 80k to rent").understood;
    expect(criteria).toMatchObject({ bedroomsMin: 2, propertyTypes: ["apartment"], countyCodes: [47], priceMax: 80_000, listingType: "rent" });
    expect(criteria.q).toBeUndefined();
  });
  it("keeps the area as the keyword", () => {
    expect(u("3 bedroom house kilimani for sale").understood.criteria).toMatchObject({ bedroomsMin: 3, listingType: "sale", propertyTypes: ["house"], q: "kilimani" });
  });
  it("reads price ranges and a shared unit", () => {
    expect(u("flat between 20k and 40k").understood.criteria).toMatchObject({ priceMin: 20_000, priceMax: 40_000, propertyTypes: ["apartment"] });
    expect(u("house 20-40k").understood.criteria).toMatchObject({ priceMin: 20_000, priceMax: 40_000 });
    expect(u("above 5m").understood.criteria).toMatchObject({ priceMin: 5_000_000 });
  });
  it("does not read bedroom counts as prices", () => {
    const { criteria } = u("2-3 bedroom").understood;
    expect(criteria.priceMin).toBeUndefined();
    expect(criteria.bedroomsMin).toBe(3);
  });
  it("understands words for numbers and furnishing", () => {
    expect(u("three bedroom semi furnished").understood.criteria).toMatchObject({ bedroomsMin: 3, furnishing: "semi_furnished" });
    expect(u("furnished studio").understood.criteria).toMatchObject({ furnishing: "furnished", propertyTypes: ["studio"] });
  });
  it("finds features", () => {
    expect(u("apartment with swimming pool and gym").understood.criteria.features?.length).toBeGreaterThan(0);
  });
});
