import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchCriteriaSchema } from "./mongodb/property-schemas";
import { ALERT_FREQUENCIES } from "./mongodb/taxonomy";
import { SAVED_LIMITS } from "./mongodb/limits";

const auth = () => import("./auth.server");
const notes = () => import("./notifications.server");
const id = z.string().min(1).max(64);

/** Just the unread number, cheap enough to ask every half minute. Also checks for new matches for the person's saved searches. */
export const getUnreadCount = createServerFn({ method: "GET" }).handler(async () => {
  const { authDb, requireUser } = await auth();
  const me = await requireUser();
  const n = await notes();
  return authDb(async (db) => { await n.sweepFor(db, me.id); return { unread: await n.unreadCount(db, me.id) }; });
});

/** Numbers for the bottom tab bar: unread enquiry notifications (the Inquiries dot) and how many properties the person saved (the Saved badge). */
export const getTabBadges = createServerFn({ method: "GET" }).handler(async () => {
  const { authDb, requireUser } = await auth();
  const me = await requireUser();
  const n = await notes();
  return authDb(async (db) => ({
    enquiries: await n.unreadEnquiryCount(db, me.id),
    saved: await db.collection("savedProperties").countDocuments({ userId: me.id }),
  }));
});

export const getMyNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const { authDb, requireUser } = await auth();
  const me = await requireUser();
  const n = await notes();
  return authDb(async (db) => { await n.sweepFor(db, me.id); return n.listFor(db, me.id); });
});

export const markNotificationsRead = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ids: z.union([z.literal("all"), z.array(id).max(50)]) }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, requireUser } = await auth();
    const me = await requireUser();
    await authDb(async (db) => (await notes()).markRead(db, me.id, data.ids));
    return { ok: true };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, requireUser } = await auth();
    const me = await requireUser();
    await authDb(async (db) => (await notes()).removeOne(db, me.id, data.id));
    return { ok: true };
  });

export const respondToInvite = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ inviteId: id, accept: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, requireUser } = await auth();
    const me = await requireUser();
    const { respondToInvitation } = await import("./dashboard.server");
    try {
      return await authDb((db) => respondToInvitation(db, me.id, data.inviteId, data.accept));
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Could not answer the invitation");
    }
  });

/* ───────────── Saved searches ───────────── */

export const getSavedSearches = createServerFn({ method: "GET" }).handler(async () => {
  const { authDb, requireUser } = await auth();
  const me = await requireUser();
  return authDb(async (db) => (await db.collection("savedSearches").find({ userId: me.id }).sort({ createdAt: -1 }).limit(SAVED_LIMITS.searchesPerUser).toArray()).map((s) => ({
    id: String(s["_id"]), name: String(s["name"]), criteria: s["criteria"] as z.infer<typeof searchCriteriaSchema>, frequency: String(s["frequency"]) as (typeof ALERT_FREQUENCIES)[number],
  })));
});

export const createSavedSearch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ name: z.string().trim().min(1).max(SAVED_LIMITS.searchNameMax), criteria: searchCriteriaSchema, frequency: z.enum(ALERT_FREQUENCIES) }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, requireUser } = await auth();
    const me = await requireUser();
    return authDb(async (db) => {
      const col = db.collection("savedSearches");
      if ((await col.countDocuments({ userId: me.id })) >= SAVED_LIMITS.searchesPerUser) return { ok: false as const, error: `You can keep up to ${SAVED_LIMITS.searchesPerUser} saved searches. Delete one first.` };
      const now = new Date();
      await col.insertOne({ _id: crypto.randomUUID() as never, schemaVersion: 1, userId: me.id, name: data.name, criteria: data.criteria, frequency: data.frequency, lastNotifiedAt: null, createdAt: now, updatedAt: now });
      return { ok: true as const };
    });
  });

export const updateSavedSearch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id, frequency: z.enum(ALERT_FREQUENCIES) }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, requireUser } = await auth();
    const me = await requireUser();
    await authDb((db) => db.collection("savedSearches").updateOne({ _id: data.id as never, userId: me.id }, { $set: { frequency: data.frequency, updatedAt: new Date() } }));
    return { ok: true };
  });

export const deleteSavedSearch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, requireUser } = await auth();
    const me = await requireUser();
    await authDb((db) => db.collection("savedSearches").deleteOne({ _id: data.id as never, userId: me.id }));
    return { ok: true };
  });

/* ───────────── Live updates ───────────── */

/**
 * A tiny public answer that changes whenever any live listing changes. Pages ask for it every few seconds and reload their lists when it
 * moves, so new listings, price changes and takedowns show up without a refresh. The edge keeps it for a few seconds, so
 * the database sees one question per interval however many people are online.
 */
export const getLiveStamp = createServerFn({ method: "GET" }).handler(async () => {
  (await import("./cdn-cache.server")).cachePublic(5, 15);
  try {
    const { withDb } = await import("./community.server");
    return await withDb(async (db) => {
      const [last] = await db.collection("properties").find({ status: { $in: ["published", "paused", "closed", "expired", "rejected"] } }, { projection: { updatedAt: 1 } }).sort({ updatedAt: -1 }).limit(1).toArray();
      const live = await db.collection("properties").countDocuments({ status: "published" }, { limit: 100_000 });
      return { stamp: `${last?.["updatedAt"] instanceof Date ? last["updatedAt"].getTime() : 0}-${live}` };
    });
  } catch {
    return { stamp: "unavailable" };
  }
});
