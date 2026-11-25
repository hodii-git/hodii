import { describe, expect, it } from "vitest";
import { KeyPool, classify, parseKeys } from "./key-pool";

describe("classify", () => {
  it("tells credit problems from wrong keys and busy moments", () => {
    expect(classify(200, "")).toBeNull();
    expect(classify(401, "")).toBe("rejected");
    expect(classify(402, "")).toBe("exhausted");
    expect(classify(429, "Rate limit reached ... tokens per day (TPD)")).toBe("exhausted");
    expect(classify(429, "Rate limit reached, try again in 2s")).toBe("transient");
    expect(classify(503, "")).toBe("transient");
  });
});

describe("KeyPool", () => {
  const keys = ["k".repeat(20), "j".repeat(20), "i".repeat(20)];
  it("moves on from a spent key and brings it back later", () => {
    const p = new KeyPool(keys), t = 1_000;
    p.fail(keys[0]!, "exhausted", t);
    expect(p.available(t)).toEqual([keys[1], keys[2]]);
    expect(p.available(t + 61 * 60_000)).toContain(keys[0]);
  });
  it("rotates after each use", () => {
    const p = new KeyPool(keys);
    p.used(keys[0]!);
    expect(p.available(0)[0]).toBe(keys[1]);
  });
  it("has nothing left when all rest", () => {
    const p = new KeyPool(keys);
    for (const k of keys) p.fail(k, "rejected", 0);
    expect(p.available(1)).toEqual([]);
  });
  it("reads a comma or newline list and ignores junk", () => {
    expect(parseKeys(`${keys[0]}, ${keys[1]}\n${keys[0]}`, "short")).toEqual([keys[0], keys[1]]);
  });
});
