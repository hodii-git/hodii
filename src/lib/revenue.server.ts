import type { Db, Document } from "mongodb";
import { z } from "zod";
import { refreshSummary } from "./payments.server";
import { stuckPending, summarise, type PaidRow } from "./revenue";

export const revenueInput = z.object({ days: z.number().int().min(7).max(366).default(30) });

export async function revenueReport(db: Db, days: number) {
  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000);
  const paid = await db.collection("payments").find({ status: { $in: ["paid", "refunded"] }, paidAt: { $gte: since } }, { projection: { kind: 1, agencyId: 1, amountKes: 1, paidAt: 1, status: 1 } }).limit(50_000).toArray();
  const rows: PaidRow[] = paid.map((r) => ({ kind: (r["kind"] as string | undefined) ?? "boost", agencyId: String(r["agencyId"]), amountKes: Number(r["amountKes"]), paidAt: r["paidAt"] as Date, status: r["status"] as "paid" | "refunded" }));
  const rev = summarise(rows, days, now);
  const names = new Map((await db.collection("agencies").find({ _id: { $in: rev.topAgencies.map((a) => a.agencyId) as never[] } }, { projection: { name: 1 } }).toArray()).map((a) => [String(a["_id"]), String(a["name"])]));
  const pending = await db.collection("payments").find({ status: "pending", createdAt: { $lt: new Date(now.getTime() - 30 * 60_000) } }, { projection: { amountKes: 1, kind: 1, agencyId: 1, createdAt: 1, status: 1, phoneHint: 1 } }).sort({ createdAt: -1 }).limit(50).toArray();
  const stuck = stuckPending(pending.map((p) => ({ status: "pending", createdAt: p["createdAt"] as Date, id: String(p["_id"]), kind: (p["kind"] as string | undefined) ?? "boost", amountKes: Number(p["amountKes"]), phoneHint: (p["phoneHint"] as string | null) ?? null })), now);
  return { ...rev, topAgencies: rev.topAgencies.map((a) => ({ ...a, name: names.get(a.agencyId) ?? a.agencyId })), stuck: stuck.map((s) => ({ id: s.id, kind: s.kind, amountKes: s.amountKes, phoneHint: s.phoneHint, createdAt: s.createdAt.toISOString() })) };
}

export const refundInput = z.object({ id: z.string().min(1).max(64), note: z.string().trim().min(3).max(300) });

/**
 * Records a refund and ends what was bought: the boost, the Premium package (its listings fall back to Basic) or the extra space.
 * The money itself is returned outside the site (M-Pesa reversal); this keeps the books and the benefits honest. Safe to call twice.
 */
export async function refundPayment(db: Db, input: z.infer<typeof refundInput>, adminName: string) {
  const now = new Date();
  const pay = db.collection("payments");
  const p = await pay.findOneAndUpdate({ _id: input.id as never, status: "paid" }, { $set: { status: "refunded", refundedAt: now, refundNote: input.note, refundedBy: adminName, updatedAt: now } }, { returnDocument: "before" });
  if (!p) return { ok: false as const, error: "Only a paid payment can be refunded, and only once." };
  const kind = (p["kind"] as string | undefined) ?? "boost";
  const pid = String(p["_id"]);
  if (kind === "boost" && p["propertyId"]) {
    const prop = await db.collection("properties").findOne({ _id: p["propertyId"] as never }, { projection: { "promotion.boostPaymentId": 1 } });
    // Only end the boost if this payment is the one that last extended it; a newer paid boost stays.
    if (prop && prop["promotion"]?.boostPaymentId === pid) {
      await db.collection("properties").updateOne({ _id: p["propertyId"] as never }, { $set: { "promotion.boostUntil": now, updatedAt: now } });
      await refreshSummary(db, p["propertyId"]);
    }
  } else if (kind === "premium_package") {
    const pk = await db.collection("premiumPackages").findOneAndUpdate({ paymentId: pid }, { $set: { endsAt: now, updatedAt: now } });
    if (pk) {
      await db.collection("properties").updateMany({ "promotion.packageId": String(pk["_id"]) } as Document, { $set: { "promotion.premiumUntil": now, updatedAt: now } });
      for (const id of (pk["listingIds"] as string[]) ?? []) await refreshSummary(db, id);
    }
  } else if (kind === "space_pack") {
    await db.collection("spacePacks").updateOne({ paymentId: pid }, { $set: { endsAt: now } });
  }
  // Bring the agency back inside its limits straight away.
  const { enforceBasicLimits } = await import("./basic-space.server");
  await enforceBasicLimits(db, String(p["agencyId"]));
  return { ok: true as const };
}
