import { describe, expect, it } from "vitest";
import { greetingFor } from "@/lib/greeting";

describe("greeting", () => {
  it("follows the hour", () => {
    expect([3, 8, 11].map(greetingFor)).toEqual(Array(3).fill("Good morning"));
    expect([12, 14, 16].map(greetingFor)).toEqual(Array(3).fill("Good afternoon"));
    expect([17, 20, 23].map(greetingFor)).toEqual(Array(3).fill("Good evening"));
  });
  it("stays evening through the night", () => { expect([0, 1, 2].map(greetingFor)).toEqual(Array(3).fill("Good evening")); });
  it("copes with odd input", () => { expect(greetingFor(24)).toBe("Good evening"); expect(greetingFor(-1)).toBe("Good evening"); expect(greetingFor(9.7)).toBe("Good morning"); });
});
