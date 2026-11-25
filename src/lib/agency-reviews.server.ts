import type { Db, Document } from "mongodb";
import { fail } from "./dashboard.server";
import { agencyPeople, notify } from "./notifications.server";
import { ensureCollectionIndexes } from "./mongodb/ensure";
import { REVIEWS_PER_DAY, shouldHide, summarise } from "./review-rules";

// Server-only: reviews of agencies. One per person per agency, editable, reportable, and answerable once by the agency.
const col = (db: Db) => db.collection("agencyReviews");
const ensure = (db: Db) => ensureCollectionIndexes(db, ["agencyReviews"]);

export type ReviewDTO = { id: string; username: string; rating: number; body: string; verifiedEnquirer: boolean; reply: { body: string; at: string } | null; createdAt: string; edited: boolean; mine: boolean; reported: boolean };

/** Recomputes the numbers stored on the agency, so cards and the directory need no extra query. */
export async function refreshRating(db: Db, agencyId: string) {
  const rows = await col(db).find({ agencyId, status: "visible" }, { projection: { rating: 1 } }).limit(5000).toArray();
  const s = summarise(rows.map((r) => Number(r["rating"])));
  await db.collection("agencies").updateOne({ _id: agencyId as never }, { $set: { rating: { count: s.count, avg: s.avg } } });
  return s;
}

export async function loadReviews(db: Db, agencyId: string, viewerId: string | null) {
  await ensure(db);
  const visible = { agencyId, status: "visible" };
  const [rows, all, mine] = await Promise.all([
    col(db).find(visible).sort({ createdAt: -1 }).limit(40).toArray(),
    col(db).find(visible, { projection: { rating: 1 } }).limit(5000).toArray(),
    viewerId ? col(db).findOne({ agencyId, userId: viewerId }) : null,
  ]);
  const dto = (r: Document): ReviewDTO => ({
    id: String(r["_id"]), username: String(r["username"]), rating: Number(r["rating"]), body: String(r["body"]), verifiedEnquirer: r["verifiedEnquirer"] === true,
    reply: r["reply"] ? { body: String((r["reply"] as Document)["body"]), at: ((r["reply"] as Document)["at"] as Date).toISOString() } : null,
    createdAt: (r["createdAt"] as Date).toISOString(), edited: (r["updatedAt"] as Date).getTime() - (r["createdAt"] as Date).getTime() > 60_000,
    mine: !!viewerId && r["userId"] === viewerId, reported: !!viewerId && ((r["reportedBy"] as string[]) ?? []).includes(viewerId),
  });
  const summary = summarise(all.map((r) => Number(r["rating"])));
  return { summary, items: rows.map(dto), mine: mine ? { ...dto(mine), status: String(mine["status"]) } : null, hasMore: summary.count > rows.length };
}

export async function saveReview(db: Db, user: { id: string; username: string }, agencyId: string, input: { rating: number; body: string }) {
  await ensure(db);
  const agency = await db.collection("agencies").findOne({ _id: agencyId as never, status: "active" });
  if (!agency) return fail("This agency is no longer available");
  if (await db.collection("agencyMembers").findOne({ agencyId, userId: user.id, status: "active" })) return fail("You cannot review an agency you work for");
  const existing = await col(db).findOne({ agencyId, userId: user.id });
  const now = new Date();
  if (!existing) {
    const today = await col(db).countDocuments({ userId: user.id, createdAt: { $gte: new Date(now.getTime() - 86_400_000) } });
    if (today >= REVIEWS_PER_DAY) return fail("You have written several reviews today. Please try again tomorrow.");
  }
  const verifiedEnquirer = !!(await db.collection("enquiries").findOne({ agencyId, userId: user.id }, { projection: { _id: 1 } }));
  if (existing) {
    await col(db).updateOne({ _id: existing["_id"] }, { $set: { rating: input.rating, body: input.body, verifiedEnquirer, updatedAt: now } });
  } else {
    await col(db).insertOne({ _id: crypto.randomUUID() as never, schemaVersion: 1, agencyId, userId: user.id, username: user.username, rating: input.rating, body: input.body, verifiedEnquirer, reply: null, reportedBy: [], status: "visible", createdAt: now, updatedAt: now });
    await notify(db, await agencyPeople(db, agencyId), { kind: "agency_review", title: `New ${input.rating}-star review`, body: input.body.slice(0, 200), link: `/agency/${agency["slug"]}#reviews` });
  }
  await refreshRating(db, agencyId);
  return { ok: true as const };
}

export async function deleteReview(db: Db, userId: string, reviewId: string) {
  const r = await col(db).findOne({ _id: reviewId as never, userId });
  if (!r) return fail("Review not found");
  await col(db).deleteOne({ _id: r["_id"] });
  await refreshRating(db, String(r["agencyId"]));
  return { ok: true as const };
}

/** Only people who run the agency can answer, and only once; the answer can be changed. */
export async function replyToReview(db: Db, agencyId: string, memberUserId: string, reviewId: string, body: string) {
  const r = await col(db).findOne({ _id: reviewId as never, agencyId });
  if (!r) return fail("Review not found");
  await col(db).updateOne({ _id: r["_id"] }, { $set: { reply: { body, by: memberUserId, at: new Date() } } });
  await notify(db, [String(r["userId"])], { kind: "agency_review", title: "The agency replied to your review", body: body.slice(0, 200), link: `/agency/${(await db.collection("agencies").findOne({ _id: agencyId as never }, { projection: { slug: 1 } }))?.["slug"]}#reviews`, dedupeKey: `review-reply:${reviewId}` });
  return { ok: true as const };
}

export async function reportReview(db: Db, userId: string, reviewId: string) {
  const r = await col(db).findOne({ _id: reviewId as never });
  if (!r || r["userId"] === userId) return fail("Review not found");
  await col(db).updateOne({ _id: r["_id"] }, { $addToSet: { reportedBy: userId } });
  const now = await col(db).findOne({ _id: r["_id"] });
  if (now && now["status"] === "visible" && shouldHide(((now["reportedBy"] as string[]) ?? []).length)) {
    await col(db).updateOne({ _id: r["_id"] }, { $set: { status: "hidden", updatedAt: new Date() } });
    await refreshRating(db, String(r["agencyId"]));
  }
  return { ok: true as const };
}

/** Admin: reviews that were reported or hidden, newest first. */
export async function listFlagged(db: Db) {
  const rows = await col(db).find({ "reportedBy.0": { $exists: true } }).sort({ updatedAt: -1 }).limit(100).toArray();
  const names = new Map((await db.collection("agencies").find({ _id: { $in: rows.map((r) => r["agencyId"]) as never[] } }, { projection: { name: 1 } }).toArray()).map((a) => [String(a["_id"]), String(a["name"])]));
  return rows.map((r) => ({ id: String(r["_id"]), agency: names.get(String(r["agencyId"])) ?? "Unknown", username: String(r["username"]), rating: Number(r["rating"]), body: String(r["body"]), reports: ((r["reportedBy"] as string[]) ?? []).length, status: String(r["status"]), createdAt: (r["createdAt"] as Date).toISOString() }));
}

/** Admin: put a hidden review back, or remove it for good. */
export async function moderateReview(db: Db, reviewId: string, action: "restore" | "remove") {
  const r = await col(db).findOne({ _id: reviewId as never });
  if (!r) return fail("Review not found");
  if (action === "remove") await col(db).deleteOne({ _id: r["_id"] });
  else await col(db).updateOne({ _id: r["_id"] }, { $set: { status: "visible", reportedBy: [], updatedAt: new Date() } });
  await refreshRating(db, String(r["agencyId"]));
  return { ok: true as const };
}
