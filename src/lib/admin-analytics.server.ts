import { tierNow } from "./promotions";
import { refreshSummary } from "./payments.server";
import type { Db, Document } from "mongodb";
import { z } from "zod";
import { COUNTY_LIST } from "./mongodb/kenya";
import { liveFilter } from "./listing-search";

// Server-only: the numbers behind the admin Overview, Market analytics, Listings, Agencies and Users tabs.
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const countyName = (code: unknown) => COUNTY_LIST.find((c) => c.code === code)?.name ?? "Unknown";
export class AdminDataError extends Error {}

/** Every date from `since` to today, so a quiet day shows as zero instead of a gap in the chart. */
export function dayRange(days: number, today = new Date()) {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(dayKey(new Date(today.getTime() - i * 86_400_000)));
  return out;
}

export async function platformOverview(db: Db) {
  const now = new Date();
  const week = new Date(now.getTime() - 7 * 86_400_000);
  const since = dayKey(new Date(now.getTime() - 29 * 86_400_000));
  const flaggedQ = { $or: [{ hidden: true }, { "reportedBy.0": { $exists: true } }] };
  const [byStatus, agencies, users, newUsers, openReports, pendingListings, daily, leads, nbReviewFlags, nbPostFlags] = await Promise.all([
    db.collection("properties").aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
    db.collection("agencies").aggregate([{ $group: { _id: "$verification.status", n: { $sum: 1 } } }]).toArray(),
    db.collection("users").countDocuments({}),
    db.collection("users").countDocuments({ createdAt: { $gte: week } }),
    db.collection("listingReports").countDocuments({ status: { $in: ["open", "reviewing"] } }),
    db.collection("properties").countDocuments({ status: "pending_review" }),
    db.collection("propertyDailyStats").aggregate([{ $match: { date: { $gte: since } } }, { $group: { _id: null, views: { $sum: "$views" }, enquiries: { $sum: "$enquiries" }, phoneReveals: { $sum: "$phoneReveals" }, saves: { $sum: "$saves" } } }]).toArray(),
    db.collection("enquiries").aggregate([{ $match: { createdAt: { $gte: new Date(now.getTime() - 30 * 86_400_000) } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
    db.collection("neighbourhoodReviews").countDocuments(flaggedQ),
  db.collection("neighbourhoodPosts").countDocuments({ ...flaggedQ, deletedAt: null }),
]);
  const map = (rows: Document[]) => Object.fromEntries(rows.map((r) => [str(r["_id"], "none"), num(r["n"])]));
  const d = daily[0] ?? {};
  const l = map(leads);
  const total = Object.values(l).reduce((a, b) => a + b, 0);
  return {
    listings: map(byStatus), agencies: map(agencies), users, newUsers, openReports, pendingListings, neighbourhoodFlags: nbReviewFlags + nbPostFlags,
    last30: { views: num(d["views"]), enquiries: num(d["enquiries"]), phoneReveals: num(d["phoneReveals"]), saves: num(d["saves"]) },
    // Share of the last month's enquiries that somebody has moved past "new": a quick read on how responsive agencies are.
    responseRate: total ? Math.round(((total - (l["new"] ?? 0)) / total) * 100) : null,
  };
}

export const analyticsInput = z.object({ days: z.number().int().min(7).max(365) });

export async function marketAnalytics(db: Db, days: number) {
  const dates = dayRange(days);
  const since = dates[0]!;
  const match = { date: { $gte: since } };
  const stats = db.collection("propertyDailyStats");
  const [daily, byType, byCounty, topListings, topAgencies, supply, categories] = await Promise.all([
    stats.aggregate([{ $match: match }, { $group: { _id: "$date", views: { $sum: "$views" }, uniqueViews: { $sum: "$uniqueViews" }, enquiries: { $sum: "$enquiries" }, saves: { $sum: "$saves" }, phoneReveals: { $sum: "$phoneReveals" }, whatsappClicks: { $sum: "$whatsappClicks" } } }]).toArray(),
    stats.aggregate([{ $match: match }, { $group: { _id: "$listingType", views: { $sum: "$views" }, enquiries: { $sum: "$enquiries" } } }]).toArray(),
    stats.aggregate([{ $match: { ...match, countyCode: { $ne: null } } }, { $group: { _id: "$countyCode", views: { $sum: "$views" }, enquiries: { $sum: "$enquiries" } } }, { $sort: { views: -1 } }, { $limit: 10 }]).toArray(),
    stats.aggregate([{ $match: match }, { $group: { _id: "$propertyId", views: { $sum: "$views" }, enquiries: { $sum: "$enquiries" } } }, { $sort: { views: -1 } }, { $limit: 10 }]).toArray(),
    stats.aggregate([{ $match: match }, { $group: { _id: "$agencyId", views: { $sum: "$views" }, enquiries: { $sum: "$enquiries" } } }, { $sort: { enquiries: -1, views: -1 } }, { $limit: 10 }]).toArray(),
    db.collection("properties").aggregate([{ $match: liveFilter(new Date()) }, { $group: { _id: "$location.countyCode", listings: { $sum: 1 } } }]).toArray(),
    db.collection("properties").aggregate([{ $match: liveFilter(new Date()) }, { $group: { _id: { t: "$listingType", c: "$category" }, listings: { $sum: 1 } } }]).toArray(),
  ]);
  const props = new Map((await db.collection("properties").find({ _id: { $in: topListings.map((t) => t["_id"]) } as never }, { projection: { title: 1, slug: 1, referenceCode: 1 } }).toArray()).map((p) => [str(p["_id"]), p]));
  const agencies = new Map((await db.collection("agencies").find({ _id: { $in: topAgencies.map((t) => t["_id"]) } as never }, { projection: { name: 1, slug: 1 } }).toArray()).map((a) => [str(a["_id"]), a]));
  const byDate = new Map(daily.map((d) => [str(d["_id"]), d]));
  const series = dates.map((date) => { const d = byDate.get(date); return { day: date, views: num(d?.["views"]), visitors: num(d?.["uniqueViews"]), enquiries: num(d?.["enquiries"]) }; });
  const sum = (k: string) => daily.reduce((a, d) => a + num(d[k]), 0);
  const supplyByCounty = new Map(supply.map((s) => [s["_id"], num(s["listings"])]));
  return {
    series,
    funnel: { views: sum("views"), saves: sum("saves"), phoneReveals: sum("phoneReveals") + sum("whatsappClicks"), enquiries: sum("enquiries") },
    byType: byType.map((t) => ({ label: str(t["_id"]).replace("_", " "), value: num(t["views"]), sub: `${num(t["enquiries"])} enquiries` })),
    byCounty: byCounty.map((c) => ({ label: countyName(c["_id"]), value: num(c["views"]), sub: `${num(c["enquiries"])} enquiries · ${supplyByCounty.get(c["_id"]) ?? 0} listings` })),
    topListings: topListings.map((t) => ({ label: str(props.get(str(t["_id"]))?.["title"], "Removed listing").slice(0, 70), value: num(t["views"]), sub: `${num(t["enquiries"])} enquiries` })),
    topAgencies: topAgencies.map((t) => ({ label: str(agencies.get(str(t["_id"]))?.["name"], "Removed agency"), value: num(t["enquiries"]), sub: `${num(t["views"])} views` })),
    supply: categories.map((c) => ({ label: `${str(c["_id"]?.["t"]).replace("_", " ")} · ${str(c["_id"]?.["c"])}`, value: num(c["listings"]) })).sort((a, b) => b.value - a.value),
  };
}

/* ───────────── Listings ───────────── */

export const listingsInput = z.object({ q: z.string().trim().max(80).default(""), status: z.enum(["all", "draft", "pending_review", "published", "paused", "expired", "rejected", "closed"]).default("all"), offset: z.number().int().min(0).max(100000).default(0), limit: z.number().int().min(1).max(50).default(20) });

export async function adminListings(db: Db, f: z.infer<typeof listingsInput>) {
  const filter: Document = {};
  if (f.status !== "all") filter["status"] = f.status;
  if (f.q) { const rx = new RegExp(f.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); filter["$or"] = [{ title: rx }, { referenceCode: rx }, { "location.areaName": rx }]; }
  const [docs, total] = await Promise.all([
    db.collection("properties").find(filter, { projection: { title: 1, slug: 1, referenceCode: 1, status: 1, agencyId: 1, listingType: 1, price: 1, promotion: 1, expiresAt: 1, stats: 1, "location.county": 1, publishedAt: 1 } }).sort({ updatedAt: -1 }).skip(f.offset).limit(f.limit).toArray(),
    db.collection("properties").countDocuments(filter),
  ]);
  const agencies = new Map((await db.collection("agencies").find({ _id: { $in: [...new Set(docs.map((d) => d["agencyId"]))] } as never }, { projection: { name: 1 } }).toArray()).map((a) => [str(a["_id"]), str(a["name"])]));
  const rows = docs.map((d) => ({
    id: str(d["_id"]), title: str(d["title"]), slug: str(d["slug"]), ref: str(d["referenceCode"]), status: str(d["status"]), listingType: str(d["listingType"]), agency: agencies.get(str(d["agencyId"])) ?? "Unknown",
    price: d["price"] ? `${str(d["price"]["currency"])} ${num(d["price"]["amount"]).toLocaleString("en-KE")}` : "—", county: str(d["location"]?.["county"]),
    tier: tierNow({ boostUntil: d["promotion"]?.["boostUntil"], premiumUntil: d["promotion"]?.["premiumUntil"] }),
    views: num(d["stats"]?.["views"]), enquiries: num(d["stats"]?.["enquiries"]), expiresAt: iso(d["expiresAt"]),
  }));
  const next = f.offset + rows.length;
  return { rows, total, nextOffset: next < total ? next : null };
}

export const listingAction = z.object({ id: z.string().min(1).max(64), action: z.enum(["pause", "resume", "feature", "unfeature"]) });

export async function actOnListing(db: Db, input: z.infer<typeof listingAction>) {
  const p = await db.collection("properties").findOne({ _id: input.id as never }, { projection: { status: 1 } });
  if (!p) throw new AdminDataError("Listing not found");
  const now = new Date();
  const col = db.collection("properties");
  if (input.action === "pause") {
    if (p["status"] !== "published") throw new AdminDataError("Only live listings can be paused");
    await col.updateOne({ _id: input.id as never }, { $set: { status: "paused", updatedAt: now } });
  } else if (input.action === "resume") {
    if (p["status"] !== "paused") throw new AdminDataError("Only paused listings can be resumed");
    await col.updateOne({ _id: input.id as never }, { $set: { status: "published", updatedAt: now } });
  } else if (input.action === "feature") {
    if (p["status"] !== "published") throw new AdminDataError("Only live listings can be boosted");
    // A complimentary 30-day boost granted by staff: no payment is attached, which is how it can be told apart from a paid one.
    await col.updateOne({ _id: input.id as never }, { $set: { "promotion.boostUntil": new Date(now.getTime() + 30 * 86_400_000), "promotion.boostPaymentId": null, updatedAt: now } });
    await refreshSummary(db, input.id);
  } else {
    await col.updateOne({ _id: input.id as never }, { $set: { "promotion.boostUntil": null, "promotion.boostPaymentId": null, updatedAt: now } });
    await refreshSummary(db, input.id);
  }
  return { ok: true as const };
}

/* ───────────── Agencies ───────────── */

export const agenciesInput = z.object({ q: z.string().trim().max(80).default(""), status: z.enum(["all", "unverified", "pending", "verified", "rejected", "suspended"]).default("all"), offset: z.number().int().min(0).max(100000).default(0), limit: z.number().int().min(1).max(50).default(20) });

export async function adminAgencies(db: Db, f: z.infer<typeof agenciesInput>) {
  const filter: Document = {};
  if (f.status === "suspended") filter["status"] = "suspended"; else if (f.status !== "all") filter["verification.status"] = f.status;
  if (f.q) filter["name"] = new RegExp(f.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const [docs, total] = await Promise.all([db.collection("agencies").find(filter).sort({ createdAt: -1 }).skip(f.offset).limit(f.limit).toArray(), db.collection("agencies").countDocuments(filter)]);
  const ids = docs.map((d) => d["_id"]);
  const now = new Date();
  const [live, members, waiting] = await Promise.all([
    db.collection("properties").aggregate([{ $match: { agencyId: { $in: ids }, ...liveFilter(now) } }, { $group: { _id: "$agencyId", n: { $sum: 1 } } }]).toArray(),
    db.collection("agencyMembers").aggregate([{ $match: { agencyId: { $in: ids }, status: "active" } }, { $group: { _id: "$agencyId", n: { $sum: 1 } } }]).toArray(),
    // Listings an agency has sent in that are not live yet count too, so an unverified agency's work shows on its card.
    db.collection("properties").aggregate([{ $match: { agencyId: { $in: ids }, status: "pending_review" } }, { $group: { _id: "$agencyId", n: { $sum: 1 } } }]).toArray(),
  ]);
  const waitBy = new Map(waiting.map((r) => [str(r["_id"]), num(r["n"])]));
  const liveBy = new Map(live.map((r) => [str(r["_id"]), num(r["n"])])), memBy = new Map(members.map((r) => [str(r["_id"]), num(r["n"])]));
  const rows = docs.map((a) => ({ id: str(a["_id"]), name: str(a["name"]), slug: str(a["slug"]), kind: str(a["kind"]), verification: str(a["verification"]?.["status"], "unverified"), suspended: a["status"] === "suspended", suspendedReason: typeof a["suspendedReason"] === "string" ? a["suspendedReason"] : null, pendingListings: waitBy.get(str(a["_id"])) ?? 0, liveListings: liveBy.get(str(a["_id"])) ?? 0, team: memBy.get(str(a["_id"])) ?? 0, createdAt: iso(a["createdAt"]) }));
  const next = f.offset + rows.length;
  return { rows, total, nextOffset: next < total ? next : null };
}

export const agencyAction = z.object({ id: z.string().min(1).max(64), action: z.enum(["suspend", "reinstate"]), reason: z.string().trim().max(500).optional() })
  .refine((v) => v.action === "reinstate" || (v.reason && v.reason.length >= 5), { path: ["reason"], message: "Say why, in a few words" });

/** Suspending takes the agency's listings off the site at once; reinstating brings back only the ones that were paused by the suspension. */
export async function actOnAgency(db: Db, input: z.infer<typeof agencyAction>) {
  const a = await db.collection("agencies").findOne({ _id: input.id as never }, { projection: { status: 1 } });
  if (!a) throw new AdminDataError("Agency not found");
  const now = new Date();
  if (input.action === "suspend") {
    await db.collection("agencies").updateOne({ _id: input.id as never }, { $set: { status: "suspended", suspendedReason: input.reason ?? null, updatedAt: now } });
    await db.collection("properties").updateMany({ agencyId: input.id, status: "published" }, { $set: { status: "paused", suspendedByAgency: true, updatedAt: now } });
  } else {
    await db.collection("agencies").updateOne({ _id: input.id as never }, { $set: { status: "active", suspendedReason: null, updatedAt: now } });
    await db.collection("properties").updateMany({ agencyId: input.id, suspendedByAgency: true, status: "paused" }, { $set: { status: "published", updatedAt: now }, $unset: { suspendedByAgency: "" } });
  }
  try {
    const { notify, agencyPeople } = await import("./notifications.server");
    const ag = await db.collection("agencies").findOne({ _id: input.id as never }, { projection: { name: 1, slug: 1 } });
    await notify(db, await agencyPeople(db, input.id), { kind: "agency_decision", title: input.action === "suspend" ? `${ag?.["name"] ?? "Your agency"} was suspended` : `${ag?.["name"] ?? "Your agency"} was reinstated`, body: input.action === "suspend" ? `Your live listings were taken down. ${input.reason ?? ""}`.trim() : "Your listings are live again.", link: `/dashboard/agency/${ag?.["slug"] ?? ""}` });
  } catch (e) { console.error("agency notification", e); }
  return { ok: true as const };
}

/* ───────────── Users ───────────── */

export const usersInput = z.object({ q: z.string().trim().max(80).default(""), type: z.enum(["all", "user", "agency", "blocked"]).default("all"), offset: z.number().int().min(0).max(100000).default(0), limit: z.number().int().min(1).max(50).default(20) });

export async function adminUsers(db: Db, f: z.infer<typeof usersInput>, decrypt: (v: string) => Promise<string>) {
  const filter: Document = {};
  if (f.type === "blocked") filter["blocked"] = true; else if (f.type === "agency") filter["accountType"] = "agency"; else if (f.type === "user") filter["accountType"] = { $ne: "agency" };
  if (f.q) filter["username"] = new RegExp(f.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const [docs, total] = await Promise.all([db.collection("users").find(filter).sort({ createdAt: -1 }).skip(f.offset).limit(f.limit).toArray(), db.collection("users").countDocuments(filter)]);
  const ids = docs.map((d) => str(d["_id"]));
  const [members, saved, leads] = await Promise.all([
    db.collection("agencyMembers").aggregate([{ $match: { userId: { $in: ids }, status: "active" } }, { $group: { _id: "$userId", n: { $sum: 1 } } }]).toArray(),
    db.collection("savedProperties").aggregate([{ $match: { userId: { $in: ids } } }, { $group: { _id: "$userId", n: { $sum: 1 } } }]).toArray(),
    db.collection("enquiries").aggregate([{ $match: { userId: { $in: ids } } }, { $group: { _id: "$userId", n: { $sum: 1 } } }]).toArray(),
  ]);
  const by = (rows: Document[]) => new Map(rows.map((r) => [str(r["_id"]), num(r["n"])]));
  const m = by(members), s = by(saved), e = by(leads);
  const rows = await Promise.all(docs.map(async (d) => ({
    id: str(d["_id"]), username: str(d["username"]), email: await decrypt(str(d["emailEnc"])), accountType: d["accountType"] === "agency" ? "agency" : "user", blocked: d["blocked"] === true,
    agencies: m.get(str(d["_id"])) ?? 0, saved: s.get(str(d["_id"])) ?? 0, enquiries: e.get(str(d["_id"])) ?? 0, createdAt: iso(d["createdAt"]), lastSignInAt: iso(d["lastSignInAt"]),
  })));
  const next = f.offset + rows.length;
  return { rows, total, nextOffset: next < total ? next : null };
}

/** Deleting an account removes its sign-in and personal records. Enquiries stay with the agency but lose the link to the person. */
export async function deleteUserData(db: Db, userId: string) {
  const owns = await db.collection("agencyMembers").aggregate([{ $match: { userId, role: "owner", status: "active" } }, { $lookup: { from: "agencyMembers", let: { a: "$agencyId" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$agencyId", "$$a"] }, { $eq: ["$role", "owner"] }, { $eq: ["$status", "active"] }, { $ne: ["$userId", userId] }] } } }], as: "others" } }, { $match: { others: { $size: 0 } } }, { $count: "n" }]).toArray();
  if (num(owns[0]?.["n"]) > 0) throw new AdminDataError("This person is the only owner of an agency. Suspend the agency or add another owner first.");
  // Their reviews go with them, and the ratings of the agencies they reviewed are recomputed.
  const reviewed = await db.collection("agencyReviews").distinct("agencyId", { userId });
  await db.collection("agencyReviews").deleteMany({ userId });
  const { refreshRating } = await import("./agency-reviews.server");
  for (const agencyId of reviewed) await refreshRating(db, String(agencyId));
  await Promise.all([
    db.collection("users").deleteOne({ _id: userId as never }), db.collection("userSessions").deleteMany({ userId }),
    db.collection("savedProperties").deleteMany({ userId }), db.collection("savedSearches").deleteMany({ userId }),
    db.collection("agencyMembers").updateMany({ userId }, { $set: { status: "removed" } }),
    import("./comments.server").then((c) => c.blank(db, { userId })),
    db.collection("neighbourhoodReviews").deleteMany({ userId }), db.collection("neighbourhoodPosts").updateMany({ userId }, { $set: { deletedAt: new Date(), textEnc: null } }),
    db.collection("propertyCommentLikes").deleteMany({ userId }), db.collection("notifications").deleteMany({ userId }), db.collection("tourProgress").deleteMany({ userId }), db.collection("feedback").updateMany({ userId }, { $set: { userId: null, name: null, email: null } }),
    db.collection("enquiries").updateMany({ userId }, { $set: { userId: null } }),
    db.collection("enquiryMessages").deleteMany({ senderUserId: userId, senderRole: "enquirer" }),
  ]);
  return { ok: true as const };
}

/* ───────────── Bulk work and exports ───────────── */

export const adminBulkInput = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(200),
  action: z.enum(["pause", "resume", "feature", "unfeature", "delete"]),
  /** For delete: "DELETE n", typed in full, plus the admin's own password. */
  confirmText: z.string().max(40).optional(), password: z.string().max(200).optional(),
});

export async function adminBulkListings(db: Db, input: z.infer<typeof adminBulkInput>, checkPassword: (pw: string) => Promise<boolean>) {
  const ids = [...new Set(input.ids)];
  if (input.action === "delete") {
    const { deletePhrase, phraseMatches } = await import("./bulk-rules");
    if (!input.confirmText || !phraseMatches(input.confirmText, deletePhrase(ids.length))) throw new AdminDataError(`Type DELETE ${ids.length} to confirm`);
    if (!input.password || !(await checkPassword(input.password))) throw new AdminDataError("Your password is needed to delete listings, and it was not right");
  }
  const skipped: { id: string; reason: string }[] = [];
  let done = 0;
  for (const id of ids) {
    try {
      if (input.action === "delete") {
        const r = await db.collection("properties").deleteOne({ _id: id as never });
        if (!r.deletedCount) throw new AdminDataError("Listing not found");
        await Promise.all([db.collection("savedProperties").deleteMany({ propertyId: id }), db.collection("propertyComments").updateMany({ propertyId: id }, { $set: { textEnc: null, deletedAt: new Date() } })]);
      } else await actOnListing(db, { id, action: input.action });
      done++;
    } catch (e) { if (e instanceof AdminDataError) skipped.push({ id, reason: e.message }); else throw e; }
  }
  return { done, skipped };
}

export const exportKind = z.object({ kind: z.enum(["listings", "agencies", "users", "payments"]) });

/** CSV for spreadsheets. People's emails are encrypted and are never exported. */
export async function adminExport(db: Db, kind: z.infer<typeof exportKind>["kind"]) {
  const { toCsv } = await import("./csv");
  const d = (v: unknown) => (v instanceof Date ? v.toISOString() : "");
  if (kind === "listings") {
    const rows = await db.collection("properties").find({}).sort({ updatedAt: -1 }).limit(20_000).toArray();
    const names = new Map((await db.collection("agencies").find({}, { projection: { name: 1 } }).toArray()).map((a) => [str(a["_id"]), str(a["name"])]));
    return toCsv([["reference", "status", "title", "agency", "type", "property_type", "price", "currency", "period", "county", "area", "views", "enquiries", "published", "expires"],
      ...rows.map((p) => [p["referenceCode"], p["status"], p["title"], names.get(str(p["agencyId"])), p["listingType"], p["propertyType"], p["price"]?.["amount"], p["price"]?.["currency"], p["price"]?.["period"], p["location"]?.["county"], p["location"]?.["areaName"], p["stats"]?.["views"], p["stats"]?.["enquiries"], d(p["publishedAt"]), d(p["expiresAt"])])]);
  }
  if (kind === "agencies") {
    const rows = await db.collection("agencies").find({}).sort({ createdAt: -1 }).limit(20_000).toArray();
    return toCsv([["name", "slug", "kind", "status", "verification", "county", "phone", "email", "website", "rating", "reviews", "created"],
      ...rows.map((a) => [a["name"], a["slug"], a["kind"], a["status"], a["verification"]?.["status"], a["address"]?.["countyCode"], a["contact"]?.["phone"], a["contact"]?.["email"], a["contact"]?.["website"], a["rating"]?.["avg"], a["rating"]?.["count"], d(a["createdAt"])])]);
  }
  if (kind === "users") {
    const rows = await db.collection("users").find({}).sort({ createdAt: -1 }).limit(50_000).toArray();
    return toCsv([["username", "account_type", "blocked", "terms_accepted", "created"], ...rows.map((u) => [u["username"], u["accountType"] ?? "user", u["blocked"] ? "yes" : "no", d(u["termsAcceptedAt"]), d(u["createdAt"])])]);
  }
  const rows = await db.collection("payments").find({}).sort({ createdAt: -1 }).limit(20_000).toArray();
  const names = new Map((await db.collection("agencies").find({}, { projection: { name: 1 } }).toArray()).map((a) => [str(a["_id"]), str(a["name"])]));
  return toCsv([["created", "paid", "kind", "status", "provider", "agency", "days", "slots", "amount_kes", "receipt", "property_id", "refunded", "refund_note"],
    ...rows.map((p) => [d(p["createdAt"]), d(p["paidAt"]), p["kind"] ?? "boost", p["status"], p["provider"], names.get(str(p["agencyId"])), p["days"], p["slots"], p["amountKes"], p["receipt"], p["propertyId"], d(p["refundedAt"]), p["refundNote"]])]);
}
