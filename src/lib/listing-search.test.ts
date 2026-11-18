import { describe, expect, it } from "vitest";

import { fuzzyPattern, tokenMatch } from "./listing-search";
describe("close matching", () => {
  it("matches a wrong first letter, a missing letter and swapped letters", () => {
    const rx = new RegExp(fuzzyPattern("jilimani")!, "i");
    expect(rx.test("Kilimani")).toBe(true);
    expect(new RegExp(fuzzyPattern("kilmani")!, "i").test("Kilimani")).toBe(true);
    expect(new RegExp(fuzzyPattern("kilimnai")!, "i").test("Kilimani")).toBe(true);
    expect(rx.test("Westlands")).toBe(false);
  });
  it("leaves short words alone", () => {
    expect(fuzzyPattern("abc")).toBeNull();
    expect(JSON.stringify(tokenMatch("abc", true))).not.toContain("|");
  });
});
