import { describe, expect, it } from "vitest";
import { closest, distance, skeleton } from "./fuzzy";

const counties = [{ name: "Kiambu", item: 22 }, { name: "Kilifi", item: 3 }, { name: "Nairobi", item: 47 }, { name: "Nakuru", item: 32 }];
describe("closest", () => {
  it("fixes common misspellings", () => {
    expect(closest("kimboi", counties)?.item).toBe(22);
    expect(closest("nairovi", counties)?.item).toBe(47);
    expect(closest("nakuru", counties)?.exact).toBe(true);
  });
  it("does not guess wildly", () => {
    expect(closest("mombasa", counties)).toBeNull();
    expect(closest("ab", counties)).toBeNull();
  });
  it("measures distance and sound", () => {
    expect(distance("kiambu", "kiambu")).toBe(0);
    expect(distance("kiambu", "kimbu")).toBe(1);
    expect(skeleton("Kiambu")).toBe(skeleton("kimboi"));
  });
});
