import { describe, expect, it } from "vitest";
import { shouldHide, summarise, trustLabel } from "./review-rules";

describe("review rules", () => {
  it("summarises ratings", () => {
    const s = summarise([5, 5, 4, 1]);
    expect(s).toEqual({ count: 4, avg: 3.8, distribution: [1, 0, 0, 1, 2] });
    expect(summarise([])).toEqual({ count: 0, avg: 0, distribution: [0, 0, 0, 0, 0] });
  });
  it("ignores impossible ratings", () => { expect(summarise([6, 0, 3]).count).toBe(1); });
  it("hides after three reports", () => { expect(shouldHide(2)).toBe(false); expect(shouldHide(3)).toBe(true); });
  it("labels small samples honestly", () => {
    expect(trustLabel(0, 0)).toBe("No reviews yet"); expect(trustLabel(1, 5)).toContain("too few"); expect(trustLabel(12, 4.26)).toBe("4.3 from 12 reviews");
  });
});
