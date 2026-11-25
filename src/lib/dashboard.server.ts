import type { Db, Document, Filter } from "mongodb";
import { z } from "zod";
import { liveBlock, storedBlock, type LimitInfo } from "./basic-space.server";
import { can, canShapeMember, grantable, canChangeRole, canEditListing, canInviteRole, canManageLead, canRemoveMember, canViewLead, statusOnPublish, type Action, type Membership } from "./access";
import { agenciesCol, membersCol, ensureAgencyIndexes } from "./agency.server";
import { composeListing, type ListingForm } from "./listing-compose";
import { agenciesById, cardOf, ensurePropertyIndexes, propertiesCol, readEnquiry } from "./properties.server";
import { AGENCY_LIMITS, ENQUIRY_LIMITS, LISTING_LIMITS, USD_TO_KES_DEFAULT } from "./mongodb/limits";
import { normalizeKenyaPhone } from "./mongodb/kenya";
import { generateReferenceCode, publishIssues, consistencyIssues } from "./mongodb/property-rules";
import { propertySchema, type AgencyDocument, type PropertyDocument } from "./mongodb/property-schemas";
import { CLOSED_REASONS, ENQUIRY_STATUSES, canMoveStatus, type ListingStatus, type MemberRole } from "./mongodb/taxonomy";
import { emailHash, users } from "./auth.server";
import { foreignNewPhotos } from "./images.server";
import { decrypt, encrypt } from "./community.server";
import type { PropertyCard } from "./property-dto";

// Server-only: what the agency dashboard reads and changes. Every entry point starts with requireMember().
export class DashboardError extends Error {}
export const fail = (m: string): never => { throw new DashboardError(m); };
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null);

export type Member = Membership & { agency: AgencyDocument };

/** The signed-in person's membership of this agency, or an error. Suspended agencies cannot be used. */
export async function requireMember(db: Db, user: { id: string }, slug: string, action?: Action): Promise<Member> {
  await ensureAgencyIndexes(db);
  const agency = await agenciesCol(db).findOne({ slug });
  if (!agency) return fail("Agency not found");
  const m = await membersCol(db).findOne({ agencyId: agency._id, userId: user.id, status: "active" });
  if (!m) return fail("You are not a member of this agency");
  if (agency.status !== "active") return fail("This agency is suspended. Contact support@hodii.co.ke.");
  if (action && !can(m, action)) return fail("You do not have permission to do that");
  return { agencyId: agency._id, userId: user.id, role: m.role, permissions: (m as { permissions?: string[] | null }).permissions ?? null, agency };
}

/** Listings an agent may see: all for admins and owners, their own for agents. */
const listingScope = (m: Member): Filter<PropertyDocument> =>
  can(m, "listing.edit.any") ? { agencyId: m.agencyId } : { agencyId: m.agencyId, $or: [{ createdBy: m.userId }, { agentId: m.userId }] };

/* ───────────────────────────────── Overview ───────────────────────────────── */

export async function overview(db: Db, m: Member) {
  const scope = listingScope(m);
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const leadScope = can(m, "lead.view.all") ? { agencyId: m.agencyId } : { agencyId: m.agencyId, $or: [{ agentId: m.userId }, { assignedTo: m.userId }] };
  const all = can(m, "analytics.view.all");
  // People who may only see their own numbers get the stats of their own listings, never the whole agency's.
  const ownIds = !all && can(m, "analytics.view.own") ? (await propertiesCol(db).find(scope, { projection: { _id: 1 } }).limit(5000).toArray()).map((p) => String(p._id)) : [];
  const statScope = all ? { agencyId: m.agencyId } : { agencyId: m.agencyId, propertyId: { $in: ownIds } };
  const [byStatus, newLeads, daily, user] = await Promise.all([
    propertiesCol(db).aggregate([{ $match: scope }, { $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
    db.collection("enquiries").countDocuments({ ...leadScope, status: "new" }),
    all || can(m, "analytics.view.own")
      ? db.collection("propertyDailyStats").aggregate([
          { $match: { ...statScope, date: { $gte: since } } },
          { $group: { _id: "$date", views: { $sum: "$views" }, enquiries: { $sum: "$enquiries" }, phoneReveals: { $sum: "$phoneReveals" }, saves: { $sum: "$saves" } } },
          { $sort: { _id: 1 } },
        ]).toArray()
      : [],
    db.collection("users").findOne({ _id: m.userId as never }, { projection: { username: 1 } }),
  ]);
  const statuses: Record<string, number> = {};
  for (const s of byStatus) statuses[str(s["_id"])] = Number(s["count"]);
  const total = (k: string) => daily.reduce((n, d) => n + Number(d[k] ?? 0), 0);
  return {
    statuses, newLeads, username: str(user?.["username"], "there"), scope: (can(m, "listing.edit.any") ? "agency" : "own") as "agency" | "own", canSeeStats: all || can(m, "analytics.view.own"),
    last30: { views: total("views"), enquiries: total("enquiries"), phoneReveals: total("phoneReveals"), saves: total("saves") },
    series: daily.map((d) => ({ date: str(d["_id"]), views: Number(d["views"]), enquiries: Number(d["enquiries"]) })),
    verification: m.agency.verification.status,
  };
}

/* ───────────────────────────────── Listings ───────────────────────────────── */

export type ListingRow = PropertyCard & { status: ListingStatus; frozenReason: "owner" | "over_limit" | null; expiresAt: string | null; rejectionReason: string | null; views: number; enquiries: number; canEdit: boolean; createdByMe: boolean };
export const listingFilter = z.object({ status: z.enum(["draft", "pending_review", "published", "paused", "frozen", "expired", "rejected", "closed"]).optional(), q: z.string().trim().max(80).optional(), page: z.number().int().min(1).max(200).default(1) });

export async function listAgencyListings(db: Db, m: Member, f: z.infer<typeof listingFilter>) {
  const filter: Filter<PropertyDocument> = { ...listingScope(m) };
  if (f.status) filter.status = f.status;
  if (f.q) {
    const rx = new RegExp(f.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    (filter as Document)["$and"] = [{ $or: [{ title: rx }, { referenceCode: rx }, { "location.areaName": rx }] }];
  }
  const pageSize = 20;
  const [docs, total] = await Promise.all([
    propertiesCol(db).aggregate([
      { $match: filter }, { $sort: { updatedAt: -1, _id: 1 } }, { $skip: (f.page - 1) * pageSize }, { $limit: pageSize },
      { $project: {
        slug: 1, referenceCode: 1, title: 1, listingType: 1, category: 1, propertyType: 1, price: 1, priceHistory: 1, agencyId: 1, agentId: 1, createdBy: 1, publishedAt: 1, status: 1, expiresAt: 1, "moderation.rejectionReason": 1, stats: 1, promotion: 1,
        "verified.isVerified": 1, "location.county": 1, "location.areaName": 1, "details.bedrooms": 1, "details.bathrooms": 1, "details.parkingSpaces": 1, "details.floorAreaSqm": 1, "details.plotAreaSqm": 1,
        cover: { $arrayElemAt: ["$images", 0] }, more: { $slice: ["$images", 1, 4] }, imageCount: { $size: "$images" },
      } },
    ]).toArray(),
    propertiesCol(db).countDocuments(filter),
  ]);
  const agencies = await agenciesById(db, [m.agencyId]);
  const items: ListingRow[] = docs.map((d) => ({
    ...cardOf(d, agencies), status: d["status"] as ListingStatus, frozenReason: d["frozen"]?.["reason"] === "owner" || d["frozen"]?.["reason"] === "over_limit" ? d["frozen"]["reason"] : null, expiresAt: iso(d["expiresAt"]), rejectionReason: typeof d["moderation"]?.["rejectionReason"] === "string" ? d["moderation"]["rejectionReason"] : null,
    views: Number(d["stats"]?.["views"] ?? 0), enquiries: Number(d["stats"]?.["enquiries"] ?? 0),
    canEdit: canEditListing(m, { agencyId: m.agencyId, createdBy: str(d["createdBy"]), agentId: typeof d["agentId"] === "string" ? d["agentId"] : null }), createdByMe: d["createdBy"] === m.userId,
  }));
  return { items, total, page: f.page, pageSize };
}

export async function loadOwned(db: Db, m: Member, id: string): Promise<PropertyDocument> {
  const p = await propertiesCol(db).findOne({ _id: id, agencyId: m.agencyId } as Filter<PropertyDocument>);
  if (!p) return fail("Listing not found");
  return p;
}

export async function loadListingForEdit(db: Db, m: Member, id: string) {
  const p = await loadOwned(db, m, id);
  if (!canEditListing(m, p)) return fail("You can only edit your own listings");
  const { formFromListing } = await import("./listing-compose");
  return { id: p._id, status: p.status, referenceCode: p.referenceCode, slug: p.slug, rejectionReason: p.moderation.rejectionReason, form: formFromListing(p) };
}

export type SaveIntent = "draft" | "publish";
export type SaveResult = { ok: true; id: string; status: ListingStatus; slug: string; referenceCode: string } | { ok: false; issues: { path: string; message: string }[]; /** Set when the Basic listing limit is what stopped it, so the screen can offer the ways forward. */ limit?: LimitInfo };

/**
 * Saves a listing. "draft" keeps incomplete work; "publish" checks it is complete and either publishes it or sends it for review,
 * depending on whether the agency is verified. Edits to a live listing keep it live.
 */
export async function saveListing(db: Db, m: Member, id: string | null, form: ListingForm, intent: SaveIntent): Promise<SaveResult> {
  if (!can(m, "listing.create")) return fail("You do not have permission to add listings");
  await ensurePropertyIndexes(db);
  const now = new Date();
  const existing = id ? await loadOwned(db, m, id) : null;
  if (existing && !canEditListing(m, existing)) return fail("You can only edit your own listings");
  if (!existing) { const block = await storedBlock(db, m.agencyId); if (block) return { ok: false, issues: [{ path: "limit", message: block.message }], limit: block }; }
  if (!existing && (await propertiesCol(db).countDocuments({ agencyId: m.agencyId, status: { $in: ["draft", "pending_review", "published", "paused"] } })) >= 5000) return fail("This agency has reached its listing limit");
  if (form.agentId && !(await membersCol(db).findOne({ agencyId: m.agencyId, userId: form.agentId, status: "active" }, { projection: { _id: 1 } }))) return fail("The chosen agent is not on your team");
  if (form.agentId && form.agentId !== m.userId && !can(m, "listing.assign")) return fail("Only admins can assign listings to other agents");

  const foreign = [
    ...foreignNewPhotos(form.images, existing?.images ?? [], m.agencyId),
    ...foreignNewPhotos(form.floorPlans, existing?.floorPlans ?? [], m.agencyId),
  ];
  if (foreign.length) return { ok: false, issues: [{ path: "images", message: "New photos must be uploaded from your device. Photos that were already on this listing can stay, be reordered or be removed." }] };

  const currentlyLive = existing?.status === "published";
  const agencyState = { status: m.agency.status, verification: m.agency.verification.status } as const;
  let target: ListingStatus | null;
  if (intent === "draft") target = existing && existing.status !== "draft" && existing.status !== "rejected" ? existing.status : "draft";
  else if (currentlyLive) target = "published";
  else target = statusOnPublish(agencyState);
  if (target === null) return fail("This agency is suspended");
  if (existing && !canMoveStatus(existing.status, target)) return fail(`A ${existing.status.replace("_", " ")} listing cannot be moved to ${target.replace("_", " ")}`);
  if ((target === "published" || target === "pending_review") && !(existing && (existing.status === "published" || existing.status === "pending_review"))) {
    const block = await liveBlock(db, m.agencyId, existing ?? {});
    if (block) return { ok: false, issues: [{ path: "limit", message: block.message }], limit: block };
  }

  const agencyVerified = m.agency.verification.status === "verified";
  const write = (referenceCode: string, newId?: string) => withBadge(composeListing({ form, existing, agencyId: m.agencyId, userId: m.userId, now, status: target, referenceCode, ...(newId ? { newId } : {}), usdRate: usdRate() }), agencyVerified, now);
  let doc = write(existing?.referenceCode ?? generateReferenceCode());
  if (target !== "draft") {
    const issues = publishIssues(doc);
    if (issues.length) return { ok: false, issues };
  }
  const bad = consistencyIssues(doc);
  if (bad.length) return { ok: false, issues: bad };
  // Rejection clears when the author resubmits.
  if (existing?.status === "rejected" && target !== "rejected") doc = { ...doc, moderation: { reviewedBy: null, reviewedAt: null, rejectionReason: null } };
  const parsed = propertySchema.safeParse(doc);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };

  if (existing) {
    const { _id, createdAt, ...rest } = parsed.data as PropertyDocument;
    void _id; void createdAt;
    await propertiesCol(db).updateOne({ _id: existing._id }, { $set: rest } as never);
    return { ok: true, id: existing._id, status: target, slug: existing.slug, referenceCode: existing.referenceCode };
  }
  // Reference codes are random; on the rare clash, draw another and compose again.
  let toInsert = parsed.data as PropertyDocument;
  for (let attempt = 0; ; attempt++) {
    try {
      await propertiesCol(db).insertOne(toInsert as never);
      return { ok: true, id: toInsert._id, status: target, slug: toInsert.slug, referenceCode: toInsert.referenceCode };
    } catch (e) {
      if ((e as { code?: number }).code !== 11000 || attempt >= 4) throw e;
      const again = propertySchema.safeParse(write(generateReferenceCode()));
      if (!again.success) throw e;
      toInsert = again.data as PropertyDocument;
    }
  }
}
/** The verified badge on a listing follows its agency. */
const withBadge = (d: PropertyDocument, on: boolean, now: Date): PropertyDocument => ({ ...d, verified: { isVerified: on, verifiedAt: on ? d.verified.verifiedAt ?? now : null } });
const usdRate = () => { const n = Number(process.env["USD_TO_KES"]); return Number.isFinite(n) && n > 0 ? n : USD_TO_KES_DEFAULT; };

export const statusChange = z.object({ id: z.string().min(1).max(64), to: z.enum(["published", "paused", "frozen", "closed", "draft"]), reason: z.enum(CLOSED_REASONS).optional() });

export async function changeListingStatus(db: Db, m: Member, input: z.infer<typeof statusChange>) {
  const p = await loadOwned(db, m, input.id);
  if (!canEditListing(m, p)) return fail("You can only change your own listings");
  let to: ListingStatus = input.to;
  if (!canMoveStatus(p.status, to)) return fail(`A ${p.status.replace("_", " ")} listing cannot be ${to === "published" ? "published" : "moved to " + to}`);
  if (to === "closed" && !input.reason) return fail("Say whether the property was sold, let or withdrawn");
  const now = new Date();
  const set: Document = { status: to, updatedAt: now, closedReason: to === "closed" ? input.reason ?? null : null, frozen: to === "frozen" ? { reason: "owner", at: now } : null };
  if (to === "published") {
    const block = p.status === "published" || p.status === "pending_review" ? null : await liveBlock(db, m.agencyId, p as never);
    if (block) return fail(block.message);
    const issues = publishIssues(p);
    if (issues.length) return fail(issues[0]!.message);
    const next = statusOnPublish({ status: m.agency.status, verification: m.agency.verification.status });
    if (next === null) return fail("This agency is suspended");
    to = next;
    set["status"] = to;
    // A resumed listing keeps its expiry unless that has passed; a re-published expired one gets a fresh window.
    if (to === "published" && (!p.expiresAt || p.expiresAt < now)) { set["publishedAt"] = now; set["expiresAt"] = new Date(now.getTime() + LISTING_LIMITS.listingLifetimeDays * 86_400_000); }
    if (to === "published") set["lastConfirmedAt"] = now;
  }
  await propertiesCol(db).updateOne({ _id: p._id }, { $set: set } as never);
  return { status: to };
}

/** Only drafts, rejected and closed listings can be deleted; anything that was live is closed instead so its history survives. */
export async function deleteListing(db: Db, m: Member, id: string) {
  const p = await loadOwned(db, m, id);
  if (!can(m, "listing.delete") && !(p.createdBy === m.userId && p.status === "draft")) return fail("You do not have permission to delete this listing");
  if (!["draft", "rejected", "closed", "frozen"].includes(p.status)) return fail("Freeze or close this listing before deleting it");
  await propertiesCol(db).deleteOne({ _id: p._id });
  await db.collection("savedProperties").deleteMany({ propertyId: p._id });
  return { ok: true as const };
}

/** One more expiry window, for a live listing the agent confirms is still available. */
export async function confirmListing(db: Db, m: Member, id: string) {
  const p = await loadOwned(db, m, id);
  if (!canEditListing(m, p)) return fail("You can only change your own listings");
  if (p.status !== "published" && p.status !== "expired") return fail("Only live or expired listings can be renewed");
  const now = new Date();
  if (p.status === "expired") { const block = await liveBlock(db, m.agencyId, p as never); if (block) return fail(block.message); }
  const next = p.status === "expired" ? statusOnPublish({ status: m.agency.status, verification: m.agency.verification.status }) : "published";
  if (next === null) return fail("This agency is suspended");
  await propertiesCol(db).updateOne({ _id: p._id }, { $set: { status: next, expiresAt: new Date(now.getTime() + LISTING_LIMITS.listingLifetimeDays * 86_400_000), lastConfirmedAt: now, updatedAt: now } });
  return { status: next };
}

/* ───────────────────────────────── Enquiries ───────────────────────────────── */

export const enquiryFilter = z.object({ status: z.enum(ENQUIRY_STATUSES).optional(), page: z.number().int().min(1).max(200).default(1) });

export async function listEnquiries(db: Db, m: Member, f: z.infer<typeof enquiryFilter>) {
  if (!can(m, "lead.view.all") && !can(m, "lead.view.assigned")) return fail("You do not have permission to view enquiries");
  const filter: Document = can(m, "lead.view.all") ? { agencyId: m.agencyId } : { agencyId: m.agencyId, $or: [{ agentId: m.userId }, { assignedTo: m.userId }] };
  if (f.status) filter["status"] = f.status;
  const pageSize = 20;
  const [docs, total] = await Promise.all([
    db.collection("enquiries").find(filter).sort({ createdAt: -1 }).skip((f.page - 1) * pageSize).limit(pageSize).toArray(),
    db.collection("enquiries").countDocuments(filter),
  ]);
  return { items: await Promise.all(docs.map(readEnquiry)), total, page: f.page, pageSize };
}

export const enquiryUpdate = z.object({ id: z.string().min(1).max(64), status: z.enum(ENQUIRY_STATUSES).optional(), note: z.string().trim().min(1).max(500).optional(), assignTo: z.string().min(1).max(64).nullable().optional() });

export async function updateEnquiry(db: Db, m: Member, input: z.infer<typeof enquiryUpdate>) {
  const e = await db.collection("enquiries").findOne({ _id: input.id as never, agencyId: m.agencyId });
  if (!e) return fail("Enquiry not found");
  const lead = { agencyId: m.agencyId, agentId: typeof e["agentId"] === "string" ? e["agentId"] : null, assignedTo: typeof e["assignedTo"] === "string" ? e["assignedTo"] : null };
  if (!canViewLead(m, lead) || !canManageLead(m, lead)) return fail("You do not have permission to change this enquiry");
  const now = new Date();
  const set: Document = { updatedAt: now };
  if (input.status) { set["status"] = input.status; if (input.status !== "new" && !e["firstResponseAt"]) set["firstResponseAt"] = now; }
  if (input.assignTo !== undefined) {
    if (!can(m, "lead.manage.all")) return fail("Only admins can reassign enquiries");
    if (input.assignTo && !(await membersCol(db).findOne({ agencyId: m.agencyId, userId: input.assignTo, status: "active" }, { projection: { _id: 1 } }))) return fail("That person is not on your team");
    set["assignedTo"] = input.assignTo;
  }
  const update: Document = { $set: set };
  if (input.note) {
    if (((e["notes"] as unknown[] | undefined)?.length ?? 0) >= ENQUIRY_LIMITS.notesMax) return fail(`An enquiry can have up to ${ENQUIRY_LIMITS.notesMax} notes`);
    update["$push"] = { notes: { id: crypto.randomUUID(), authorId: m.userId, text: input.note, createdAt: now } };
  }
  await db.collection("enquiries").updateOne({ _id: input.id as never }, update);
  return { ok: true as const };
}

/* ───────────────────────────────── Team ───────────────────────────────── */

export async function listTeam(db: Db, m: Member) {
  if (!can(m, "team.view")) return fail("You do not have permission to view the team");
  const members = await membersCol(db).find({ agencyId: m.agencyId, status: { $in: ["active", "invited"] } }).sort({ createdAt: 1 }).limit(AGENCY_LIMITS.membersMax).toArray();
  const found = await users(db).find({ _id: { $in: members.map((x) => x.userId).filter((x): x is string => !!x) } as never }, { projection: { username: 1, emailEnc: 1 } }).toArray();
  const byId = new Map(found.map((u) => [String(u._id), u]));
  const showEmail = can(m, "team.invite");
  return Promise.all(members.map(async (x) => {
    const u = x.userId ? byId.get(x.userId) : undefined;
    return { userId: x.userId ?? `invite:${x._id}`, username: u?.username ?? (x.status === "invited" ? "Not signed up yet" : "Member"), email: showEmail ? (u ? await decrypt((u as { emailEnc?: string }).emailEnc) : x.invite?.emailEnc ? await decrypt(x.invite.emailEnc) : null) : null, role: x.role, permissions: (x as { permissions?: string[] | null }).permissions ?? null, title: x.title, phone: x.phone, joinedAt: iso(x.joinedAt), pending: x.status === "invited", isMe: x.userId === m.userId, canRemove: canRemoveMember(m, x.role) && x.userId !== m.userId };
  }));
}

export const addMemberInput = z.object({ email: z.string().trim().email().max(254), role: z.enum(["admin", "agent"]), permissions: z.array(z.string().max(40)).max(40).nullable().default(null), title: z.string().trim().max(60).nullable().default(null), phone: z.string().trim().max(20).nullable().default(null) });

/**
 * Adds someone to the team by invitation. A person who already has a Hodii account gets the invitation in their bell and joins when they
 * accept. If nobody has that email yet, the invitation waits and reaches them the moment they sign up with it. Nothing is emailed.
 */
export async function addMember(db: Db, m: Member, input: z.infer<typeof addMemberInput>) {
  if (!canInviteRole(m, input.role)) return fail("You do not have permission to add this kind of member");
  const hash = await emailHash(input.email);
  const user = await users(db).findOne({ emailHash: hash } as never);
  const userId = user ? String(user._id) : null;
  const phone = input.phone ? normalizeKenyaPhone(input.phone) : null;
  if (input.phone && !phone) return fail("Enter a Kenyan phone number, like 0712 345 678");
  if ((await membersCol(db).countDocuments({ agencyId: m.agencyId, status: { $in: ["active", "invited"] } })) >= AGENCY_LIMITS.membersMax) return fail(`A team can have up to ${AGENCY_LIMITS.membersMax} members, counting pending invitations`);
  const now = new Date();
  const permissions = input.permissions && input.role === "agent" ? grantable(m, input.permissions) : null;
  if (input.permissions && input.role === "agent" && !permissions?.length) return fail("Tick at least one thing this person may do, or choose the Agent role");
  const existing = await membersCol(db).findOne(userId ? { agencyId: m.agencyId, userId } : { agencyId: m.agencyId, "invite.emailHash": hash });
  if (existing?.status === "active") return fail("That person is already on your team");
  const invite = { emailHash: hash, emailEnc: await encrypt(input.email.trim().toLowerCase()), tokenHash: await sha256Hex(crypto.randomUUID()), expiresAt: new Date(now.getTime() + 14 * 86_400_000), invitedBy: m.userId };
  let inviteId: string;
  if (existing) {
    inviteId = String(existing._id);
    await membersCol(db).updateOne({ _id: existing._id }, { $set: { role: input.role, permissions, status: "invited", userId, invite, title: input.title, phone, joinedAt: null, updatedAt: now } });
  } else {
    inviteId = crypto.randomUUID();
    await membersCol(db).insertOne({ _id: inviteId, schemaVersion: 1, agencyId: m.agencyId, userId, role: input.role, permissions, status: "invited", invite, title: input.title, phone, whatsapp: null, photoUrl: null, bio: null, joinedAt: null, createdAt: now, updatedAt: now } as never);
  }
  if (userId) await notifyInvite(db, userId, inviteId, m.agency.name, input.role);
  return { ok: true as const, delivered: !!userId };
}

const sha256Hex = async (v: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)))].map((b) => b.toString(16).padStart(2, "0")).join("");

async function notifyInvite(db: Db, userId: string, inviteId: string, agencyName: string, role: string) {
  const { notify } = await import("./notifications.server");
  await notify(db, [userId], { kind: "invitation", title: `${agencyName} invited you to join their team`, body: `You would join as ${role === "admin" ? "an admin" : "an agent"}.`, link: null, inviteId, dedupeKey: `invite:${inviteId}:${Date.now()}` });
}

/** Called when someone signs up: invitations sent to their email before they had an account now reach them. */
export async function attachInvitations(db: Db, userId: string, hash: string) {
  const waiting = await membersCol(db).find({ status: "invited", userId: null, "invite.emailHash": hash, "invite.expiresAt": { $gt: new Date() } } as never).limit(20).toArray();
  for (const w of waiting) {
    await membersCol(db).updateOne({ _id: w._id }, { $set: { userId, updatedAt: new Date() } });
    const agency = await agenciesCol(db).findOne({ _id: w.agencyId } as never);
    await notifyInvite(db, userId, String(w._id), agency?.name ?? "An agency", w.role);
  }
}

/** The invited person accepts or declines. The agency's owners and admins are told either way. */
export async function respondToInvitation(db: Db, userId: string, inviteId: string, accept: boolean) {
  const m = await membersCol(db).findOne({ _id: inviteId, userId, status: "invited" } as never);
  if (!m) return fail("This invitation is no longer open");
  if (m.invite && m.invite.expiresAt.getTime() < Date.now()) return fail("This invitation has expired. Ask the agency to send a new one.");
  const now = new Date();
  await membersCol(db).updateOne({ _id: m._id }, accept ? { $set: { status: "active", invite: null, joinedAt: now, updatedAt: now } } : { $set: { status: "removed", invite: null, updatedAt: now } });
  const [agency, person] = await Promise.all([agenciesCol(db).findOne({ _id: m.agencyId } as never), users(db).findOne({ _id: userId } as never, { projection: { username: 1 } })]);
  const { notify, agencyPeople } = await import("./notifications.server");
  await notify(db, await agencyPeople(db, m.agencyId), { kind: "invitation", title: `${person?.username ?? "Someone"} ${accept ? "joined" : "declined to join"} ${agency?.name ?? "your team"}`, link: agency ? `/dashboard/agency/${agency.slug}/team` : null });
  return { ok: true as const, agencySlug: agency?.slug ?? null };
}

export async function removeMember(db: Db, m: Member, userId: string) {
  const target = await (userId.startsWith("invite:")
    ? membersCol(db).findOne({ _id: userId.slice(7), agencyId: m.agencyId, status: "invited" } as never)
    : membersCol(db).findOne({ agencyId: m.agencyId, userId, status: "active" }));
  if (!target) return fail("Member not found");
  if (target.userId === m.userId) return fail("Ask another owner to remove you, or delete the agency");
  if (!canRemoveMember(m, target.role)) return fail("You do not have permission to remove this member");
  await membersCol(db).updateOne({ _id: target._id }, { $set: { status: "removed", updatedAt: new Date() } });
  if (target.status === "invited") return { ok: true as const };
  // Their listings stay with the agency, unassigned, so nothing disappears from the site.
  await propertiesCol(db).updateMany({ agencyId: m.agencyId, agentId: userId }, { $set: { agentId: null } });
  await db.collection("enquiries").updateMany({ agencyId: m.agencyId, assignedTo: userId, status: "new" }, { $set: { assignedTo: null } });
  return { ok: true as const };
}

/** Gives one person exactly the things they may do, or puts them back on their role's defaults (null). */
export async function setMemberPermissions(db: Db, m: Member, userId: string, permissions: string[] | null) {
  const target = await (userId.startsWith("invite:")
    ? membersCol(db).findOne({ _id: userId.slice(7), agencyId: m.agencyId, status: "invited" } as never)
    : membersCol(db).findOne({ agencyId: m.agencyId, userId, status: "active" }));
  if (!target) return fail("Member not found");
  if (target.userId === m.userId) return fail("You cannot change your own permissions");
  if (!canShapeMember(m, target.role)) return fail("You do not have permission to change this person's access");
  const next = permissions ? grantable(m, permissions) : null;
  if (permissions && !next?.length) return fail("Tick at least one thing this person may do");
  await membersCol(db).updateOne({ _id: target._id }, { $set: { permissions: next, updatedAt: new Date() } } as never);
  return { ok: true as const };
}

export async function changeMemberRole(db: Db, m: Member, userId: string, next: MemberRole) {
  const target = await (userId.startsWith("invite:")
    ? membersCol(db).findOne({ _id: userId.slice(7), agencyId: m.agencyId, status: "invited" } as never)
    : membersCol(db).findOne({ agencyId: m.agencyId, userId, status: "active" }));
  if (!target) return fail("Member not found");
  const owners = await membersCol(db).countDocuments({ agencyId: m.agencyId, role: "owner", status: "active" });
  if (!canChangeRole(m, target.role, next, owners)) return fail("You cannot make that change");
  await membersCol(db).updateOne({ _id: target._id }, { $set: { role: next, permissions: null, updatedAt: new Date() } } as never);
  return { ok: true as const };
}

/* ───────────────────────────────── Agency profile ───────────────────────────────── */

const https = z.string().trim().url().max(300).refine((u) => u.startsWith("https://"), "Use a link that starts with https://");
export const agencyProfileInput = z.object({
  name: z.string().trim().min(AGENCY_LIMITS.nameMin).max(AGENCY_LIMITS.nameMax),
  description: z.string().trim().max(AGENCY_LIMITS.descriptionMax),
  phone: z.string().trim().max(20), whatsapp: z.string().trim().max(20).nullable(),
  email: z.string().trim().email().max(254), website: https.nullable(),
  countyCode: z.number().int().min(1).max(47).nullable(), area: z.string().trim().max(LISTING_LIMITS.areaNameMax).nullable(),
  serviceAreas: z.array(z.number().int().min(1).max(47)).max(AGENCY_LIMITS.serviceAreasMax),
  earbNumber: z.string().trim().max(AGENCY_LIMITS.registrationNumberMax).nullable(), businessRegNumber: z.string().trim().max(AGENCY_LIMITS.registrationNumberMax).nullable(),
  logoUrl: https.nullable(),
  /** Left out by older callers; when present they replace the stored value. */
  coverUrl: https.nullable().optional(),
  tagline: z.string().trim().max(AGENCY_LIMITS.taglineMax).optional(), story: z.string().trim().max(AGENCY_LIMITS.storyMax).optional(),
  services: z.array(z.string().trim().min(1).max(40)).max(AGENCY_LIMITS.servicesMax).optional(), hours: z.string().trim().max(200).nullable().optional(),
  foundedYear: z.number().int().min(1900).max(new Date().getFullYear()).nullable().optional(),
  socials: z.object({ facebook: https.nullable(), instagram: https.nullable(), x: https.nullable(), tiktok: https.nullable(), linkedin: https.nullable(), youtube: https.nullable() }).partial().optional(),
});

export async function loadAgencyProfile(db: Db, m: Member) {
  const a = m.agency;
  return {
    id: a._id, slug: a.slug, name: a.name, kind: a.kind, description: a.description, phone: a.contact.phone, whatsapp: a.contact.whatsapp, email: a.contact.email, website: a.contact.website,
    countyCode: a.address.countyCode, area: a.address.area, serviceAreas: a.serviceAreas, earbNumber: a.registration.earbNumber, businessRegNumber: a.registration.businessRegNumber,
    logoUrl: a.logo?.url ?? null, coverUrl: a.cover?.url ?? null, tagline: a.tagline ?? "", story: a.story ?? "", services: a.services ?? [], hours: a.hours ?? "", foundedYear: a.foundedYear ?? null, socials: a.socials ?? {},
    verification: { status: a.verification.status, rejectionReason: a.verification.rejectionReason, submittedAt: iso(a.verification.submittedAt) },
    canEdit: can(m, "agency.edit"), canSubmitVerification: can(m, "agency.submit_verification"),
  };
}

export async function updateAgencyProfile(db: Db, m: Member, input: z.infer<typeof agencyProfileInput>) {
  if (!can(m, "agency.edit")) return fail("You do not have permission to edit the agency");
  const phone = normalizeKenyaPhone(input.phone);
  if (!phone) return fail("Enter a Kenyan phone number, like 0712 345 678");
  const whatsapp = input.whatsapp ? normalizeKenyaPhone(input.whatsapp) : null;
  if (input.whatsapp && !whatsapp) return fail("Enter a valid WhatsApp number");
  const set: Document = {
    name: input.name, description: input.description, "contact.phone": phone, "contact.whatsapp": whatsapp, "contact.email": input.email.toLowerCase(), "contact.website": input.website,
    "address.countyCode": input.countyCode, "address.area": input.area || null, serviceAreas: [...new Set(input.serviceAreas)],
    "registration.earbNumber": input.earbNumber || null, "registration.businessRegNumber": input.businessRegNumber || null, updatedAt: new Date(),
  };
  if (input.logoUrl) set["logo"] = { url: input.logoUrl, width: 400, height: 400 };
  else set["logo"] = null;
  if (input.coverUrl !== undefined) set["cover"] = input.coverUrl ? { url: input.coverUrl, width: 1600, height: 600 } : null;
  if (input.tagline !== undefined) set["tagline"] = input.tagline;
  if (input.story !== undefined) set["story"] = input.story;
  if (input.services !== undefined) set["services"] = [...new Set(input.services.filter(Boolean))];
  if (input.hours !== undefined) set["hours"] = input.hours || null;
  if (input.foundedYear !== undefined) set["foundedYear"] = input.foundedYear;
  if (input.socials !== undefined) for (const k of ["facebook", "instagram", "x", "tiktok", "linkedin", "youtube"] as const) set[`socials.${k}`] = input.socials[k] ?? null;
  const unset = m.agency.name !== input.name && m.agency.verification.status === "verified" ? { "verification.status": "pending" } : null;
  // A verified agency that renames itself is re-checked, so a badge cannot be moved onto a different business.
  await agenciesCol(db).updateOne({ _id: m.agencyId }, { $set: { ...set, ...(unset ?? {}) } } as never);
  if (unset) await propertiesCol(db).updateMany({ agencyId: m.agencyId }, { $set: { "verified.isVerified": false, "verified.verifiedAt": null } });
  return { ok: true as const };
}

export async function submitVerification(db: Db, m: Member) {
  if (!can(m, "agency.submit_verification")) return fail("You do not have permission to submit verification");
  const a = m.agency;
  if (a.verification.status === "verified") return fail("This agency is already verified");
  if (a.verification.status === "pending") return fail("Verification is already with our team");
  if (!a.registration.businessRegNumber && !a.registration.earbNumber) return fail("Add your business registration or EARB number first");
  const now = new Date();
  await agenciesCol(db).updateOne({ _id: m.agencyId }, { $set: { "verification.status": "pending", "verification.submittedAt": now, "verification.rejectionReason": null, updatedAt: now } });
  return { ok: true as const };
}

/**
 * A listing that was waiting for a payment (a draft, a frozen or an expired listing) goes live the moment it is paid for.
 * Paid listings are never held back by the Basic limit. Anything still missing from the listing, or a suspended agency, leaves it as it was.
 */
export async function publishPaid(db: Db, propertyId: string): Promise<ListingStatus | null> {
  const p = await propertiesCol(db).findOne({ _id: propertyId } as Filter<PropertyDocument>);
  if (!p || !["draft", "frozen", "expired"].includes(p.status)) return null;
  const agency = await db.collection("agencies").findOne({ _id: p.agencyId as never });
  if (!agency) return null;
  if (publishIssues(p).length) return null;
  const next = statusOnPublish({ status: agency["status"], verification: agency["verification"]?.status });
  if (next === null) return null;
  const mem = await membersCol(db).findOne({ agencyId: p.agencyId, userId: p.createdBy, status: "active" }, { projection: { role: 1 } });
  const to: ListingStatus = next;
  void mem;
  const now = new Date();
  const set: Document = { status: to, updatedAt: now, frozen: null };
  if (to === "published") {
    // Live for a full term from today, or until the paid term ends if that is later.
    const term = new Date(now.getTime() + LISTING_LIMITS.listingLifetimeDays * 86_400_000);
    set["lastConfirmedAt"] = now; set["expiresAt"] = p.expiresAt && p.expiresAt > term ? p.expiresAt : term;
    if (!p.publishedAt) set["publishedAt"] = now;
  }
  await propertiesCol(db).updateOne({ _id: p._id }, { $set: set } as never);
  return to;
}
