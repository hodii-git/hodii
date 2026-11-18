import type { Db } from "mongodb";
import { decrypt, encrypt, withDb } from "./community.server";
import { LIMITS, canEditComment } from "./community-rules";
import type { CommentDTO, MyCommentDTO, CommentStats } from "./comments.functions";

// Server-only: comments on listings. Text is encrypted at rest; deleted comments keep their place in a thread.
type CommentDoc = { _id: string; schemaVersion: 1; propertyId: string; userId: string; parentId: string | null; textEnc: string | null; createdAt: Date; editedAt: Date | null; deletedAt: Date | null };
type LikeDoc = { _id: string; schemaVersion: 1; commentId: string; userId: string; authorId: string; createdAt: Date };

const comments = (db: Db) => db.collection<CommentDoc>("propertyComments");
const likesOf = (db: Db) => db.collection<LikeDoc>("propertyCommentLikes");
const hueFor = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const COMMENT_ERRORS = { gone: "That comment is no longer available" };

type Discussion = { comments: CommentDTO[]; count: number };
// Short per-isolate cache so repeat views skip a database round-trip; any write clears it.
const cache = new Map<string, { at: number; value: Promise<Discussion> }>();
export const clearDiscussionCache = () => cache.clear();
export function cachedDiscussion(propertyId: string) {
  const hit = cache.get(propertyId);
  if (hit && Date.now() - hit.at < 10_000) return hit.value;
  const value = loadDiscussion(propertyId);
  cache.set(propertyId, { at: Date.now(), value });
  value.catch(() => cache.delete(propertyId));
  return value;
}

async function loadDiscussion(propertyId: string): Promise<Discussion> {
  return withDb(async (db) => {
    const raw = await comments(db).find({ propertyId }).sort({ createdAt: 1 }).limit(2000).toArray();
    const [likeAgg, people] = await Promise.all([
      likesOf(db).aggregate<{ _id: string; n: number }>([{ $match: { commentId: { $in: raw.map((c) => c._id) } } }, { $group: { _id: "$commentId", n: { $sum: 1 } } }]).toArray(),
      db.collection("users").find({ _id: { $in: [...new Set(raw.map((c) => c.userId))] as never } }, { projection: { username: 1 } }).toArray(),
    ]);
    const likeMap = new Map(likeAgg.map((l) => [l._id, l.n]));
    const names = new Map(people.map((p) => [String(p._id), String(p["username"])]));
    const out: CommentDTO[] = await Promise.all(raw.map(async (c) => ({
      id: c._id, parentId: c.parentId, createdAt: c.createdAt.toISOString(), editedAt: c.editedAt ? c.editedAt.toISOString() : null,
      deleted: !!c.deletedAt, text: c.deletedAt ? "" : await decrypt(c.textEnc), likes: likeMap.get(c._id) ?? 0,
      author: c.deletedAt ? { username: "deleted", hue: 0 } : { username: names.get(c.userId) ?? "former_member", hue: hueFor(c.userId) },
    })));
    return { comments: out, count: raw.filter((c) => !c.deletedAt).length };
  });
}

export async function myState(userId: string, propertyId: string) {
  return withDb(async (db) => {
    const all = await comments(db).find({ propertyId }, { projection: { _id: 1, userId: 1, deletedAt: 1 } }).toArray();
    const liked = await likesOf(db).find({ userId, commentId: { $in: all.map((c) => c._id) } }).toArray();
    return { myCommentIds: all.filter((c) => c.userId === userId && !c.deletedAt).map((c) => c._id), likedCommentIds: liked.map((l) => l.commentId) };
  });
}

export async function post(userId: string, propertyId: string, text: string, parentId: string | null) {
  return withDb(async (db) => {
    const live = await db.collection("properties").findOne({ _id: propertyId as never, status: "published" }, { projection: { _id: 1 } });
    if (!live) throw new Error("This listing is no longer available");
    const since = new Date(Date.now() - LIMITS.commentBurstWindowSeconds * 1000);
    const [onListing, recent] = await Promise.all([
      comments(db).countDocuments({ userId, propertyId, deletedAt: null }),
      comments(db).countDocuments({ userId, createdAt: { $gte: since } }),
    ]);
    if (onListing >= LIMITS.commentsPerListing) throw new Error(`You've reached the limit of ${LIMITS.commentsPerListing} comments on this listing`);
    if (recent >= LIMITS.commentBurst) throw new Error("You're commenting very quickly. Please wait a minute and try again");
    if (parentId) {
      let depth = 1;
      let cursor = await comments(db).findOne({ _id: parentId });
      if (!cursor || cursor.propertyId !== propertyId || cursor.deletedAt) throw new Error("The comment you're replying to is no longer available");
      while (cursor?.parentId && depth < 10) { depth++; cursor = await comments(db).findOne({ _id: cursor.parentId }); }
      if (depth >= LIMITS.replyDepthMax) throw new Error("This thread is too deep to reply further");
    }
    const _id = crypto.randomUUID();
    await comments(db).insertOne({ _id, schemaVersion: 1, propertyId, userId, parentId, textEnc: await encrypt(text), createdAt: new Date(), editedAt: null, deletedAt: null });
    try {
      const { notify, agencyPeople } = await import("./notifications.server");
      const prop = await db.collection("properties").findOne({ _id: propertyId as never }, { projection: { title: 1, slug: 1, agencyId: 1, agentId: 1 } });
      const link = prop ? `/property/${String(prop["slug"])}#comments` : null;
      const who = (await db.collection("users").findOne({ _id: userId as never }, { projection: { username: 1 } }))?.["username"] ?? "Someone";
      if (parentId) {
        const parent = await comments(db).findOne({ _id: parentId });
        if (parent && parent.userId !== userId) await notify(db, [parent.userId], { kind: "comment_reply", title: `${who} replied to your comment`, body: text.slice(0, 120), link, dedupeKey: `reply:${_id}` });
      } else if (prop) {
        await notify(db, (await agencyPeople(db, String(prop["agencyId"]), ["owner", "admin"], [prop["agentId"] as string | null])).filter((u) => u !== userId), { kind: "comment_on_listing", title: `New comment on ${String(prop["title"]).slice(0, 70)}`, body: `${who}: ${text.slice(0, 100)}`, link, dedupeKey: `comment:${_id}` });
      }
    } catch (e) { console.error("comment notification", e); }
    return { id: _id };
  });
}

export async function edit(userId: string, commentId: string, text: string) {
  return withDb(async (db) => {
    const c = await comments(db).findOne({ _id: commentId, userId, deletedAt: null });
    if (!c) throw new Error("You can only edit your own comments");
    if (!canEditComment(c.createdAt)) throw new Error(`Comments can only be edited within ${LIMITS.commentEditWindowMinutes} minutes of posting`);
    await comments(db).updateOne({ _id: c._id }, { $set: { textEnc: await encrypt(text), editedAt: new Date() } });
    return { ok: true as const };
  });
}

/** Blanks a comment and drops its likes. Used by the author, the admin and account deletion. */
export async function blank(db: Db, filter: Partial<Pick<CommentDoc, "_id" | "userId">>) {
  const ids = (await comments(db).find({ ...filter, deletedAt: null }, { projection: { _id: 1 } }).toArray()).map((c) => c._id);
  if (!ids.length) return 0;
  await comments(db).updateMany({ _id: { $in: ids } }, { $set: { deletedAt: new Date(), textEnc: null } });
  await likesOf(db).deleteMany({ commentId: { $in: ids } });
  return ids.length;
}

export async function remove(userId: string, commentId: string) {
  return withDb(async (db) => {
    if ((await blank(db, { _id: commentId, userId })) === 0) throw new Error("You can only delete your own comments");
    return { ok: true as const };
  });
}

export async function toggleLike(userId: string, commentId: string) {
  return withDb(async (db) => {
    const c = await comments(db).findOne({ _id: commentId });
    if (!c || c.deletedAt) throw new Error(COMMENT_ERRORS.gone);
    const removed = await likesOf(db).deleteOne({ userId, commentId });
    if (removed.deletedCount === 0) {
      try { await likesOf(db).insertOne({ _id: crypto.randomUUID(), schemaVersion: 1, commentId, userId, authorId: c.userId, createdAt: new Date() }); } catch (e) { if ((e as { code?: number }).code !== 11000) throw e; }
    }
    if (removed.deletedCount === 0 && c.userId !== userId) {
      try {
        const { notify } = await import("./notifications.server");
        const [who, prop] = await Promise.all([db.collection("users").findOne({ _id: userId as never }, { projection: { username: 1 } }), db.collection("properties").findOne({ _id: c.propertyId as never }, { projection: { slug: 1 } })]);
        await notify(db, [c.userId], { kind: "comment_like", title: `${who?.["username"] ?? "Someone"} liked your comment`, link: prop ? `/property/${String(prop["slug"])}#comments` : null, dedupeKey: `like:${commentId}:${userId}` });
      } catch (e) { console.error("like notification", e); }
    }
    return { active: removed.deletedCount === 0 };
  });
}

export async function commentStats(db: Db, userId: string): Promise<CommentStats> {
  const mine = (await comments(db).find({ userId, deletedAt: null }, { projection: { _id: 1 } }).toArray()).map((c) => c._id);
  const [replies, likesReceived] = await Promise.all([
    comments(db).countDocuments({ parentId: { $in: mine }, userId: { $ne: userId }, deletedAt: null }),
    likesOf(db).countDocuments({ authorId: userId, userId: { $ne: userId } }),
  ]);
  return { comments: mine.length, replies, likesReceived };
}

export async function myComments(userId: string): Promise<MyCommentDTO[]> {
  return withDb(async (db) => {
    const rows = await comments(db).find({ userId, deletedAt: null }).sort({ createdAt: -1 }).limit(200).toArray();
    const props = await db.collection("properties").find({ _id: { $in: [...new Set(rows.map((r) => r.propertyId))] as never } }, { projection: { slug: 1, title: 1 } }).toArray();
    const byId = new Map(props.map((p) => [String(p._id), { slug: String(p["slug"]), title: String(p["title"]) }]));
    return Promise.all(rows.map(async (c) => ({ id: c._id, text: await decrypt(c.textEnc), at: c.createdAt.toISOString(), isReply: !!c.parentId, property: byId.get(c.propertyId) ?? null })));
  });
}
