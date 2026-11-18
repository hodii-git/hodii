import { describe, expect, it } from "vitest";
import { nairobiDay, stuckPending, summarise, type PaidRow } from "@/lib/revenue";

const now = new Date("2026-11-17T10:00:00Z");
const row = (o: Partial<PaidRow> & { ago?: number }): PaidRow => ({ kind: "boost", agencyId: "a", amountKes: 1000, status: "paid", paidAt: new Date(now.getTime() - (o.ago ?? 0) * 3_600_000), ...o });

describe("revenue", () => {
  it("uses the Nairobi day", () => {
    expect(nairobiDay(new Date("2026-11-16T21:30:00Z"))).toBe("2026-11-17");
  });
  it("totals gross, refunded and net", () => {
    const r = summarise([row({}), row({ amountKes: 500, status: "refunded" }), row({ kind: "premium_package", amountKes: 15000, agencyId: "b" })], 7, now);
    expect(r).toMatchObject({ grossKes: 16500, refundedKes: 500, netKes: 16000, count: 3, refundCount: 1, averageKes: 8000 });
    expect(r.byKind[0]).toMatchObject({ kind: "premium_package", kes: 15000 });
    expect(r.topAgencies[0]!.agencyId).toBe("b");
  });
  it("ignores payments outside the range and fills empty days", () => {
    const r = summarise([row({ ago: 24 * 10 })], 7, now);
    expect(r.count).toBe(0);
    expect(r.byDay).toHaveLength(7);
    expect(r.byDay.every((d) => d.kes === 0)).toBe(true);
  });
  it("finds stuck pending payments", () => {
    const rows = [{ status: "pending", createdAt: new Date(now.getTime() - 3_600_000) }, { status: "pending", createdAt: new Date(now.getTime() - 60_000) }, { status: "paid", createdAt: new Date(now.getTime() - 9e6) }];
    expect(stuckPending(rows, now)).toHaveLength(1);
  });
});
