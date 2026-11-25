import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));
import { fillByLevels, levelsFor, type Place } from "@/lib/home-nearby.server";
import { regionOfCounty } from "@/lib/mongodb/kenya";

const kilimani: Place = { areaSlug: "kilimani", area: "Kilimani", subCounty: "Dagoretti North", countyCode: 47, county: "Nairobi", label: "Kilimani, Nairobi" };

describe("home page nearby lists", () => {
  it("goes from area up to the whole country", () => {
    expect(levelsFor(kilimani).map((l) => l.level)).toEqual(["area", "subCounty", "county", "region", "country"]);
    expect(levelsFor({ ...kilimani, areaSlug: null, area: null, subCounty: null }).map((l) => l.level)).toEqual(["county", "region", "country"]);
  });
  it("puts Nairobi, Kiambu, Kajiado and Machakos in one metro region", () => {
    expect(regionOfCounty(47)?.counties).toEqual(expect.arrayContaining([22, 34, 16]));
  });
  it("fills from the narrowest level and stops when full", async () => {
    const stock: Record<string, string[]> = { area: ["a1", "a2"], subCounty: [], county: ["c1", "c2", "c3"], region: ["r1"], country: ["k1"] };
    const levels = levelsFor(kilimani);
    const asked: string[] = [];
    const r = await fillByLevels(levels, 4, async (filter, exclude, limit) => {
      const level = levels.find((l) => l.filter === filter)!.level;
      asked.push(level);
      return (stock[level] ?? []).filter((id) => !exclude.includes(id)).slice(0, limit).map((id) => ({ id }));
    });
    expect(r.items.map((i) => i.id)).toEqual(["a1", "a2", "c1", "c2"]);
    expect(r.scopes.map((s) => [s.level, s.count])).toEqual([["area", 2], ["county", 2]]);
    expect(asked).toEqual(["area", "subCounty", "county"]);
  });
  it("reaches the country when the area has nothing", async () => {
    const levels = levelsFor({ ...kilimani, areaSlug: null, area: null, subCounty: null });
    const r = await fillByLevels(levels, 2, async (filter) => (levels[2]!.filter === filter ? [{ id: "x" }, { id: "y" }] : []));
    expect(r.scopes.map((s) => s.level)).toEqual(["country"]);
  });
});
