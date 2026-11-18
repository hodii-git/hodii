import { describe, expect, it } from "vitest";
import { cannotJoin, classifyEnding, mixPaid, packagePrice, summarise, tierNow } from "./promotions";

const NOW = Date.UTC(2026, 0, 10);
const at = (days: number) => new Date(NOW + days * 86_400_000);
const V = { priceKes: 15000, slots: 10, days: 30, extraSlotKes: 1000, maxSlots: 200 };

describe("tiers", () => {
  it("is premium over boost over none, and ignores ended runs", () => {
    expect(tierNow({ boostUntil: at(2), premiumUntil: at(5) }, NOW)).toBe("premium");
    expect(tierNow({ boostUntil: at(2), premiumUntil: at(-1) }, NOW)).toBe("boost");
    expect(tierNow({ boostUntil: at(-1) }, NOW)).toBe("none");
    expect(tierNow(null, NOW)).toBe("none");
  });
  it("summarises with the latest end that is still running", () => {
    expect(summarise({ boostUntil: at(9), premiumUntil: at(3) }, NOW)).toEqual({ tier: "premium", until: at(9) });
    expect(summarise({ boostUntil: at(-2) }, NOW)).toEqual({ tier: "none", until: null });
  });
});
describe("package price", () => {
  it("charges the base for the standard slots and extra per slot above", () => {
    expect(packagePrice(10, V)).toEqual({ priceKes: 15000, slots: 10, days: 30, extraSlots: 0 });
    expect(packagePrice(50, V)!.priceKes).toBe(15000 + 40 * 1000);
    expect(packagePrice(5, V)!.priceKes).toBe(15000);
  });
  it("rejects impossible sizes", () => { for (const n of [0, -3, 201, 2.5]) expect(packagePrice(n, V)).toBeNull(); });
});
describe("joining a package", () => {
  const pkg = { endsAt: at(10), slots: 2, attached: 1 };
  it("allows a live, free listing into a package with room", () => expect(cannotJoin({ status: "published", inPackage: false }, pkg, NOW)).toBeNull());
  it("refuses in the cases that matter", () => {
    expect(cannotJoin({ status: "rejected", inPackage: false }, pkg, NOW)).toMatch(/Only live/);
    expect(cannotJoin({ status: "published", inPackage: true }, pkg, NOW)).toMatch(/already/);
    expect(cannotJoin({ status: "published", inPackage: false }, { ...pkg, attached: 2 }, NOW)).toMatch(/full/);
    expect(cannotJoin({ status: "published", inPackage: false }, { ...pkg, endsAt: at(-1) }, NOW)).toMatch(/ended/);
  });
});
describe("ending notices", () => {
  it("sorts into soon, ended and other", () => {
    expect(classifyEnding(at(2), 3, NOW)).toBe("soon");
    expect(classifyEnding(at(10), 3, NOW)).toBe("other");
    expect(classifyEnding(at(-1), 3, NOW)).toBe("ended");
    expect(classifyEnding(at(-30), 3, NOW)).toBe("other");
  });
});
describe("mixPaid", () => {
  const mk = (n: number, paidIdx: number[]) => Array.from({ length: n }, (_, i) => ({ i, paid: paidIdx.includes(i) }));
  it("keeps every item and never exceeds the share on a page", () => {
    const items = mk(40, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const out = mixPaid(items, 10, 30);
    expect(out).toHaveLength(40);
    expect(new Set(out.map((o) => o.i)).size).toBe(40);
    for (let p = 0; p < 4; p++) expect(out.slice(p * 10, p * 10 + 10).filter((o) => o.paid).length).toBeLessThanOrEqual(p === 3 ? 10 : 3 + 0);
  });
  it("keeps relevance order inside each group", () => {
    const out = mixPaid(mk(20, [2, 5, 9]), 10, 50);
    const paidOrder = out.filter((o) => o.paid).map((o) => o.i);
    expect(paidOrder).toEqual([2, 5, 9]);
    const freeOrder = out.filter((o) => !o.paid).map((o) => o.i);
    expect(freeOrder).toEqual([...freeOrder].sort((a, b) => a - b));
  });
  it("does not push a strong organic result below weaker paid ones", () => {
    const out = mixPaid(mk(10, [3, 4, 5]), 10, 100);
    expect(out.map((o) => o.i)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("shows paid listings when nothing else is left", () => expect(mixPaid(mk(5, [0, 1, 2, 3, 4]), 10, 0)).toHaveLength(5));
});
