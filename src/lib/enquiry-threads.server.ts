import type { Db, Document } from "mongodb";
import { z } from "zod";
import { canManageLead, canViewLead } from "./access";
import { ensureCollectionIndexes } from "./mongodb/ensure";
import { ENQUIRY_LIMITS } from "./mongodb/limits";
import { agencyPeople, notify } from "./notifications.server";
import type { Member } from "./dashboard.server";

// Server-only: in-site conversations on enquiries. Nothing is emailed. Only enquiries sent while signed in have a thread,
// because a guest has no account to receive the reply.

const messages = (db: Db) => db.collection("enquiryMessages");
const ensure = (db: Db) => ensureCollectionIndexes(db, ["enquiryMessages"]);

export class ThreadError extends Error {}
const fail = (m: string): never => { throw new ThreadError(m); };

export const threadInput = z.object({ enquiryId: z.string().min(1).max(64) });
export const replyInput = threadInput.extend({ body: z.string().trim().min(1).max(ENQUIRY_LIMITS.replyMax) });

export type ThreadMessage = { id: string; role: "agent" | "enquirer"; body: string; at: string; mine: boolean };

async function rows(db: Db, enquiryId: string, viewerId: string): Promise<ThreadMessage[]> {
  const docs = await messages(db).find({ enquiryId }).sort({ createdAt: 1 }).limit(200).toArray();
  return docs.map((d) => ({ id: String(d["_id"]), role: d["senderRole"] === "agent" ? "agent" : "enquirer", body: String(d["body"]), at: (d["createdAt"] as Date).toISOString(), mine: d["senderUserId"] === viewerId }));
}

async function tooMany(db: Db, userId: string) {
  const since = new Date(Date.now() - 3_600_000);
  return (await messages(db).countDocuments({ senderUserId: userId, createdAt: { $gte: since } })) >= ENQUIRY_LIMITS.repliesPerHour;
}

/* ───────── Agency side ───────── */

async function agencyEnquiry(db: Db, m: Member, enquiryId: string) {
  const e = await db.collection("enquiries").findOne({ _id: enquiryId as never, agencyId: m.agencyId });
  if (!e) return fail("Enquiry not found");
  const lead = { agencyId: m.agencyId, agentId: typeof e["agentId"] === "string" ? e["agentId"] : null, assignedTo: typeof e["assignedTo"] === "string" ? e["assignedTo"] : null };
  if (!canViewLead(m, lead)) return fail("You do not have permission to see this enquiry");
  return { e, canReply: canManageLead(m, lead) };
}

export async function agencyThread(db: Db, m: Member, enquiryId: string) {
  await ensure(db);
  const { e, canReply } = await agencyEnquiry(db, m, enquiryId);
  return { messages: await rows(db, enquiryId, m.userId), canReply: canReply && !!e["userId"], guest: !e["userId"] };
}

export async function agencyReply(db: Db, m: Member, input: z.infer<typeof replyInput>) {
  await ensure(db);
  const { e, canReply } = await agencyEnquiry(db, m, input.enquiryId);
  if (!canReply) return fail("You do not have permission to reply to this enquiry");
  const to = typeof e["userId"] === "string" ? e["userId"] : null;
  if (!to) return fail("This person sent the enquiry without signing in, so there is no account to reply to. Use their email or phone.");
  if (await tooMany(db, m.userId)) return fail("You have sent a lot of messages this hour. Please try again later.");
  const now = new Date();
  await messages(db).insertOne({ _id: crypto.randomUUID() as never, schemaVersion: 1, enquiryId: input.enquiryId, agencyId: m.agencyId, senderRole: "agent", senderUserId: m.userId, body: input.body, createdAt: now, readAt: null });
  const set: Document = { updatedAt: now };
  if (!e["firstResponseAt"]) set["firstResponseAt"] = now;
  if (e["status"] === "new") set["status"] = "contacted";
  await db.collection("enquiries").updateOne({ _id: input.enquiryId as never }, { $set: set });
  await notify(db, [to], { kind: "enquiry", title: `${m.agency.name} replied about ${String(e["propertyTitle"])}`.slice(0, 120), body: input.body.slice(0, 200), link: "/dashboard#enq", dedupeKey: null });
  return { ok: true as const };
}

/* ───────── Enquirer side ───────── */

async function ownEnquiry(db: Db, userId: string, enquiryId: string) {
  const e = await db.collection("enquiries").findOne({ _id: enquiryId as never, userId });
  return e ?? fail("Enquiry not found");
}

export async function myThread(db: Db, userId: string, enquiryId: string) {
  await ensure(db);
  await ownEnquiry(db, userId, enquiryId);
  const list = await rows(db, enquiryId, userId);
  await messages(db).updateMany({ enquiryId, senderRole: "agent", readAt: null }, { $set: { readAt: new Date() } });
  return { messages: list };
}

export async function myReply(db: Db, userId: string, input: z.infer<typeof replyInput>) {
  await ensure(db);
  const e = await ownEnquiry(db, userId, input.enquiryId);
  // The enquirer can answer only once the agency has written, so the thread is a reply and never a second inbox for strangers.
  if (!(await messages(db).countDocuments({ enquiryId: input.enquiryId, senderRole: "agent" }, { limit: 1 }))) return fail("You can reply once the agency has written to you");
  if (await tooMany(db, userId)) return fail("You have sent a lot of messages this hour. Please try again later.");
  const agencyId = String(e["agencyId"]);
  await messages(db).insertOne({ _id: crypto.randomUUID() as never, schemaVersion: 1, enquiryId: input.enquiryId, agencyId, senderRole: "enquirer", senderUserId: userId, body: input.body, createdAt: new Date(), readAt: null });
  const people = await agencyPeople(db, agencyId, ["owner", "admin"], [typeof e["agentId"] === "string" ? e["agentId"] : null, typeof e["assignedTo"] === "string" ? e["assignedTo"] : null]);
  const agency = await db.collection("agencies").findOne({ _id: agencyId as never }, { projection: { slug: 1 } });
  await notify(db, people, { kind: "enquiry", title: `${String(e["name"])} replied about ${String(e["propertyTitle"])}`.slice(0, 120), body: input.body.slice(0, 200), link: agency ? `/dashboard/agency/${String(agency["slug"])}/enquiries` : null });
  return { ok: true as const };
}

/** How many agency messages each of the person's enquiries has not been read yet. */
export async function unreadByEnquiry(db: Db, userId: string, enquiryIds: string[]) {
  if (!enquiryIds.length) return new Map<string, number>();
  const agg = await messages(db).aggregate([{ $match: { enquiryId: { $in: enquiryIds }, senderRole: "agent", readAt: null } }, { $group: { _id: "$enquiryId", n: { $sum: 1 } } }]).toArray();
  void userId;
  return new Map(agg.map((a) => [String(a["_id"]), Number(a["n"])]));
}
