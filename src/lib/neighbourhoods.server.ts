import type { Db, Document } from "mongodb";
import { z } from "zod";
import { decrypt, encrypt } from "./community.server";
import { liveFilter } from "./listing-search";
import { ASPECT_KEYS, NB_LIMITS, shouldHide, makeKey, passes, rankScore, splitKey, summarise, type AspectKey, type Ratings, type ReviewInput, type Summary } from "./neighbourhood";

// Server-only. Neighbourhoods are the areas where something is listed; reviews and chat hang off "county-slug/area-slug".

const reviews = (db: Db) => db.collection("neighbourhoodReviews");
const posts = (db: Db) => db.collection("neighbourhoodPosts");
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const hueFor = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

export type AreaRow = { key: string; countySlug: string; areaSlug: string; name: string; county: string; countyCode: number | null; listings: number; summary: Summary };

/** Every area with at least one live listing, with the number of listings. */
async function areaRows(db: Db) {
  const rows = await db.collection("properties").aggregate([
    { $match: { ...liveFilter(new Date()), "location.areaSlug": { $type: "string" }, "location.countySlug": { $type: "string" } } },
    { $group: { _id: { c: "$location.countySlug", a: "$location.areaSlug" }, name: { $first: "$location.areaName" }, county: { $first: "$location.county" }, code: { $first: "$location.countyCode" }, n: { $sum: 1 } } },
    { $limit: 2000 },
  ]).toArray();
  return rows.map((r) => ({ key: makeKey(str(r["_id"].c), str(r["_id"].a)), countySlug: str(r["_id"].c), areaSlug: str(r["_id"].a), name: str(r["name"]), county: str(r["county"]), countyCode: typeof r["code"] === "number" ? r["code"] : null, listings: Number(r["n"]) }));
}

async function summaries(db: Db, keys: string[]): Promise<Map<string, Summary>> {
  if (!keys.length) return new Map();
  const rows = await reviews(db).find({ areaKey: { $in: keys }, hidden: { $ne: true } }, { projection: { areaKey: 1, ratings: 1 } }).limit(50_000).toArray();
  const by = new Map<string, Ratings[]>();
  for (const r of rows) by.set(str(r["areaKey"]), [...(by.get(str(r["areaKey"])) ?? []), r["ratings"] as Ratings]);
  return new Map(keys.map((k) => [k, summarise(by.get(k) ?? [])]));
}

export const nbSearch = z.object({
  q: z.string().trim().max(60).optional(), countyCode: z.number().int().min(1).max(47).optional(),
  sort: z.enum(["rating", "reviews", "listings", "name"]).default("rating"),
  minRating: z.number().min(1).max(5).optional(), aspect: z.enum(ASPECT_KEYS).optional(), minAspect: z.number().min(1).max(5).optional(),
  page: z.number().int().min(1).max(100).default(1),
});

export async function listNeighbourhoods(db: Db, p: z.infer<typeof nbSearch>) {
  const q = p.q?.toLowerCase();
  let rows = (await areaRows(db)).filter((r) => (!p.countyCode || r.countyCode === p.countyCode) && (!q || r.name.toLowerCase().includes(q) || r.county.toLowerCase().includes(q)));
  const sums = await summaries(db, rows.map((r) => r.key));
  let items: AreaRow[] = rows.map((r) => ({ ...r, summary: sums.get(r.key) ?? summarise([]) }));
  items = items.filter((r) => passes(r.summary, { minRating: p.minRating, aspect: p.aspect, minAspect: p.minAspect }));
  items.sort((a, b) => p.sort === "name" ? a.name.localeCompare(b.name) : p.sort === "listings" ? b.listings - a.listings : p.sort === "reviews" ? b.summary.count - a.summary.count || b.listings - a.listings : rankScore(b.summary) - rankScore(a.summary) || b.listings - a.listings);
  const size = 24;
  return { items: items.slice((p.page - 1) * size, p.page * size), total: items.length, pageSize: size };
}

async function oneArea(db: Db, key: string): Promise<AreaRow | null> {
  const { countySlug, areaSlug } = splitKey(key);
  const rows = await db.collection("properties").aggregate([
    { $match: { ...liveFilter(new Date()), "location.areaSlug": areaSlug, "location.countySlug": countySlug } },
    { $group: { _id: null, name: { $first: "$location.areaName" }, county: { $first: "$location.county" }, code: { $first: "$location.countyCode" }, n: { $sum: 1 } } },
  ]).toArray();
  const r = rows[0];
  if (!r) return null;
  return { key, countySlug, areaSlug, name: str(r["name"]), county: str(r["county"]), countyCode: typeof r["code"] === "number" ? r["code"] : null, listings: Number(r["n"]), summary: (await summaries(db, [key])).get(key) ?? summarise([]) };
}

export async function getNeighbourhood(db: Db, key: string) {
  const area = await oneArea(db, key);
  if (!area) return null;
  const [rv, prices] = await Promise.all([
    reviews(db).find({ areaKey: key, hidden: { $ne: true } }).sort({ updatedAt: -1 }).limit(100).toArray(),
    db.collection("properties").aggregate([{ $match: { ...liveFilter(new Date()), "location.areaSlug": area.areaSlug, "location.countySlug": area.countySlug, "price.amountKes": { $gt: 0 } } }, { $group: { _id: "$listingType", avg: { $avg: "$price.amountKes" } } }]).toArray(),
  ]);
  const names = new Map((await db.collection("users").find({ _id: { $in: [...new Set(rv.map((r) => str(r["userId"])))] as never } }, { projection: { username: 1 } }).toArray()).map((u) => [String(u["_id"]), str(u["username"])]));
  return {
    area,
    averages: { rent: Math.round(Number(prices.find((x) => x["_id"] === "rent")?.["avg"] ?? 0)) || null, sale: Math.round(Number(prices.find((x) => x["_id"] === "sale")?.["avg"] ?? 0)) || null },
    reviews: await Promise.all(rv.map(async (r) => ({ id: str(r["_id"]), ratings: r["ratings"] as Ratings, relation: str(r["relation"]), text: await decrypt(r["textEnc"] as string | null), at: (r["updatedAt"] as Date).toISOString(), author: { username: names.get(str(r["userId"])) ?? "former_member", hue: hueFor(str(r["userId"])) } }))),
  };
}

export async function compareNeighbourhoods(db: Db, keys: string[]) {
  const out = await Promise.all(keys.slice(0, 3).map(async (k) => {
    const a = await oneArea(db, k);
    if (!a) return null;
    const prices = await db.collection("properties").aggregate([{ $match: { ...liveFilter(new Date()), "location.areaSlug": a.areaSlug, "location.countySlug": a.countySlug, "price.amountKes": { $gt: 0 } } }, { $group: { _id: "$listingType", avg: { $avg: "$price.amountKes" } } }]).toArray();
    return { ...a, rent: Math.round(Number(prices.find((x) => x["_id"] === "rent")?.["avg"] ?? 0)) || null, sale: Math.round(Number(prices.find((x) => x["_id"] === "sale")?.["avg"] ?? 0)) || null };
  }));
  return out.filter((x): x is NonNullable<typeof x> => x !== null);
}

export async function myReview(db: Db, userId: string, key: string) {
  const r = await reviews(db).findOne({ areaKey: key, userId });
  return r ? { id: str(r["_id"]), ratings: r["ratings"] as Ratings, relation: str(r["relation"]), text: await decrypt(r["textEnc"] as string | null) } : null;
}

export async function saveReview(db: Db, userId: string, input: ReviewInput) {
  if (!(await oneArea(db, input.areaKey))) throw new Error("We only take reviews for areas that have listings on Hodii");
  const now = new Date();
  const ratings = Object.fromEntries(Object.entries(input.ratings).filter(([, v]) => v !== undefined));
  await reviews(db).updateOne({ areaKey: input.areaKey, userId } as never, { $set: { ratings, relation: input.relation, textEnc: input.text ? await encrypt(input.text) : null, updatedAt: now }, $setOnInsert: { _id: crypto.randomUUID(), schemaVersion: 1, createdAt: now } } as never, { upsert: true });
  return { ok: true as const };
}
export async function deleteMyReview(db: Db, userId: string, key: string) { await reviews(db).deleteOne({ areaKey: key, userId } as never); return { ok: true as const }; }

/* ───────────────────────────── Group chat ───────────────────────────── */

export async function listPosts(db: Db, key: string) {
  const raw = await posts(db).find({ areaKey: key, hidden: { $ne: true } }).sort({ createdAt: 1 }).limit(1000).toArray();
  const names = new Map((await db.collection("users").find({ _id: { $in: [...new Set(raw.map((r) => str(r["userId"])))] as never } }, { projection: { username: 1 } }).toArray()).map((u) => [String(u["_id"]), str(u["username"])]));
  return Promise.all(raw.map(async (r) => ({
    id: str(r["_id"]), parentId: (r["parentId"] as string | null) ?? null, at: (r["createdAt"] as Date).toISOString(), deleted: !!r["deletedAt"], text: r["deletedAt"] ? "" : await decrypt(r["textEnc"] as string | null),
    author: r["deletedAt"] ? { username: "deleted", hue: 0 } : { username: names.get(str(r["userId"])) ?? "former_member", hue: hueFor(str(r["userId"])) }, mine: false,
  })));
}

export async function addPost(db: Db, userId: string, key: string, text: string, parentId: string | null) {
  if (!(await oneArea(db, key))) throw new Error("This neighbourhood is not available");
  const [mine, recent] = await Promise.all([posts(db).countDocuments({ areaKey: key, userId, deletedAt: null }), posts(db).countDocuments({ userId, createdAt: { $gte: new Date(Date.now() - NB_LIMITS.burstSeconds * 1000) } })]);
  if (mine >= NB_LIMITS.postsPerArea) throw new Error(`You have reached the limit of ${NB_LIMITS.postsPerArea} messages in this neighbourhood`);
  if (recent >= NB_LIMITS.burst) throw new Error("You are posting very quickly. Please wait a minute and try again");
  if (parentId) {
    let depth = 1, cur = await posts(db).findOne({ _id: parentId as never });
    if (!cur || cur["areaKey"] !== key || cur["deletedAt"]) throw new Error("The message you are replying to is no longer available");
    while (cur?.["parentId"] && depth < 10) { depth++; cur = await posts(db).findOne({ _id: cur["parentId"] as never }); }
    if (depth >= NB_LIMITS.replyDepth) throw new Error("This thread is too deep to reply further");
  }
  const _id = crypto.randomUUID();
  await posts(db).insertOne({ _id, schemaVersion: 1, areaKey: key, userId, parentId, textEnc: await encrypt(text), createdAt: new Date(), deletedAt: null } as never);
  return { id: _id };
}

/** The author blanks their own message; the thread keeps its shape. An admin can remove any message. */
export async function removePost(db: Db, userId: string, id: string, asAdmin = false) {
  const r = await posts(db).updateOne({ _id: id as never, ...(asAdmin ? {} : { userId }), deletedAt: null } as never, { $set: { deletedAt: new Date(), textEnc: null } });
  if (!r.matchedCount) throw new Error("Message not found");
  return { ok: true as const };
}
export async function myPostIds(db: Db, userId: string, key: string) { return (await posts(db).find({ areaKey: key, userId, deletedAt: null }, { projection: { _id: 1 } }).toArray()).map((p) => String(p["_id"])); }
export type { AspectKey };

/* ───────────────────────────── Reports and staff ───────────────────────────── */

const target = (db: Db, kind: "review" | "post") => (kind === "review" ? reviews(db) : posts(db));

/** A signed-in person reports a review or message. The same person reporting twice counts once; three different people hide it for staff to decide. */
export async function reportItem(db: Db, userId: string, kind: "review" | "post", id: string) {
  const col = target(db, kind);
  const doc = await col.findOne({ _id: id as never });
  if (!doc || doc["deletedAt"]) throw new Error("That is no longer available");
  if (doc["userId"] === userId) throw new Error("You cannot report your own message");
  const reporters = [...new Set([...((doc["reportedBy"] as string[] | undefined) ?? []), userId])].slice(0, 50);
  await col.updateOne({ _id: id as never }, { $set: { reportedBy: reporters, hidden: shouldHide(reporters) } });
  return { ok: true as const };
}

export async function listFlagged(db: Db) {
  const q = { $or: [{ hidden: true }, { "reportedBy.0": { $exists: true } }] };
  const [rv, ps] = await Promise.all([reviews(db).find(q).limit(100).toArray(), posts(db).find({ ...q, deletedAt: null }).limit(100).toArray()]);
  const ids = [...new Set([...rv, ...ps].map((r) => str(r["userId"])))];
  const names = new Map((await db.collection("users").find({ _id: { $in: ids as never } }, { projection: { username: 1 } }).toArray()).map((u) => [String(u["_id"]), str(u["username"])]));
  const row = async (kind: "review" | "post", r: Document) => ({ id: str(r["_id"]), kind, area: str(r["areaKey"]), username: names.get(str(r["userId"])) ?? "former_member", text: await decrypt(r["textEnc"] as string | null), reports: ((r["reportedBy"] as string[] | undefined) ?? []).length, hidden: r["hidden"] === true, at: ((r["updatedAt"] ?? r["createdAt"]) as Date).toISOString() });
  return (await Promise.all([...rv.map((r) => row("review", r)), ...ps.map((r) => row("post", r))])).sort((a, b) => b.reports - a.reports || b.at.localeCompare(a.at));
}

export async function moderateItem(db: Db, kind: "review" | "post", id: string, action: "restore" | "remove") {
  if (action === "restore") { await target(db, kind).updateOne({ _id: id as never }, { $set: { reportedBy: [], hidden: false } }); return { ok: true as const }; }
  if (kind === "review") await reviews(db).deleteOne({ _id: id as never }); else await posts(db).updateOne({ _id: id as never }, { $set: { deletedAt: new Date(), textEnc: null, hidden: false } });
  return { ok: true as const };
}
