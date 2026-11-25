import type { Db, Document } from "mongodb";
import { allowance, isLive, pickToFreeze, roomFor, type Row } from "./basic-limit";
import { agencyPeople, notify } from "./notifications.server";
import { PAID_NOW } from "./properties.server";
import { getSettings } from "./settings.server";
import { tierNow } from "./promotions";

// Server-only: how many Basic (free) listings an agency may have, what it has used, and what happens when it is over.

const props = (db: Db) => db.collection("properties");
const STORED = ["draft", "pending_review", "published", "paused", "frozen", "expired"];

export type Usage = {
  allowance: number; used: number; room: number; full: boolean; stored: number; storedMax: number;
  freeLimit: number; packSlots: number; packs: { id: string; slots: number; endsAt: string }[];
  frozen: number; frozenOverLimit: number;
};

async function rowsOf(db: Db, agencyId: string): Promise<Row[]> {
  const docs = await props(db).find({ agencyId, status: { $in: ["published", "pending_review"] } }, { projection: { status: 1, promotion: 1, "stats.views": 1, publishedAt: 1 } }).limit(20000).toArray();
  return docs.map((d) => ({ id: String(d._id), status: String(d["status"]), promotion: d["promotion"], views: Number(d["stats"]?.views ?? 0), publishedAt: d["publishedAt"] instanceof Date ? d["publishedAt"] : null }));
}

export async function agencyUsage(db: Db, agencyId: string, now = new Date()): Promise<Usage> {
  const v = await getSettings();
  const [packs, rows, stored, frozen, frozenOver] = await Promise.all([
    db.collection("spacePacks").find({ agencyId, endsAt: { $gt: now } }).sort({ endsAt: 1 }).limit(50).toArray(),
    rowsOf(db, agencyId),
    props(db).countDocuments({ agencyId, status: { $in: STORED }, $nor: [PAID_NOW(now)] }),
    props(db).countDocuments({ agencyId, status: "frozen" }),
    props(db).countDocuments({ agencyId, status: "frozen", "frozen.reason": "over_limit" }),
  ]);
  const packSlots = packs.reduce((n, p) => n + Number(p["slots"]), 0);
  const free = Number(v["basic.maxLive"]);
  const a = allowance(free, packSlots);
  const r = roomFor(rows, a, now.getTime());
  return { allowance: a, used: r.used, room: r.room, full: r.full, stored, storedMax: Number(v["basic.maxStored"]) + packSlots, freeLimit: free, packSlots, packs: packs.map((p) => ({ id: String(p["_id"]), slots: Number(p["slots"]), endsAt: (p["endsAt"] as Date).toISOString() })), frozen, frozenOverLimit: frozenOver };
}

export type LimitInfo = { kind: "live" | "stored"; used: number; allowance: number; message: string };

/** Null when this listing may go live (or is paid); otherwise what stands in the way. A paid listing is never blocked. */
export async function liveBlock(db: Db, agencyId: string, listing: { _id?: unknown; promotion?: Document | undefined }, now = new Date()): Promise<LimitInfo | null> {
  if (tierNow(listing.promotion as never, now.getTime()) !== "none") return null;
  const u = await agencyUsage(db, agencyId, now);
  // A listing that is already counted (live) is not blocked by its own place.
  const mine = listing._id ? await props(db).countDocuments({ _id: listing._id as never, status: { $in: ["published", "pending_review"] } }) : 0;
  if (mine) return null;
  if (u.used >= u.allowance) return { kind: "live", used: u.used, allowance: u.allowance, message: `Your agency has ${u.used} of ${u.allowance} free live listings. Boost this listing, put it in a Premium package, buy more space, or free up space by freezing or deleting another listing.` };
  return null;
}

/** Null when another Basic listing may be kept at all (drafts and frozen ones count here: this is what limits storage). */
export async function storedBlock(db: Db, agencyId: string): Promise<LimitInfo | null> {
  const u = await agencyUsage(db, agencyId);
  if (u.stored >= u.storedMax) return { kind: "stored", used: u.stored, allowance: u.storedMax, message: `Your agency keeps ${u.stored} of ${u.storedMax} free listings in total, including drafts, paused and frozen ones. Delete or close some, buy more space, or use boosts or Premium for the ones that matter.` };
  return null;
}

/**
 * Brings an agency back within its limit: freezes what is over it (see basic-limit.ts for which) and tells the owner once per batch.
 * Safe to run any number of times; it does nothing when the agency is within its limit.
 */
export async function enforceBasicLimits(db: Db, agencyId: string, now = new Date()): Promise<{ frozen: number }> {
  const v = await getSettings();
  const u = await agencyUsage(db, agencyId, now);
  if (u.used <= u.allowance) return { frozen: 0 };
  const ids = pickToFreeze(await rowsOf(db, agencyId), u.allowance, Number(v["basic.graceDays"]), now.getTime());
  if (!ids.length) return { frozen: 0 };
  const r = await props(db).updateMany({ _id: { $in: ids as never }, agencyId, status: { $in: ["published", "pending_review"] } }, { $set: { status: "frozen", frozen: { reason: "over_limit", at: now }, updatedAt: now } });
  if (!r.modifiedCount) return { frozen: 0 };
  const people = await agencyPeople(db, agencyId, ["owner", "admin"]);
  await notify(db, people, {
    kind: "promotion", title: `${r.modifiedCount} listing${r.modifiedCount === 1 ? " was" : "s were"} frozen`,
    body: "Your boost or Premium package ended and your agency is over its free listing limit, so these listings are hidden for now. Boost or add them to Premium to bring them back, buy more space, or free up space yourself.",
    link: `/dashboard/agency/listings?status=frozen`, dedupeKey: `frozen:${agencyId}:${now.toISOString().slice(0, 13)}`,
  });
  return { frozen: r.modifiedCount };
}

/** Space packs: "ends soon" and "ended" notices, sent once each. Runs with the promotion sweep. */
export async function sweepSpacePacks(db: Db, scope: { agencyId?: string } = {}) {
  const v = await getSettings();
  const notice = Number(v["premium.renewalNoticeDays"]), now = Date.now();
  const filter: Document = { ...(scope.agencyId ? { agencyId: scope.agencyId } : {}), endsAt: { $gt: new Date(now - 3 * 86_400_000), $lte: new Date(now + notice * 86_400_000) } };
  const packs = await db.collection("spacePacks").find(filter).limit(500).toArray();
  for (const k of packs) {
    const endsAt = k["endsAt"] as Date, ended = endsAt.getTime() <= now;
    const people = await agencyPeople(db, String(k["agencyId"]), ["owner", "admin"]);
    await notify(db, people, { kind: "promotion", title: ended ? "Your extra listing space has ended" : "Your extra listing space ends soon", body: ended ? "If you are now over your free limit, some listings may be frozen. You can renew the space to keep them live." : `${Number(k["slots"])} extra listings until ${endsAt.toDateString()}. Renew to keep them live.`, link: "/dashboard", dedupeKey: `space-${ended ? "ended" : "soon"}:${String(k["_id"])}` });
  }
}

export { isLive };
