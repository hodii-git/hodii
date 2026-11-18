import type { Db, Document } from "mongodb";
import { z } from "zod";
import { FEEDBACK_KINDS, FEEDBACK_STATUSES } from "./mongodb/property-schemas";
import { ensureCollectionIndexes } from "./mongodb/ensure";

// Server-only: feedback from the floating button. Anyone can send it, signed in or not.

const col = (db: Db) => db.collection("feedback");
export class FeedbackError extends Error {}

export const feedbackInput = z.object({
  kind: z.enum(FEEDBACK_KINDS), rating: z.number().int().min(1).max(5).nullable().default(null),
  message: z.string().trim().min(3, "Please write a few words").max(2000),
  page: z.string().trim().max(300).default("/"), viewport: z.string().max(20).nullable().default(null),
  email: z.string().trim().max(200).email("That email does not look right").or(z.literal("")).default(""), name: z.string().trim().max(80).default(""),
  contactOk: z.boolean().default(false),
  /** A hidden field real people never fill in. */
  website: z.string().max(200).default(""),
});

/** At most this many messages per person (by network) per hour, so the form cannot be used to flood the inbox. */
const PER_HOUR = 8;

export async function submitFeedback(db: Db, input: z.infer<typeof feedbackInput>, who: { userId: string | null; ipHash: string; userAgent: string | null; email: string | null }) {
  if (input.website) return { ok: true as const }; // a bot: pretend it worked
  await ensureCollectionIndexes(db, ["feedback"]);
  const recent = await col(db).countDocuments({ ipHash: who.ipHash, createdAt: { $gt: new Date(Date.now() - 3_600_000) } });
  if (recent >= PER_HOUR) throw new FeedbackError("You have sent a lot of feedback in the last hour. Thank you, please try again later.");
  const now = new Date();
  const email = input.email || (input.contactOk ? who.email : null) || null;
  await col(db).insertOne({
    _id: crypto.randomUUID() as never, schemaVersion: 1, kind: input.kind, rating: input.rating, message: input.message, page: input.page.replace(/[?#].*$/, "").slice(0, 300) || "/",
    device: who.userAgent ? who.userAgent.slice(0, 200) : null, viewport: input.viewport, userId: who.userId, name: input.name || null, email: input.contactOk ? email : null,
    contactOk: input.contactOk, ipHash: who.ipHash, status: "new", adminNote: null, createdAt: now, updatedAt: now,
  });
  return { ok: true as const };
}

export const feedbackFilter = z.object({ status: z.enum(["all", ...FEEDBACK_STATUSES]).default("new"), kind: z.enum(["all", ...FEEDBACK_KINDS]).default("all"), page: z.number().int().min(1).max(200).default(1) });

export async function listFeedback(db: Db, f: z.infer<typeof feedbackFilter>) {
  const filter: Document = {};
  if (f.status !== "all") filter["status"] = f.status;
  if (f.kind !== "all") filter["kind"] = f.kind;
  const size = 25;
  const [rows, total, counts, rating] = await Promise.all([
    col(db).find(filter).sort({ createdAt: -1 }).skip((f.page - 1) * size).limit(size).toArray(),
    col(db).countDocuments(filter),
    col(db).aggregate([{ $group: { _id: { status: "$status", kind: "$kind" }, n: { $sum: 1 } } }]).toArray(),
    col(db).aggregate([{ $match: { rating: { $ne: null } } }, { $group: { _id: null, avg: { $avg: "$rating" }, n: { $sum: 1 } } }]).toArray(),
  ]);
  const byStatus: Record<string, number> = {}, byKind: Record<string, number> = {};
  for (const c of counts) { const s = String(c["_id"].status), k = String(c["_id"].kind), n = Number(c["n"]); byStatus[s] = (byStatus[s] ?? 0) + n; if (c["_id"].status !== "resolved") byKind[k] = (byKind[k] ?? 0) + n; }
  return {
    items: rows.map((r) => ({
      id: String(r["_id"]), kind: String(r["kind"]), rating: typeof r["rating"] === "number" ? r["rating"] : null, message: String(r["message"]), page: String(r["page"]), device: typeof r["device"] === "string" ? r["device"] : null,
      viewport: typeof r["viewport"] === "string" ? r["viewport"] : null, signedIn: !!r["userId"], name: typeof r["name"] === "string" ? r["name"] : null, email: typeof r["email"] === "string" ? r["email"] : null,
      status: String(r["status"]), adminNote: typeof r["adminNote"] === "string" ? r["adminNote"] : null, createdAt: (r["createdAt"] as Date).toISOString(),
    })),
    total, page: f.page, pageSize: size, byStatus, byKind, averageRating: rating[0] ? Math.round(Number(rating[0]["avg"]) * 10) / 10 : null, ratingCount: rating[0] ? Number(rating[0]["n"]) : 0,
  };
}

export const feedbackUpdate = z.object({ id: z.string().min(1).max(64), status: z.enum(FEEDBACK_STATUSES).optional(), adminNote: z.string().trim().max(1000).optional() });
export async function updateFeedback(db: Db, input: z.infer<typeof feedbackUpdate>) {
  const set: Document = { updatedAt: new Date() };
  if (input.status) set["status"] = input.status;
  if (input.adminNote !== undefined) set["adminNote"] = input.adminNote || null;
  const r = await col(db).updateOne({ _id: input.id as never }, { $set: set });
  if (!r.matchedCount) throw new FeedbackError("That message no longer exists");
  return { ok: true as const };
}

export const newFeedbackCount = (db: Db) => col(db).countDocuments({ status: "new" });
