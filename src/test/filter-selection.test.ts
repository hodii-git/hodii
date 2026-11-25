import { describe, expect, it } from "vitest";
import { filterSelection } from "../lib/filter-selection";

describe("filter selection", () => {
  it("clears an already selected optional filter", () => {
    expect(filterSelection("rent", "rent", true)).toBe("");
  });
  it("keeps the default filter in the empty state", () => {
    expect(filterSelection("", "", true)).toBe("");
    expect(filterSelection("rent", "", true)).toBe("");
  });
  it("applies another option and preserves required choices", () => {
    expect(filterSelection("rent", "sale", true)).toBe("sale");
    expect(filterSelection("rent", "rent", false)).toBe("rent");
  });
});