import { describe, expect, it } from "vitest";
import { COUNTY_LIST, countyByCode, countyBySlug, inKenya, normalizeKenyaPhone, toSlug } from "@/lib/mongodb/kenya";
import { toSqm } from "@/lib/mongodb/taxonomy";

describe("counties", () => {
  it("has the 47 counties with codes 1 to 47 and unique slugs", () => {
    expect(COUNTY_LIST).toHaveLength(47);
    expect(COUNTY_LIST.map((c) => c.code)).toEqual(Array.from({ length: 47 }, (_, i) => i + 1));
    expect(new Set(COUNTY_LIST.map((c) => c.slug)).size).toBe(47);
  });
  it("uses the constitutional codes", () => {
    expect(countyByCode(1)?.name).toBe("Mombasa");
    expect(countyByCode(22)?.name).toBe("Kiambu");
    expect(countyByCode(47)?.name).toBe("Nairobi");
  });
  it("makes clean slugs", () => {
    expect(countyBySlug("muranga")?.name).toBe("Murang'a");
    expect(countyBySlug("taita-taveta")?.code).toBe(6);
    expect(toSlug("Kilimani & Lavington")).toBe("kilimani-and-lavington");
    expect(toSlug("  Ngong  Road ")).toBe("ngong-road");
  });
});

describe("coordinates", () => {
  it("accepts Kenya and rejects elsewhere or swapped values", () => {
    expect(inKenya(-1.29, 36.82)).toBe(true); // Nairobi
    expect(inKenya(-4.04, 39.67)).toBe(true); // Mombasa
    expect(inKenya(36.82, -1.29)).toBe(false); // swapped
    expect(inKenya(51.5, -0.12)).toBe(false); // London
  });
});

describe("phone numbers", () => {
  it.each([
    ["0712 345 678", "+254712345678"],
    ["0112345678", "+254112345678"],
    ["+254 712 345 678", "+254712345678"],
    ["254712345678", "+254712345678"],
    ["712345678", "+254712345678"],
    ["(020) 222 1234", "+254202221234"],
  ])("normalises %s", (input, expected) => expect(normalizeKenyaPhone(input)).toBe(expected));
  it.each(["", "12345", "+1 415 555 0100", "07123", "abc"])("rejects %s", (input) => expect(normalizeKenyaPhone(input)).toBeNull());
});

describe("areas", () => {
  it("converts land sizes to square metres", () => {
    expect(toSqm(1, "acre")).toBeCloseTo(4046.86, 1);
    expect(toSqm(1, "hectare")).toBe(10_000);
    expect(toSqm(100, "sqm")).toBe(100);
    expect(toSqm(1000, "sqft")).toBeCloseTo(92.9, 1);
  });
});
