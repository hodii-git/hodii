import { describe, expect, it } from "vitest";
import { adjustAmount, deletePhrase, phraseMatches } from "./bulk-rules";

describe("bulk rules", () => {
  it("asks for the reference code for one listing and a count for many", () => {
    expect(deletePhrase(1, "HD-ABC234")).toBe("HD-ABC234"); expect(deletePhrase(7)).toBe("DELETE 7"); expect(deletePhrase(1)).toBe("DELETE 1");
  });
  it("matches the typed phrase exactly, ignoring case and outer spaces", () => {
    expect(phraseMatches(" delete 7 ", "DELETE 7")).toBe(true); expect(phraseMatches("DELETE 8", "DELETE 7")).toBe(false); expect(phraseMatches("DELETE", "DELETE 7")).toBe(false);
  });
  it("adjusts prices by a percentage and keeps them tidy", () => {
    expect(adjustAmount(45_000, 10)).toBe(49_500); expect(adjustAmount(12_345_678, -5)).toBe(11_728_400); expect(adjustAmount(500, 10)).toBe(550);
  });
  it("refuses a zero, huge or non-numeric change", () => { expect(adjustAmount(45_000, 0)).toBeNull(); expect(adjustAmount(45_000, 500)).toBeNull(); expect(adjustAmount(45_000, -80)).toBeNull(); expect(adjustAmount(45_000, NaN)).toBeNull(); });
});
