import { describe, expect, it } from "vitest";
import { buildSearchFilter } from "./listing-search";
import { paramsFromUrl, urlFromParams } from "./search-url";
import { directionsUrl, distanceM, polygonArea, radiusLabel, simplify, simplifyTo, type LngLat } from "./geo";

describe("geo helpers", () => {
  it("measures distance", () => { expect(Math.round(distanceM({ lat: -1.2864, lng: 36.8172 }, { lat: -1.2864, lng: 36.8262 }))).toBeGreaterThan(900); });
  it("simplifies a noisy line and keeps the ends", () => {
    const line: LngLat[] = Array.from({ length: 200 }, (_, i) => [36 + i * 0.0001, -1 + (i % 2) * 0.000001]);
    const out = simplify(line, 0.00005); expect(out.length).toBeLessThan(5); expect(out[0]).toEqual(line[0]); expect(out.at(-1)).toEqual(line.at(-1));
  });
  it("never returns more points than allowed", () => {
    const wiggle: LngLat[] = Array.from({ length: 500 }, (_, i) => [36 + Math.cos(i / 8) * 0.05, -1 + Math.sin(i / 8) * 0.05]);
    expect(simplifyTo(wiggle, 60).length).toBeLessThanOrEqual(60);
  });
  it("detects a flat shape", () => { expect(polygonArea([[0, 0], [1, 1], [2, 2]])).toBe(0); expect(polygonArea([[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(1); });
  it("labels radii and builds directions", () => { expect(radiusLabel(500)).toBe("500 m"); expect(radiusLabel(2000)).toBe("2 km"); expect(directionsUrl(-1.3, 36.8)).toContain("destination=-1.3,36.8"); });
});

describe("map search", () => {
  it("round-trips a circle through the address bar", () => {
    const p = paramsFromUrl({ lat: "-1.28640", lng: "36.81720", r: "2000" });
    expect(p.circle).toEqual({ lat: -1.2864, lng: 36.8172, radiusM: 2000 });
    expect(urlFromParams(p)).toMatchObject({ lat: "-1.28640", lng: "36.81720", r: "2000" });
  });
  it("drops a radius under 500 m instead of failing the search", () => { const p = paramsFromUrl({ lat: "-1.2", lng: "36.8", r: "50", for: "rent" }); expect(p.circle).toBeUndefined(); expect(p.listingType).toBe("rent"); });
  it("round-trips a drawn shape", () => {
    const p = paramsFromUrl({ poly: "36.81,-1.29_36.83,-1.29_36.82,-1.31" });
    expect(p.polygon).toHaveLength(3); expect(urlFromParams(p).poly).toBe("36.81000,-1.29000_36.83000,-1.29000_36.82000,-1.31000");
  });
  it("builds geo filters", () => {
    const c = buildSearchFilter({ circle: { lat: -1.28, lng: 36.8, radiusM: 2000 } });
    expect(c["location.point"]).toEqual({ $geoWithin: { $centerSphere: [[36.8, -1.28], 2000 / 6_378_100] } });
    const g = buildSearchFilter({ polygon: [[36.8, -1.2], [36.9, -1.2], [36.9, -1.3]] }) as { "location.point": { $geoWithin: { $geometry: { coordinates: number[][][] } } } };
    const ring = g["location.point"].$geoWithin.$geometry.coordinates[0]!; expect(ring[0]).toEqual(ring.at(-1)); expect(ring).toHaveLength(4);
  });
});
