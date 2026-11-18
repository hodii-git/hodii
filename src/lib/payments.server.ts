import type { Db, Document } from "mongodb";
import { can, canEditListing } from "./access";
import { DashboardError, loadOwned, fail, type Member } from "./dashboard.server";
import { boostConfig, extendedUntil, normalizeMpesaPhone, quoteBoost, type PriceInput } from "./pricing";
import { packageEnds, packagePrice, summarise } from "./promotions";
import { getSettings } from "./settings.server";
import { notify } from "./notifications.server";
import { ensureCollectionIndexes } from "./mongodb/ensure";

// Server-only: paying for a boost or a Premium package over M-Pesa (Safaricom Daraja STK push).
// Nothing here blocks publishing: a listing is live whether or not anyone ever pays.

const col = (db: Db) => db.collection("payments");
const ensure = (db: Db) => ensureCollectionIndexes(db, ["payments", "properties", "premiumPackages", "spacePacks"]);
const env = (k: string) => process.env[k]?.trim() || "";

/** True only when every Daraja setting is present. Without them the site shows "payments not enabled" and the agency can skip. */
export const mpesaConfigured = () => ["DARAJA_CONSUMER_KEY", "DARAJA_CONSUMER_SECRET", "DARAJA_SHORTCODE", "DARAJA_PASSKEY", "DARAJA_CALLBACK_SECRET", "PUBLIC_SITE_URL"].every((k) => !!env(k));
const base = () => (env("DARAJA_ENV") === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke");
const stamp = () => new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const password = (ts: string) => btoa(`${env("DARAJA_SHORTCODE")}${env("DARAJA_PASSKEY")}${ts}`);

async function token() {
  const r = await fetch(`${base()}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${btoa(`${env("DARAJA_CONSUMER_KEY")}:${env("DARAJA_CONSUMER_SECRET")}`)}` } });
  if (!r.ok) throw new DashboardError("M-Pesa is not reachable right now. Try again, or skip and feature later.");
  return ((await r.json()) as { access_token: string }).access_token;
}

async function daraja(path: string, body: Record<string, unknown>) {
  const r = await fetch(`${base()}${path}`, { method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

export const callbackUrl = () => `${env("PUBLIC_SITE_URL").replace(/\/$/, "")}/api/mpesa/callback/${env("DARAJA_CALLBACK_SECRET")}`;
export const priceInput = (p: Document): PriceInput => ({ countyCode: (p["location"]?.countyCode as number | null) ?? null, listingType: p["listingType"], category: p["category"], amountKes: Math.max(0, Number(p["price"]?.amountKes ?? 0)) });
const boostEnd = (p: Document) => (p["promotion"]?.boostUntil instanceof Date && p["promotion"].boostUntil.getTime() > Date.now() ? (p["promotion"].boostUntil as Date) : null);

/** What the promote page needs: the price rules (the browser re-computes live, the server re-checks on purchase) and what the listing already has. */
export async function promoteInfo(db: Db, m: Member, id: string) {
  await ensure(db);
  const p = await loadOwned(db, m, id);
  if (!canEditListing(m, p)) return fail("You can only boost your own listings");
  const pending = await col(db).findOne({ propertyId: id, status: "pending", createdAt: { $gt: new Date(Date.now() - 5 * 60_000) } }, { sort: { createdAt: -1 } });
  const doc = p as unknown as Document;
  const now = new Date();
  const openPackages = can(m.role, "billing.manage")
    ? await db.collection("premiumPackages").find({ agencyId: m.agencyId, endsAt: { $gt: now } }).sort({ endsAt: 1 }).limit(20).toArray()
    : [];
  return {
    id, title: p.title, slug: p.slug, status: p.status, areaName: p.location.areaName,
    boostUntil: boostEnd(doc)?.toISOString() ?? null,
    premiumUntil: doc["promotion"]?.premiumUntil instanceof Date && doc["promotion"].premiumUntil > now ? (doc["promotion"].premiumUntil as Date).toISOString() : null,
    priceInput: priceInput(doc), config: boostConfig(await getSettings()),
    paymentsEnabled: mpesaConfigured(), pendingPaymentId: pending ? String(pending["_id"]) : null,
    canBuyPackage: can(m.role, "billing.manage"),
    packagesWithRoom: openPackages.filter((k) => (k["listingIds"] as string[]).length < Number(k["slots"]) && !(k["listingIds"] as string[]).includes(id)).map((k) => ({ id: String(k["_id"]), endsAt: (k["endsAt"] as Date).toISOString(), free: Number(k["slots"]) - (k["listingIds"] as string[]).length })),
  };
}

/** Puts the stored summary (tier, until) back in step with the raw end dates. */
export async function refreshSummary(db: Db, propertyId: unknown) {
  const p = await db.collection("properties").findOne({ _id: propertyId as never }, { projection: { promotion: 1 } });
  if (!p) return;
  const s = summarise({ boostUntil: p["promotion"]?.boostUntil, premiumUntil: p["promotion"]?.premiumUntil });
  await db.collection("properties").updateOne({ _id: propertyId as never }, { $set: { "promotion.tier": s.tier, "promotion.until": s.until } });
}

/** Applies a paid payment. Safe to call twice: only the call that flips pending→paid does the work. */
export async function settle(db: Db, payment: Document, fields: { receipt: string | null; provider: "mpesa" | "manual"; callbackSummary?: Document }) {
  const now = new Date();
  const set: Document = { status: "paid", paidAt: now, updatedAt: now, receipt: fields.receipt, provider: fields.provider };
  if (fields.callbackSummary) set["callbackSummary"] = fields.callbackSummary;
  const done = await col(db).updateOne({ _id: payment["_id"], status: { $ne: "paid" } }, { $set: set });
  if (!done.modifiedCount) return false;
  if (payment["kind"] === "premium_package") { await createPackage(db, payment, now); return true; }
  if (payment["kind"] === "space_pack") { await createSpacePack(db, payment, now); return true; }
  const props = db.collection("properties");
  const p = await props.findOne({ _id: payment["propertyId"] });
  if (!p) return true;
  const until = extendedUntil(boostEnd(p), Number(payment["days"]), now);
  const pr = { ...(p["promotion"] ?? {}), boostUntil: until, boostPaymentId: String(payment["_id"]) };
  const sum = summarise({ boostUntil: until, premiumUntil: pr.premiumUntil });
  // A boost the agency paid for must not outlive the listing: the listing stays live at least until the boost ends.
  await props.updateOne({ _id: p["_id"] }, { $set: { "promotion.boostUntil": until, "promotion.boostPaymentId": String(payment["_id"]), "promotion.tier": sum.tier, "promotion.until": sum.until, updatedAt: now }, $max: { expiresAt: until } });
  // A listing that was waiting for this payment (draft, frozen, expired) goes live now.
  const { publishPaid } = await import("./dashboard.server");
  await publishPaid(db, String(p["_id"]));
  await notify(db, [String(payment["userId"])], { kind: "promotion", title: "Your listing is boosted", body: `${p["title"]} is boosted until ${until.toDateString()}.`, link: `/property/${p["slug"]}`, dedupeKey: `boost-paid:${String(payment["_id"])}` });
  return true;
}

/** A paid package becomes a package record starting now. For a renewal, the listings of the old package are put straight back in. */
async function createPackage(db: Db, payment: Document, now: Date) {
  const days = Number(payment["days"]);
  const _id = crypto.randomUUID();
  const endsAt = packageEnds(days, now);
  await db.collection("premiumPackages").insertOne({ _id: _id as never, schemaVersion: 1, agencyId: payment["agencyId"], purchasedBy: payment["userId"], paymentId: String(payment["_id"]), slots: Number(payment["slots"]), days, priceKes: Number(payment["amountKes"]), startsAt: now, endsAt, listingIds: [], renewedFrom: payment["renewedFrom"] ?? null, noticeSoonAt: null, noticeEndedAt: null, createdAt: now, updatedAt: now });
  await col(db).updateOne({ _id: payment["_id"] }, { $set: { packageId: _id } });
  const { attachListings } = await import("./packages.server");
  const wanted = Array.isArray(payment["attachListingIds"]) ? (payment["attachListingIds"] as string[]) : [];
  const attached = wanted.length ? await attachListings(db, { agencyId: String(payment["agencyId"]) }, _id, wanted, { quiet: true }) : { added: [], skipped: [] };
  await notify(db, [String(payment["userId"])], { kind: "promotion", title: "Premium package active", body: `${Number(payment["slots"])} listing slots until ${endsAt.toDateString()}.${attached.added.length ? ` ${attached.added.length} listing${attached.added.length === 1 ? "" : "s"} added.` : " Add your listings now."}`, link: null, dedupeKey: `package-paid:${_id}` });
}

/** A paid extra-space pack starts now. Listings frozen for being over the limit are not brought back on their own: the agency chooses. */
async function createSpacePack(db: Db, payment: Document, now: Date) {
  const days = Number(payment["days"]), slots = Number(payment["slots"]);
  const endsAt = packageEnds(days, now);
  await db.collection("spacePacks").insertOne({ _id: crypto.randomUUID() as never, schemaVersion: 1, agencyId: payment["agencyId"], purchasedBy: payment["userId"], paymentId: String(payment["_id"]), slots, days, priceKes: Number(payment["amountKes"]), startsAt: now, endsAt, createdAt: now });
  await notify(db, [String(payment["userId"])], { kind: "promotion", title: "Extra listing space added", body: `${slots} more Basic listings until ${endsAt.toDateString()}.`, link: "/dashboard", dedupeKey: `space-paid:${String(payment["_id"])}` });
}

type Checkout = { kind: "boost" | "premium_package" | "space_pack"; propertyId: string | null; days: number; amountKes: number; slots?: number; quote: Document; reference: string; desc: string; phone: string; attachListingIds?: string[]; renewedFrom?: string | null };

/** Records the attempt first (so nothing is lost if Safaricom or the network fails), then asks M-Pesa to prompt the phone. */
async function startCheckout(db: Db, m: Member, c: Checkout) {
  if (!mpesaConfigured()) return fail("Online payments are not switched on yet. You can skip this for now.");
  const phone = normalizeMpesaPhone(c.phone);
  if (!phone) return fail("Enter an M-Pesa number like 0712 345 678");
  const recent = await col(db).countDocuments({ userId: m.userId, createdAt: { $gt: new Date(Date.now() - 10 * 60_000) } });
  if (recent >= 5) return fail("Too many payment attempts. Wait a few minutes and try again.");
  const now = new Date(), ts = stamp();
  const _id = crypto.randomUUID();
  await col(db).insertOne({
    _id: _id as never, schemaVersion: 1, kind: c.kind, propertyId: c.propertyId, agencyId: m.agencyId, userId: m.userId, ...(c.kind === "space_pack" ? {} : { tier: c.kind === "boost" ? "boost" : "premium" }),
    days: c.days, amountKes: c.amountKes, ...(c.slots ? { slots: c.slots } : {}), quote: c.quote, ...(c.attachListingIds?.length ? { attachListingIds: c.attachListingIds } : {}), ...(c.renewedFrom ? { renewedFrom: c.renewedFrom } : {}),
    provider: "mpesa", status: "pending", phoneHint: phone.slice(-3), checkoutRequestId: null, merchantRequestId: null, receipt: null, resultDesc: null, createdAt: now, updatedAt: now, paidAt: null,
  });
  const res = await daraja("/mpesa/stkpush/v1/processrequest", {
    BusinessShortCode: env("DARAJA_SHORTCODE"), Password: password(ts), Timestamp: ts, TransactionType: env("DARAJA_TRANSACTION_TYPE") || "CustomerPayBillOnline",
    Amount: c.amountKes, PartyA: phone, PartyB: env("DARAJA_PARTY_B") || env("DARAJA_SHORTCODE"), PhoneNumber: phone,
    CallBackURL: callbackUrl(), AccountReference: c.reference.slice(0, 12), TransactionDesc: c.desc.slice(0, 20),
  });
  if (String(res.json["ResponseCode"]) !== "0") {
    await col(db).updateOne({ _id: _id as never }, { $set: { status: "failed", resultDesc: String(res.json["errorMessage"] ?? res.json["ResponseDescription"] ?? "Request rejected").slice(0, 300), updatedAt: new Date() } });
    return fail("M-Pesa did not accept the request. Check the number and try again.");
  }
  await col(db).updateOne({ _id: _id as never }, { $set: { checkoutRequestId: String(res.json["CheckoutRequestID"]), merchantRequestId: String(res.json["MerchantRequestID"]), updatedAt: new Date() } });
  return { paymentId: _id, amountKes: c.amountKes, days: c.days };
}

export async function startBoost(db: Db, m: Member, input: { id: string; days: number; phone: string }) {
  await ensure(db);
  const p = await loadOwned(db, m, input.id);
  if (!canEditListing(m, p)) return fail("You can only boost your own listings");
  if (!["published", "pending_review", "draft", "frozen", "expired"].includes(p.status)) return fail("This listing cannot be boosted in its current state");
  const quote = quoteBoost(priceInput(p as unknown as Document), input.days, boostConfig(await getSettings()));
  if (!quote) return fail("Choose a whole number of days within the allowed range");
  return startCheckout(db, m, { kind: "boost", propertyId: p._id, days: quote.days, amountKes: quote.amountKes, quote: { perDayKes: quote.perDayKes, discountPct: quote.discountPct, fullKes: quote.fullKes }, reference: p.referenceCode, desc: "Boost listing", phone: input.phone });
}

export async function packageQuote(slots: number) {
  const v = await getSettings();
  return packagePrice(slots, { priceKes: Number(v["premium.priceKes"]), slots: Number(v["premium.slots"]), days: Number(v["premium.days"]), extraSlotKes: Number(v["premium.extraSlotKes"]), maxSlots: Number(v["premium.maxSlots"]) });
}

export async function startPackage(db: Db, m: Member, input: { slots: number; phone: string; renewFrom?: string | undefined }) {
  if (!can(m.role, "billing.manage")) return fail("Only the agency owner or an admin can buy a package");
  await ensure(db);
  const q = await packageQuote(input.slots);
  if (!q) return fail("Choose a number of listing slots within the allowed range");
  let attach: string[] = [];
  if (input.renewFrom) {
    const old = await db.collection("premiumPackages").findOne({ _id: input.renewFrom as never, agencyId: m.agencyId });
    if (!old) return fail("Package not found");
    attach = (old["listingIds"] as string[]).slice(0, q.slots);
  }
  return startCheckout(db, m, { kind: "premium_package", propertyId: null, days: q.days, amountKes: q.priceKes, slots: q.slots, quote: { extraSlots: q.extraSlots }, reference: "PREMIUM", desc: "Premium package", phone: input.phone, attachListingIds: attach, renewedFrom: input.renewFrom ?? null });
}

/** What the payment page polls. Falls back to asking Safaricom directly when the callback is slow, and gives up after five minutes. */
export async function spaceQuote() {
  const v = await getSettings();
  return { priceKes: Number(v["space.priceKes"]), slots: Number(v["space.slots"]), days: Number(v["space.days"]) };
}

export async function startSpacePack(db: Db, m: Member, input: { phone: string }) {
  if (!can(m.role, "billing.manage")) return fail("Only the agency owner or an admin can buy listing space");
  await ensure(db);
  const q = await spaceQuote();
  if (q.priceKes < 1) return fail("Extra space is not for sale right now.");
  return startCheckout(db, m, { kind: "space_pack", propertyId: null, days: q.days, amountKes: q.priceKes, slots: q.slots, quote: {}, reference: "SPACE", desc: "Listing space", phone: input.phone });
}

export async function paymentStatus(db: Db, m: Member, paymentId: string) {
  const pay = await col(db).findOne({ _id: paymentId as never, agencyId: m.agencyId });
  if (!pay) return fail("Payment not found");
  if (pay["status"] === "pending") {
    const age = Date.now() - (pay["createdAt"] as Date).getTime();
    if (age > 5 * 60_000) { await col(db).updateOne({ _id: pay["_id"], status: "pending" }, { $set: { status: "expired", updatedAt: new Date() } }); return { status: "expired" as const }; }
    if (age > 15_000 && pay["checkoutRequestId"] && mpesaConfigured()) {
      const ts = stamp();
      const r = await daraja("/mpesa/stkpushquery/v1/query", { BusinessShortCode: env("DARAJA_SHORTCODE"), Password: password(ts), Timestamp: ts, CheckoutRequestID: pay["checkoutRequestId"] }).catch(() => null);
      const code = r?.json["ResultCode"];
      if (code !== undefined && String(code) === "0") await settle(db, pay, { receipt: null, provider: "mpesa" });
      else if (code !== undefined) await col(db).updateOne({ _id: pay["_id"], status: "pending" }, { $set: { status: String(code) === "1032" ? "cancelled" : "failed", resultDesc: String(r?.json["ResultDesc"] ?? "").slice(0, 300), updatedAt: new Date() } });
    }
  }
  const now = await col(db).findOne({ _id: pay["_id"] });
  return { status: (now?.["status"] ?? "pending") as "pending" | "paid" | "failed" | "cancelled" | "expired", message: (now?.["resultDesc"] as string | null) ?? null };
}

/** Safaricom's callback. Matched by CheckoutRequestID and by amount, so a forged or replayed call cannot feature anything for free. */
export async function handleCallback(db: Db, body: unknown) {
  const cb = (body as { Body?: { stkCallback?: Document } })?.Body?.stkCallback;
  if (!cb?.["CheckoutRequestID"]) return;
  await ensure(db);
  const pay = await col(db).findOne({ checkoutRequestId: String(cb["CheckoutRequestID"]) });
  if (!pay || pay["status"] === "paid") return;
  if (Number(cb["ResultCode"]) !== 0) {
    await col(db).updateOne({ _id: pay["_id"], status: "pending" }, { $set: { status: Number(cb["ResultCode"]) === 1032 ? "cancelled" : "failed", resultDesc: String(cb["ResultDesc"] ?? "").slice(0, 300), updatedAt: new Date() } });
    return;
  }
  const items = (cb["CallbackMetadata"]?.Item ?? []) as { Name: string; Value?: unknown }[];
  const get = (n: string) => items.find((i) => i.Name === n)?.Value;
  if (Number(get("Amount")) < Number(pay["amountKes"])) { await col(db).updateOne({ _id: pay["_id"] }, { $set: { status: "failed", resultDesc: "Amount paid was less than the price", updatedAt: new Date() } }); return; }
  await settle(db, pay, { receipt: get("MpesaReceiptNumber") ? String(get("MpesaReceiptNumber")).slice(0, 40) : null, provider: "mpesa", callbackSummary: { amount: Number(get("Amount")) || null, receipt: get("MpesaReceiptNumber") ? String(get("MpesaReceiptNumber")).slice(0, 40) : null, transactionDate: get("TransactionDate") ? String(get("TransactionDate")).slice(0, 20) : null } });
}

/** Admin: records a boost paid outside the site (cash, bank, a paybill the callback missed) and applies it. */
export async function recordManualPayment(db: Db, input: { propertyId: string; days: number; amountKes: number; receipt: string | null; adminName: string }) {
  await ensure(db);
  const p = await db.collection("properties").findOne({ _id: input.propertyId as never });
  if (!p) throw new DashboardError("Listing not found");
  const now = new Date(), _id = crypto.randomUUID();
  await col(db).insertOne({ _id: _id as never, schemaVersion: 1, kind: "boost", propertyId: p["_id"], agencyId: p["agencyId"], userId: String(p["createdBy"] ?? p["agentId"] ?? "admin"), tier: "boost", days: input.days, amountKes: Math.max(1, Math.round(input.amountKes)), provider: "manual", status: "pending", phoneHint: null, checkoutRequestId: null, merchantRequestId: null, receipt: input.receipt, resultDesc: `Recorded by ${input.adminName}`.slice(0, 300), createdAt: now, updatedAt: now, paidAt: null });
  const pay = await col(db).findOne({ _id: _id as never });
  await settle(db, pay as Document, { receipt: input.receipt, provider: "manual" });
  return { ok: true as const };
}

/** Admin: records a Premium package paid outside the site, for an agency. */
export async function recordManualPackage(db: Db, input: { agencyId: string; slots: number; amountKes: number; receipt: string | null; adminName: string }) {
  await ensure(db);
  const agency = await db.collection("agencies").findOne({ _id: input.agencyId as never }, { projection: { _id: 1 } });
  if (!agency) throw new DashboardError("Agency not found");
  const owner = await db.collection("agencyMembers").findOne({ agencyId: input.agencyId, role: "owner", status: "active" }, { projection: { userId: 1 } });
  const days = Number((await getSettings())["premium.days"]);
  const now = new Date(), _id = crypto.randomUUID();
  await col(db).insertOne({ _id: _id as never, schemaVersion: 1, kind: "premium_package", propertyId: null, agencyId: input.agencyId, userId: String(owner?.["userId"] ?? "admin"), tier: "premium", days, slots: input.slots, amountKes: Math.max(1, Math.round(input.amountKes)), provider: "manual", status: "pending", phoneHint: null, checkoutRequestId: null, merchantRequestId: null, receipt: input.receipt, resultDesc: `Recorded by ${input.adminName}`.slice(0, 300), createdAt: now, updatedAt: now, paidAt: null });
  await settle(db, (await col(db).findOne({ _id: _id as never })) as Document, { receipt: input.receipt, provider: "manual" });
  return { ok: true as const };
}

export async function recordManualSpace(db: Db, input: { agencyId: string; amountKes: number; receipt: string | null }) {
  await ensure(db);
  const agency = await db.collection("agencies").findOne({ _id: input.agencyId as never }, { projection: { _id: 1 } });
  if (!agency) throw new DashboardError("Agency not found");
  const owner = await db.collection("agencyMembers").findOne({ agencyId: input.agencyId, role: "owner", status: "active" }, { projection: { userId: 1 } });
  const q = await spaceQuote();
  const now = new Date(), _id = crypto.randomUUID();
  await col(db).insertOne({ _id: _id as never, schemaVersion: 1, kind: "space_pack", propertyId: null, agencyId: input.agencyId, userId: String(owner?.["userId"] ?? "admin"), days: q.days, slots: q.slots, amountKes: Math.max(1, Math.round(input.amountKes)), quote: {}, provider: "manual", status: "pending", phoneHint: null, checkoutRequestId: null, merchantRequestId: null, receipt: input.receipt, resultDesc: null, createdAt: now, updatedAt: now, paidAt: null });
  await settle(db, (await col(db).findOne({ _id: _id as never })) as Document, { receipt: input.receipt, provider: "manual" });
  return { ok: true as const };
}

export async function listPayments(db: Db, filter: Document, limit = 100) {
  const rows = await col(db).find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
  return rows.map((r) => ({ id: String(r["_id"]), kind: (r["kind"] as string | undefined) ?? "boost", propertyId: r["propertyId"] ? String(r["propertyId"]) : null, agencyId: String(r["agencyId"]), days: r["days"] as number, slots: (r["slots"] as number | undefined) ?? null, amountKes: r["amountKes"] as number, status: r["status"] as string, provider: r["provider"] as string, receipt: (r["receipt"] as string | null) ?? null, createdAt: (r["createdAt"] as Date).toISOString() }));
}
