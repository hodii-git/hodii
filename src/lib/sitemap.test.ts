import { describe, expect, it } from "vitest";
import { esc, listingSitemapNames, parseListingPart, sitemapIndex, urlset } from "./sitemap";

describe("sitemap", () => {
  it("escapes xml characters", () => expect(esc(`a&b<c>"d'`)).toBe("a&amp;b&lt;c&gt;&quot;d&apos;"));
  it("splits listings into files of 5000", () => { expect(listingSitemapNames(0)).toEqual(["listings-1.xml"]); expect(listingSitemapNames(5000)).toHaveLength(1); expect(listingSitemapNames(5001)).toEqual(["listings-1.xml", "listings-2.xml"]); });
  it("reads a part number only from our own names", () => { expect(parseListingPart("listings-3.xml")).toBe(3); expect(parseListingPart("listings-x.xml")).toBeNull(); expect(parseListingPart("../etc")).toBeNull(); });
  it("writes absolute urls and skips bad dates", () => {
    const x = urlset([{ loc: "/a", lastmod: "nope" }, { loc: "/b?x=1&y=2", lastmod: new Date("2026-01-02T00:00:00Z") }]);
    expect(x).toContain("https://"); expect(x).not.toContain("nope"); expect(x).toContain("&amp;y=2"); expect(x).toContain("<lastmod>2026-01-02");
  });
  it("lists child files in the index", () => expect(sitemapIndex(["pages.xml"])).toContain("/sitemaps/pages.xml"));
});
