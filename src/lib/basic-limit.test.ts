import { describe, expect, it } from "vitest";
import { allowance, countedBasic, pickToFreeze, roomFor, type Row } from "./basic-limit";

const now = new Date("2026-06-20T12:00:00Z").getTime();
const day = 86_400_000;
const row = (id: string, o: Partial<Row> = {}): Row => ({ id, status: "published", views: 10, publishedAt: new Date("2026-01-01"), ...o });
const ended = (id: string, daysAgo: number, o: Partial<Row> = {}) => row(id, { promotion: { boostUntil: new Date(now - daysAgo * day) }, ...o });

describe("counting", () => {
  it("counts only live Basic listings", () => {
    const rows = [row("a"), row("b", { status: "draft" }), row("c", { status: "frozen" }), row("d", { status: "pending_review" }), row("e", { promotion: { boostUntil: new Date(now + day) } }), row("f", { promotion: { premiumUntil: new Date(now + day) } }), row("g", { status: "paused" })];
    expect(countedBasic(rows, now).map((r) => r.id)).toEqual(["a", "d"]);
  });
  it("adds pack slots to the allowance and reports room", () => {
    expect(allowance(10, 10)).toBe(20);
    const rows = [row("a"), row("b")];
    expect(roomFor(rows, 2, now)).toEqual({ used: 2, allowance: 2, room: 0, full: true });
    expect(roomFor(rows, 5, now).room).toBe(3);
  });
});

describe("pickToFreeze", () => {
  it("does nothing when within the limit", () => {
    expect(pickToFreeze([row("a"), row("b")], 2, 3, now)).toEqual([]);
  });
  it("freezes the listings that just lost paid status first, most recent end first", () => {
    const rows = [row("old"), ended("e5", 5), ended("e4", 4), row("new")];
    expect(pickToFreeze(rows, 3, 3, now)).toEqual(["e4"]);
    expect(pickToFreeze(rows, 2, 3, now)).toEqual(["e4", "e5"]);
  });
  it("waits while listings are still inside the grace period", () => {
    const rows = [row("a"), row("b"), ended("fresh", 1)];
    expect(pickToFreeze(rows, 2, 3, now)).toEqual([]);
    expect(pickToFreeze(rows, 2, 0, now)).toEqual(["fresh"]);
  });
  it("only then freezes the least-viewed Basic listings", () => {
    const rows = [row("busy", { views: 90 }), row("quiet", { views: 1 }), row("mid", { views: 20 }), ended("lost", 10)];
    expect(pickToFreeze(rows, 2, 3, now)).toEqual(["lost", "quiet"]);
  });
});
