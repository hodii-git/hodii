import type { Db, Document } from "mongodb";
import { can } from "./access";
import { fail, type Member } from "./dashboard.server";
import { notify, agencyPeople } from "./notifications.server";
import { classifyEnding, cannotJoin, packageState } from "./promotions";
import { mpesaConfigured, packageQuote, refreshSummary } from "./payments.server";
import { getSettings } from "./settings.server";

// Server-only: Premium packages. A package is a number of listing slots for a fixed term. Listings join and leave instantly;
// while a listing is in a running package it is Premium. When the package ends its listings quietly drop back to Basic.

const pkgs = (db: Db) => db.collection("premiumPackages");
const props = (db: Db) => db.collection("properties");
const billing = (m: Pick<Member, "role" | "permissions">) => can(m, "billing.manage");

export async function listPackages(db: Db, m: Member) {
  if (!billing(m)) return fail("Only the agency owner or an admin manages Premium packages");
  const v = await getSettings();
  const rows = await pkgs(db).find({ agencyId: m.agencyId }).sort({ endsAt: -1 }).limit(40).toArray();
  const ids = [...new Set(rows.flatMap((r) => r["listingIds"] as string[]))];
  const listings = ids.length ? await props(db).find({ _id: { $in: ids as never } }, { projection: { title: 1, slug: 1, referenceCode: 1, status: 1, "location.areaName": 1 } }).toArray() : [];
  const byId = new Map(listings.map((l) => [String(l._id), l]));
  const inAny = new Set(ids);
  // Listings that could join a package: live, this agency's, not already in a package that is still running.
  const running = new Set(rows.filter((r) => (r["endsAt"] as Date).getTime() > Date.now()).flatMap((r) => r["listingIds"] as string[]));
  const free = await props(db).find({ agencyId: m.agencyId, status: { $in: ["published", "pending_review", "draft", "frozen", "expired"] } }, { projection: { title: 1, referenceCode: 1, slug: 1, status: 1 } }).sort({ publishedAt: -1 }).limit(300).toArray();
  void inAny;
  return {
    paymentsEnabled: mpesaConfigured(),
    config: { priceKes: Number(v["premium.priceKes"]), slots: Number(v["premium.slots"]), days: Number(v["premium.days"]), extraSlotKes: Number(v["premium.extraSlotKes"]), maxSlots: Number(v["premium.maxSlots"]) },
    packages: rows.map((r) => {
      const endsAt = r["endsAt"] as Date;
      return {
        id: String(r["_id"]), slots: Number(r["slots"]), days: Number(r["days"]), priceKes: Number(r["priceKes"]), startsAt: (r["startsAt"] as Date).toISOString(), endsAt: endsAt.toISOString(),
        state: packageState(endsAt), daysLeft: Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 86_400_000)), paymentId: String(r["paymentId"]),
        listings: (r["listingIds"] as string[]).map((id) => { const l = byId.get(id); return { id, title: l ? String(l["title"]) : "Removed listing", slug: l ? String(l["slug"]) : null, referenceCode: l ? String(l["referenceCode"]) : "", status: l ? String(l["status"]) : "deleted" }; }),
      };
    }),
    available: free.filter((l) => !running.has(String(l._id))).map((l) => ({ id: String(l._id), title: String(l["title"]), referenceCode: String(l["referenceCode"]), status: String(l["status"]) })),
  };
}

/** Puts listings into a package. Each is checked on its own, so one bad listing never blocks the rest; the result says what happened to each. */
export async function attachListings(db: Db, who: { agencyId: string }, packageId: string, ids: string[], opts: { quiet?: boolean } = {}) {
  const pkg = await pkgs(db).findOne({ _id: packageId as never, agencyId: who.agencyId });
  if (!pkg) return fail("Package not found");
  const endsAt = pkg["endsAt"] as Date;
  const rows = await props(db).find({ _id: { $in: [...new Set(ids)].slice(0, 500) as never }, agencyId: who.agencyId }, { projection: { status: 1, title: 1, promotion: 1 } }).toArray();
  const byId = new Map(rows.map((r) => [String(r._id), r]));
  const added: string[] = []; const skipped: { id: string; reason: string }[] = [];
  const attached = new Set(pkg["listingIds"] as string[]);
  for (const id of [...new Set(ids)].slice(0, 500)) {
    const l = byId.get(id);
    if (!l) { skipped.push({ id, reason: "Listing not found" }); continue; }
    const inOther = !!(l["promotion"]?.packageId && l["promotion"]?.premiumUntil instanceof Date && l["promotion"].premiumUntil.getTime() > Date.now());
    const why = cannotJoin({ status: String(l["status"]), inPackage: attached.has(id) || inOther }, { endsAt, slots: Number(pkg["slots"]), attached: attached.size });
    if (why) { skipped.push({ id, reason: why }); continue; }
    // The slot is claimed first, atomically, so two people adding at once cannot overfill a package.
    const claim = await pkgs(db).updateOne({ _id: pkg["_id"], $expr: { $lt: [{ $size: "$listingIds" }, "$slots"] } }, { $addToSet: { listingIds: id }, $set: { updatedAt: new Date() } });
    if (!claim.modifiedCount) { skipped.push({ id, reason: "This package is full." }); continue; }
    attached.add(id);
    await props(db).updateOne({ _id: l._id }, { $set: { "promotion.premiumUntil": endsAt, "promotion.packageId": String(pkg["_id"]), "promotion.packagePaymentId": String(pkg["paymentId"]), updatedAt: new Date() }, $max: { expiresAt: endsAt } });
    await refreshSummary(db, l._id);
    added.push(id);
  }
  // Drafts, frozen and expired listings go live as soon as they join: they are paid for now.
  const { publishPaid } = await import("./dashboard.server");
  for (const id of added) if (["draft", "frozen", "expired"].includes(String(byId.get(id)?.["status"]))) await publishPaid(db, id);
  void opts;
  return { added, skipped };
}

/** Takes a listing out of a package at once. Its slot is free again for the rest of the term. */
export async function detachListing(db: Db, m: Member, packageId: string, listingId: string) {
  if (!billing(m)) return fail("Only the agency owner or an admin manages Premium packages");
  const done = await pkgs(db).updateOne({ _id: packageId as never, agencyId: m.agencyId, listingIds: listingId }, { $pull: { listingIds: listingId } as Document, $set: { updatedAt: new Date() } });
  if (!done.modifiedCount) return fail("That listing is not in this package");
  await props(db).updateOne({ _id: listingId as never, agencyId: m.agencyId, "promotion.packageId": packageId }, { $set: { "promotion.premiumUntil": null, "promotion.packageId": null, "promotion.packagePaymentId": null, updatedAt: new Date() } });
  await refreshSummary(db, listingId);
  return { ok: true as const };
}

export async function addToPackage(db: Db, m: Member, packageId: string, ids: string[]) {
  if (!billing(m)) return fail("Only the agency owner or an admin manages Premium packages");
  return attachListings(db, m, packageId, ids);
}

export { packageQuote };

/**
 * Sends expiry notices once each: "ends soon" and "ended", for boosts and for packages. There is no always-on worker, so this runs
 * when an agency opens its dashboard and, for everyone else, when a scheduler calls /api/cron/promotions (see docs/operations.md).
 */
export async function sweepPromotions(db: Db, scope: { agencyId?: string } = {}) {
  const v = await getSettings();
  const notice = Number(v["premium.renewalNoticeDays"]);
  const now = Date.now();
  const window = { $gt: new Date(now - 3 * 86_400_000), $lte: new Date(now + notice * 86_400_000) };
  const agencyFilter = scope.agencyId ? { agencyId: scope.agencyId } : {};
  let sent = 0;

  const boosted = await props(db).find({ ...agencyFilter, "promotion.boostUntil": window }, { projection: { title: 1, slug: 1, agencyId: 1, agentId: 1, createdBy: 1, "promotion.boostUntil": 1 } }).limit(500).toArray();
  for (const p of boosted) {
    const until = p["promotion"].boostUntil as Date;
    const phase = classifyEnding(until, notice, now);
    if (phase === "other") continue;
    const people = await agencyPeople(db, String(p["agencyId"]), ["owner", "admin"], [p["agentId"] as string | null, p["createdBy"] as string | null]);
    await notify(db, people, { kind: "promotion", title: phase === "soon" ? "Your boost ends soon" : "Your boost has ended", body: `${String(p["title"])} ${phase === "soon" ? `is boosted until ${until.toDateString()}.` : "is no longer boosted."} Boost again to stay on top.`, link: `/dashboard/agency`, dedupeKey: `boost-${phase}:${String(p._id)}:${until.getTime()}` });
    sent++;
  }

  const packages = await pkgs(db).find({ ...agencyFilter, endsAt: window }).limit(500).toArray();
  for (const k of packages) {
    const endsAt = k["endsAt"] as Date;
    const phase = classifyEnding(endsAt, notice, now);
    if (phase === "other") continue;
    const people = await agencyPeople(db, String(k["agencyId"]), ["owner", "admin"]);
    await notify(db, people, { kind: "promotion", title: phase === "soon" ? "Your Premium package ends soon" : "Your Premium package has ended", body: phase === "soon" ? `${(k["listingIds"] as string[]).length} listings are Premium until ${endsAt.toDateString()}. Renew to keep them on top.` : "Its listings are Basic again. Renew the package to put them back.", link: "/dashboard/agency", dedupeKey: `package-${phase}:${String(k["_id"])}` });
    sent++;
  }
  // Space packs, then bring every agency in scope back within its Basic limit (a no-op when it already is).
  const { sweepSpacePacks, enforceBasicLimits } = await import("./basic-space.server");
  await sweepSpacePacks(db, scope);
  // Only an agency with more live Basic listings than the free limit can be over its allowance, so only those are looked at.
  const ids = scope.agencyId ? [scope.agencyId] : (await props(db).aggregate([
    { $match: { status: { $in: ["published", "pending_review"] }, $nor: [{ "promotion.boostUntil": { $gt: new Date(now) } }, { "promotion.premiumUntil": { $gt: new Date(now) } }] } },
    { $group: { _id: "$agencyId", n: { $sum: 1 } } }, { $match: { n: { $gt: Number(v["basic.maxLive"]) } } }, { $limit: 500 },
  ]).toArray()).map((r) => String(r["_id"]));
  let frozen = 0;
  for (const a of ids) frozen += (await enforceBasicLimits(db, a)).frozen;
  return { sent, frozen };
}
