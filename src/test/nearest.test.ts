import { describe, expect, it } from "vitest";
import { relaxations } from "@/lib/nearest";
import type { SearchParams } from "@/lib/listing-search";

const base = { page: 1, pageSize: 24, sort: "relevance" } as SearchParams;
describe("relaxations", () => {
  it("has nothing to loosen on an empty search", () => { expect(relaxations(base)).toEqual([]); });
  it("loosens in order and keeps earlier steps", () => {
    const steps = relaxations({ ...base, features: ["pool"] as never, bedroomsMin: 3, priceMax: 100000, q: "kilimani" });
    expect(steps.map((s) => s.label)).toEqual(["extra requirements", "one fewer bedroom", "a slightly wider price range", "your keywords"]);
    expect(steps[1]!.params.features).toBeUndefined();
    expect(steps[1]!.params.bedroomsMin).toBe(2);
    expect(steps[2]!.params.priceMax).toBe(130000);
    expect(steps[3]!.params.q).toBeUndefined();
    expect(steps[3]!.params.bedroomsMin).toBe(2);
  });
});
