import type { Db, Document, Filter } from "mongodb";
import { buildSearchFilter, liveFilter, type SearchParams } from "./listing-search";
import { urlFromParams } from "./search-url";
import type { NOTIFICATION_KINDS } from "./mongodb/property-schemas";

// Server-only: the bell. Notifications are in-site messages; nothing is emailed.

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export type NotifyInput = { kind: NotificationKind; title: string; body?: string; link?: string | null; inviteId?: string | null; dedupeKey?: string | null };

const col = (db: Db) => db.collection("notifications");
const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : null);

/**
 * Adds a notification for each person. Never throws: a failed notification must not undo the action that caused it.
 * A repeated dedupeKey for the same person is skipped.
 */
export async function notify(db: Db, userIds: string[], n: NotifyInput) {
  const now = new Date();
  for (const userId of [...new Set(userIds)].filter(Boolean)) {
    try {
      await col(db).insertOne({
        _id: crypto.randomUUID() as never, schemaVersion: 1, userId, kind: n.kind, title: n.title.slice(0, 120), body: (n.body ?? "").slice(0, 300),
        link: n.link ?? null, inviteId: n.inviteId ?? null, dedupeKey: n.dedupeKey ?? null, readAt: null, createdAt: now,
      });
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) console.error("notify", e);
    }
  }
}

/** Active members of an agency, optionally only some roles, plus an extra person such as the listing's agent. */
export async function agencyPeople(db: Db, agencyId: string, roles: string[] = ["owner", "admin"], also: (string | null | undefined)[] = []) {
  const rows = await db.collection("agencyMembers").find({ agencyId, status: "active", role: { $in: roles } }, { projection: { userId: 1 } }).limit(100).toArray();
  return [...rows.map((r) => String(r["userId"])), ...also.filter((x): x is string => !!x)];
}

export async function listFor(db: Db, userId: string) {
  const [rows, unread] = await Promise.all([
    col(db).find({ userId }).sort({ createdAt: -1 }).limit(50).toArray(),
    col(db).countDocuments({ userId, readAt: null }),
  ]);
  // An invitation is only actionable while it is still pending.
  const inviteIds = rows.map((r) => r["inviteId"]).filter((x): x is string => typeof x === "string");
  const pending = new Set((inviteIds.length ? await db.collection("agencyMembers").find({ _id: { $in: inviteIds as never }, status: "invited" }, { projection: { _id: 1 } }).toArray() : []).map((m) => String(m._id)));
  return {
    unread,
    items: rows.map((r) => ({
      id: String(r["_id"]), kind: String(r["kind"]), title: String(r["title"]), body: String(r["body"] ?? ""), link: typeof r["link"] === "string" ? r["link"] : null,
      invite: typeof r["inviteId"] === "string" && pending.has(r["inviteId"]) ? r["inviteId"] : null, read: !!r["readAt"], at: iso(r["createdAt"]) ?? "",
    })),
  };
}

export const unreadCount = (db: Db, userId: string) => col(db).countDocuments({ userId, readAt: null });
/** Unread notifications that belong to enquiries (replies from agents), for the Inquiries tab dot. */
export const unreadEnquiryCount = (db: Db, userId: string) => col(db).countDocuments({ userId, kind: "enquiry", readAt: null });

export async function markRead(db: Db, userId: string, ids: string[] | "all") {
  const filter: Filter<Document> = ids === "all" ? { userId, readAt: null } : { userId, _id: { $in: ids as never }, readAt: null };
  await col(db).updateMany(filter, { $set: { readAt: new Date() } });
}

export const removeOne = (db: Db, userId: string, id: string) => col(db).deleteOne({ userId, _id: id as never });

/* ───────────── Saved-search and price-drop sweep ─────────────
 * Listings can arrive from the dashboard or straight from an importer, so nothing is triggered at write time. Instead, whenever
 * a person's bell is checked (at most every few minutes) we look at what changed since we last told them.
 */
const lastSweep = new Map<string, number>();
const SWEEP_EVERY_MS = 5 * 60_000;
const FREQUENCY_MS = { instant: 0, daily: 86_400_000, weekly: 7 * 86_400_000 } as const;

export async function sweepFor(db: Db, userId: string, now = new Date()) {
  const last = lastSweep.get(userId) ?? 0;
  if (now.getTime() - last < SWEEP_EVERY_MS) return;
  lastSweep.set(userId, now.getTime());
  if (lastSweep.size > 5000) lastSweep.clear();
  try {
    await Promise.all([sweepSavedSearches(db, userId, now), sweepPriceDrops(db, userId), sweepListingExpiry(db, userId, now)]);
  } catch (e) {
    console.error("notification sweep", e);
  }
}

export async function sweepSavedSearches(db: Db, userId: string, now: Date) {
  const searches = await db.collection("savedSearches").find({ userId, frequency: { $ne: "off" } }).limit(20).toArray();
  for (const s of searches) {
    const freq = String(s["frequency"]) as keyof typeof FREQUENCY_MS;
    const since = (s["lastNotifiedAt"] instanceof Date ? s["lastNotifiedAt"] : s["createdAt"]) as Date;
    if (now.getTime() - since.getTime() < (FREQUENCY_MS[freq] ?? 0)) continue;
    const criteria = (s["criteria"] ?? {}) as Partial<SearchParams>;
    const filter = { ...buildSearchFilter(criteria, now), publishedAt: { $gt: since } } as Filter<Document>;
    const [n, first] = await Promise.all([
      db.collection("properties").countDocuments(filter, { limit: 50 }),
      db.collection("properties").find(filter, { projection: { title: 1 } }).sort({ publishedAt: -1 }).limit(1).toArray(),
    ]);
    if (!n) continue;
    await db.collection("savedSearches").updateOne({ _id: s["_id"] as never }, { $set: { lastNotifiedAt: now } });
    const search = urlFromParams(criteria);
    await notify(db, [userId], {
      kind: "saved_search", title: `${n >= 50 ? "50+" : n} new ${n === 1 ? "property matches" : "properties match"} “${String(s["name"])}”`,
      body: n === 1 ? String(first[0]?.["title"] ?? "") : "Open your search to see them.", link: `/properties?${new URLSearchParams(search as Record<string, string>).toString()}`,
    });
  }
}

/** Tells an agency's people when their listings are about to run out (7 days) and when they have. One notice per listing per expiry date. */
export async function sweepListingExpiry(db: Db, userId: string, now: Date) {
  const memberships = await db.collection("agencyMembers").find({ userId, status: "active" }, { projection: { agencyId: 1, role: 1 } }).limit(20).toArray();
  if (!memberships.length) return;
  const agencies = new Map((await db.collection("agencies").find({ _id: { $in: memberships.map((m) => m["agencyId"]) as never } }, { projection: { slug: 1 } }).toArray()).map((a) => [String(a._id), String(a["slug"])]));
  const soon = new Date(now.getTime() + 7 * 86_400_000);
  const recent = new Date(now.getTime() - 30 * 86_400_000);
  for (const m of memberships) {
    const agencyId = String(m["agencyId"]);
    const own = m["role"] === "agent" ? { agentId: userId } : {};
    const rows = await db.collection("properties").find({ agencyId, ...own, status: { $in: ["published", "expired"] }, expiresAt: { $gt: recent, $lt: soon } }, { projection: { title: 1, expiresAt: 1 } }).sort({ expiresAt: 1 }).limit(30).toArray();
    for (const p of rows) {
      const at = p["expiresAt"] as Date;
      const expired = at.getTime() <= now.getTime();
      await notify(db, [userId], {
        kind: "listing_expiry", title: expired ? `Expired: ${String(p["title"]).slice(0, 80)}` : `Expires soon: ${String(p["title"]).slice(0, 80)}`,
        body: expired ? "It is no longer visible. Confirm it is still available to put it back online." : `It goes offline on ${at.toLocaleDateString("en-KE", { day: "numeric", month: "short" })}. Confirm it is still available to keep it online.`,
        link: `/dashboard/agency/${agencies.get(agencyId) ?? ""}/listings/${String(p._id)}`, dedupeKey: `${expired ? "expired" : "expiring"}:${String(p._id)}:${at.getTime()}`,
      });
    }
  }
}

export async function sweepPriceDrops(db: Db, userId: string) {
  const saved = await db.collection("savedProperties").find({ userId, priceAtSave: { $ne: null } }).sort({ createdAt: -1 }).limit(200).toArray();
  if (!saved.length) return;
  const byId = new Map(saved.map((s) => [String(s["propertyId"]), s]));
  const props = await db.collection("properties").find({ _id: { $in: [...byId.keys()] as never }, ...liveFilter(new Date()) }, { projection: { title: 1, slug: 1, price: 1 } }).toArray();
  for (const p of props) {
    const s = byId.get(String(p._id))!;
    const now = Number((p["price"] as Document | undefined)?.["amount"] ?? 0);
    const was = Number(s["priceAtSave"]);
    if (!now || now >= was) continue;
    await db.collection("savedProperties").updateOne({ _id: s["_id"] as never }, { $set: { priceAtSave: now } });
    const pct = Math.round(((was - now) / was) * 100);
    await notify(db, [userId], { kind: "price_drop", title: `Price drop: ${String(p["title"])}`, body: `Now ${now.toLocaleString("en-KE")}, down ${pct}% from when you saved it.`, link: `/property/${String(p["slug"])}`, dedupeKey: `drop:${String(p._id)}:${now}` });
  }
}
