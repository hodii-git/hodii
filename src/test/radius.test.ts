import { describe, expect, it } from "vitest";
import { clampRadius, radiusStep } from "@/components/property/radius-editor";
import { ACTION_GROUPS, ROLE_ACTIONS } from "@/lib/access";

describe("radius editor", () => {
  it("keeps a typed distance inside 0.5 to 100 km and rounds to 100 m", () => {
    expect(clampRadius(10)).toBe(500);
    expect(clampRadius(2_340)).toBe(2300);
    expect(clampRadius(900_000)).toBe(100_000);
  });
  it("steps bigger as the circle grows", () => {
    expect(radiusStep(500)).toBeLessThan(radiusStep(20_000));
  });
});

describe("role table", () => {
  it("only lists actions that exist and never shows an agent more than an owner", () => {
    const all = new Set(Object.values(ROLE_ACTIONS).flat());
    for (const g of ACTION_GROUPS) for (const i of g.items) expect(all.has(i.action)).toBe(true);
    for (const a of ROLE_ACTIONS.agent) expect(ROLE_ACTIONS.owner).toContain(a);
  });
});
