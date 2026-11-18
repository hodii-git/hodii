import { describe, expect, it } from "vitest";
import { CATEGORY_SEARCHES, categorySearch, paramsFromUrl, urlFromParams } from "@/lib/search-url";
import { PROPERTY_TYPE_KEYS, CONDITION_KEYS, LISTING_TYPE_KEYS, PROPERTY_CATEGORY_KEYS } from "@/lib/mongodb/taxonomy";
import { moreCategories, primaryCategories } from "@/data/categories";

describe("search url", () => {
  it("reads lists and numbers", () => {
    const p = paramsFromUrl({ for: "rent", type: "apartment,house", county: "47,1", min: "50000", max: "120000", beds: "2", verified: "1", page: "3" });
    expect(p).toMatchObject({ listingType: "rent", propertyTypes: ["apartment", "house"], countyCodes: [47, 1], priceMin: 50000, priceMax: 120000, bedroomsMin: 2, verifiedOnly: true, page: 1, sort: "relevance" });
  });
  it("drops only the bad piece", () => {
    const p = paramsFromUrl({ for: "rent", type: "castle", beds: "abc", county: "99" });
    expect(p.listingType).toBe("rent");
    expect(p.propertyTypes).toBeUndefined();
    expect(p.bedroomsMin).toBeUndefined();
    expect(p.countyCodes).toBeUndefined();
  });
  it("ignores an impossible price range", () => {
    const p = paramsFromUrl({ min: "900", max: "100", for: "sale" });
    expect(p.priceMin).toBeUndefined();
    expect(p.listingType).toBe("sale");
  });
  it("round-trips through the url", () => {
    const p = paramsFromUrl({ for: "sale", cat: "land", min: "1000000", sort: "price_asc", q: "kitengela" });
    expect(paramsFromUrl(urlFromParams(p))).toEqual(p);
  });
  it("leaves defaults out of the url", () => {
    expect(urlFromParams(paramsFromUrl({}))).toEqual({});
  });
  it("every navigation category opens a valid search", () => {
    for (const [slug, c] of Object.entries(CATEGORY_SEARCHES)) {
      const s = c.search;
      if (s.for) expect(LISTING_TYPE_KEYS, slug).toContain(s.for);
      if (s.cat) expect(PROPERTY_CATEGORY_KEYS, slug).toContain(s.cat);
      for (const t of s.type?.split(",") ?? []) expect(PROPERTY_TYPE_KEYS, `${slug}:${t}`).toContain(t);
      for (const t of s.cond?.split(",") ?? []) expect(CONDITION_KEYS, `${slug}:${t}`).toContain(t);
    }
  });
  it("covers every category in the header and footer", () => {
    for (const label of [...primaryCategories, ...moreCategories]) expect(categorySearch(label), label).not.toBeNull();
  });
});
