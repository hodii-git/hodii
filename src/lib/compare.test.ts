import { describe, expect, it } from "vitest";
import { perSqm } from "./compare";

describe("perSqm", () => {
  it("divides price by size", () => expect(perSqm(10_000_000, 200)).toBe(50_000));
  it("is null without both numbers", () => { expect(perSqm(null, 200)).toBeNull(); expect(perSqm(1000, 0)).toBeNull(); expect(perSqm(1000, undefined)).toBeNull(); });
});
