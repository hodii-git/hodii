import { describe, expect, it } from "vitest";
import { searchHeading } from "@/lib/search-title";

describe("searchHeading", () => {
  it("is the plain heading with no search", () => {
    expect(searchHeading({}).title).toBe("Properties in Kenya");
  });
  it("says what was searched", () => {
    const h = searchHeading({ listingType: "rent", propertyTypes: ["apartment"], bedroomsMin: 2, countyCodes: [47], priceMax: 80000 });
    expect(h.title).toBe("2+ bedroom apartments to rent in Nairobi");
    expect(h.subtitle).toContain("up to KES 80,000");
  });
  it("shows the typed words", () => {
    expect(searchHeading({ q: "kilimani" }).title).toBe("Properties matching “kilimani”");
  });
});
