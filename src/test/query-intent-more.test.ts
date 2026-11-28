import { describe, it, expect } from "vitest";
import { understand } from "@/lib/query-intent";

describe("understand: real sentences", () => {
  it("keeps only the place, and reads parking and 'fully furnished'", () => {
    const c = understand("find me a house to rent in Kilimanjaro, the balcony, a parking for four cars and fully furnished").understood.criteria;
    expect(c.q).toBe("kilimanjaro");
    expect(c.furnishing).toBe("furnished");
    expect(c.features).toEqual(expect.arrayContaining(["balcony", "parking"]));
  });
  it("treats a small price with no rent or buy word as rent", () => {
    const c = understand("3 bedroom house in Ruiru under 4k with full ensuite").understood.criteria;
    expect(c).toMatchObject({ listingType: "rent", priceMax: 4000, bedroomsMin: 3, q: "ruiru" });
    expect(c.features).toContain("en_suite");
  });
  it("treats millions as a purchase", () => {
    expect(understand("land in Kitengela under 3m").understood.criteria.listingType).toBe("sale");
  });
});
