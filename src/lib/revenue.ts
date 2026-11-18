/** Revenue maths, kept pure so it can be tested. Money is whole KES. Days are Africa/Nairobi calendar days (UTC+3, no daylight saving). */
export type PaidRow = { kind: string; agencyId: string; amountKes: number; paidAt: Date; status: "paid" | "refunded" };

const EAT = 3 * 3_600_000;
export const nairobiDay = (d: Date) => new Date(d.getTime() + EAT).toISOString().slice(0, 10);

export type Revenue = {
  grossKes: number; refundedKes: number; netKes: number; count: number; refundCount: number; averageKes: number;
  byDay: { day: string; kes: number }[]; byKind: { kind: string; kes: number; count: number }[]; topAgencies: { agencyId: string; kes: number; count: number }[];
};

/** Totals for payments paid in the last `days` days. Refunded payments count as gross and as refunded, so net is what was kept. */
export function summarise(rows: readonly PaidRow[], days: number, now = new Date(), topN = 10): Revenue {
  const since = now.getTime() - days * 86_400_000;
  const inRange = rows.filter((r) => r.paidAt.getTime() >= since && r.paidAt.getTime() <= now.getTime());
  const gross = inRange.reduce((n, r) => n + r.amountKes, 0);
  const refunded = inRange.filter((r) => r.status === "refunded").reduce((n, r) => n + r.amountKes, 0);
  const day = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) day.set(nairobiDay(new Date(now.getTime() - i * 86_400_000)), 0);
  const kind = new Map<string, { kes: number; count: number }>(), agency = new Map<string, { kes: number; count: number }>();
  for (const r of inRange) {
    const net = r.status === "refunded" ? 0 : r.amountKes;
    const k = nairobiDay(r.paidAt);
    if (day.has(k)) day.set(k, (day.get(k) ?? 0) + net);
    const a = kind.get(r.kind) ?? { kes: 0, count: 0 }; kind.set(r.kind, { kes: a.kes + net, count: a.count + 1 });
    const b = agency.get(r.agencyId) ?? { kes: 0, count: 0 }; agency.set(r.agencyId, { kes: b.kes + net, count: b.count + 1 });
  }
  const paidCount = inRange.length - inRange.filter((r) => r.status === "refunded").length;
  return {
    grossKes: gross, refundedKes: refunded, netKes: gross - refunded, count: inRange.length, refundCount: inRange.length - paidCount,
    averageKes: paidCount ? Math.round((gross - refunded) / paidCount) : 0,
    byDay: [...day].map(([d, kes]) => ({ day: d, kes })),
    byKind: [...kind].map(([k, v]) => ({ kind: k, ...v })).sort((x, y) => y.kes - x.kes),
    topAgencies: [...agency].map(([agencyId, v]) => ({ agencyId, ...v })).sort((x, y) => y.kes - x.kes).slice(0, topN),
  };
}

/** Pending payments older than `minutes`: the customer was prompted but nothing came back. Worth a look in case M-Pesa money was taken. */
export function stuckPending<T extends { status: string; createdAt: Date }>(rows: readonly T[], now = new Date(), minutes = 30): T[] {
  return rows.filter((r) => r.status === "pending" && now.getTime() - r.createdAt.getTime() > minutes * 60_000);
}
