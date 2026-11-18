import { describe, expect, it } from "vitest";
import { criteriaOf, nameSearch } from "@/components/property/save-search";
import { scopeText } from "@/components/property/near-you";

describe("saved searches", () => {
  it("keeps filters but not sorting or paging", () => {
    expect(criteriaOf({ listingType: "rent", countyCodes: [47], bedroomsMin: 2, sort: "price_asc", page: 3, areaSlugs: [] })).toEqual({ listingType: "rent", countyCodes: [47], bedroomsMin: 2 });
  });
  it("names a search in plain words", () => {
    expect(nameSearch({ listingType: "rent", countyCodes: [47], propertyTypes: ["apartment"] })).toMatch(/^Apartment .*in Nairobi$/);
  });
  it("describes how far a list reached", () => {
    expect(scopeText([{ level: "area", label: "Kilimani", count: 2 }, { level: "county", label: "Nairobi", count: 3 }])).toBe("Kilimani and nearby");
    expect(scopeText([{ level: "county", label: "Mombasa", count: 1 }, { level: "country", label: "Kenya", count: 5 }])).toBe("Mombasa and across Kenya");
  });
});
