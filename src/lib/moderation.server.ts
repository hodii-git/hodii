import type { Db, Document, Filter } from "mongodb";
import { z } from "zod";
import { agenciesCol } from "./agency.server";
import { propertiesCol } from "./properties.server";
import { LISTING_LIMITS } from "./mongodb/limits";
import { publishIssues } from "./mongodb/property-rules";
import type { PropertyDocument } from "./mongodb/property-schemas";
import { getSettings } from "./settings.server";
import { waiting } from "./sla";

// Server-only: the staff queue for listings, agency verification and listing reports. Callers have already passed requireAdmin().
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);
export class ModerationError extends Error {}
const fail = (m: string): never => { throw new ModerationError(m); };

export async function moderationCounts(db: Db) {
  const [listings, agencies, reports] = await Promise.all([
    propertiesCol(db).countDocuments({ status: "pending_review" }),
    agenciesCol(db).countDocuments({ "verification.status": "pending" }),
    db.collection("listingReports").countDocuments({ status: { $in: ["open", "reviewing"] } }),
  ]);
  const v = await getSettings();
  const cut = (h: number) => new Date(Date.now() - h * 3_600_000);
  const [overdueAgencies, overdueReports] = await Promise.all([
    Number(v["review.verifySlaHours"]) > 0 ? agenciesCol(db).countDocuments({ "verification.status": "pending", "verification.submittedAt": { $lte: cut(Number(v["review.verifySlaHours"])) } }) : 0,
    Number(v["review.reportSlaHours"]) > 0 ? db.collection("listingReports").countDocuments({ status: { $in: ["open", "reviewing"] }, createdAt: { $lte: cut(Number(v["review.reportSlaHours"])) } }) : 0,
  ]);
  return { listings, agencies, reports, overdue: overdueAgencies + overdueReports };
}

export async function pendingListings(db: Db) {
  const docs = await propertiesCol(db).find({ status: "pending_review" }).sort({ updatedAt: 1 }).limit(50).toArray();
  const agencies = new Map((await agenciesCol(db).find({ _id: { $in: [...new Set(docs.map((d) => d.agencyId))] } }).toArray()).map((a) => [a._id, a]));
  return docs.map((d) => ({
    id: d._id, title: d.title, referenceCode: d.referenceCode, slug: d.slug, listingType: d.listingType, propertyType: d.propertyType,
    price: d.price ? `${d.price.currency} ${d.price.amount.toLocaleString("en-KE")}${d.price.period === "total" ? "" : ` / ${d.price.period}`}` : "No price",
    place: [d.location.areaName, d.location.county].filter(Boolean).join(", "), description: d.description, images: d.images.slice(0, 8).map((i) => ({ url: i.thumbUrl ?? i.url, alt: i.alt })), imageCount: d.images.length,
    agency: { name: agencies.get(d.agencyId)?.name ?? "Unknown", slug: agencies.get(d.agencyId)?.slug ?? "", verified: agencies.get(d.agencyId)?.verification.status === "verified" },
    submittedAt: iso(d.updatedAt), problems: publishIssues(d).map((i) => i.message),
  }));
}

export const decideListing = z.object({ id: z.string().min(1).max(64), decision: z.enum(["approve", "reject"]), reason: z.string().trim().max(500).optional() })
  .refine((v) => v.decision === "approve" || (v.reason && v.reason.length >= 5), { path: ["reason"], message: "Tell the agent why, in at least a few words" });

async function tellAgency(db: Db, p: { agencyId: string; agentId?: string | null; slug: string; _id: string }, title: string, body: string) {
  try {
    const { notify, agencyPeople } = await import("./notifications.server");
    const agency = await agenciesCol(db).findOne({ _id: p.agencyId });
    await notify(db, await agencyPeople(db, p.agencyId, ["owner", "admin"], [p.agentId]), { kind: "listing_decision", title, body, link: agency ? `/dashboard/agency/${agency.slug}/listings/${p._id}` : null });
  } catch (e) { console.error("listing notification", e); }
}

export async function decideOnListing(db: Db, admin: { id: string }, input: z.infer<typeof decideListing>) {
  const p = await propertiesCol(db).findOne({ _id: input.id, status: "pending_review" } as Filter<PropertyDocument>);
  if (!p) return fail("This listing is no longer waiting for review");
  const now = new Date();
  if (input.decision === "reject") {
    await propertiesCol(db).updateOne({ _id: p._id }, { $set: { status: "rejected", moderation: { reviewedBy: admin.id, reviewedAt: now, rejectionReason: input.reason ?? null }, updatedAt: now } });
    await tellAgency(db, p, `Needs changes: ${String(p.title ?? "").slice(0, 80)}`, input.reason ? `Reason: ${input.reason}` : "Open the listing to see what to fix, then submit it again.");
    return { ok: true as const };
  }
  const issues = publishIssues(p);
  if (issues.length) return fail(`Not complete: ${issues[0]!.message}`);
  await propertiesCol(db).updateOne({ _id: p._id }, { $set: {
    status: "published", publishedAt: p.publishedAt ?? now, expiresAt: new Date(now.getTime() + LISTING_LIMITS.listingLifetimeDays * 86_400_000), lastConfirmedAt: now,
    moderation: { reviewedBy: admin.id, reviewedAt: now, rejectionReason: null }, updatedAt: now,
  } });
  await tellAgency(db, p, `Now live: ${String(p.title ?? "").slice(0, 80)}`, "Your listing passed review and is visible to everyone.");
  return { ok: true as const };
}

export async function pendingAgencies(db: Db) {
  const sla = Number((await getSettings())["review.verifySlaHours"]);
  const rows = await agenciesCol(db).find({ "verification.status": "pending" }).sort({ "verification.submittedAt": 1 }).limit(50).toArray();
  return rows.map((a) => ({ id: a._id, name: a.name, slug: a.slug, kind: a.kind, phone: a.contact.phone, email: a.contact.email, website: a.contact.website, businessRegNumber: a.registration.businessRegNumber, earbNumber: a.registration.earbNumber, submittedAt: iso(a.verification.submittedAt), wait: waiting(a.verification.submittedAt, sla) }));
}

export const decideAgency = z.object({ id: z.string().min(1).max(64), decision: z.enum(["verify", "reject"]), reason: z.string().trim().max(500).optional() })
  .refine((v) => v.decision === "verify" || (v.reason && v.reason.length >= 5), { path: ["reason"], message: "Tell them why, in at least a few words" });

export async function decideOnAgency(db: Db, admin: { id: string }, input: z.infer<typeof decideAgency>) {
  const a = await agenciesCol(db).findOne({ _id: input.id, "verification.status": "pending" });
  if (!a) return fail("This agency is no longer waiting for verification");
  const now = new Date();
  const verified = input.decision === "verify";
  await agenciesCol(db).updateOne({ _id: a._id }, { $set: { "verification.status": verified ? "verified" : "rejected", "verification.reviewedAt": now, "verification.reviewedBy": admin.id, "verification.rejectionReason": verified ? null : input.reason ?? null, updatedAt: now } });
  // The badge on each listing follows the agency, so searches can filter on it without a join.
  await propertiesCol(db).updateMany({ agencyId: a._id }, { $set: { "verified.isVerified": verified, "verified.verifiedAt": verified ? now : null } });
  try {
    const { notify, agencyPeople } = await import("./notifications.server");
    await notify(db, await agencyPeople(db, a._id), { kind: "agency_decision", title: verified ? `${a.name} is now verified` : `${a.name} was not verified`, body: verified ? "Your listings now carry the verified badge and go live without waiting for review." : input.reason ? `Reason: ${input.reason}` : "Check your details in settings and submit again.", link: `/dashboard/agency/${a.slug}/settings` });
  } catch (e) { console.error("agency notification", e); }
  return { ok: true as const };
}

export async function openReports(db: Db) {
  const sla = Number((await getSettings())["review.reportSlaHours"]);
  const rows = await db.collection("listingReports").find({ status: { $in: ["open", "reviewing"] } }).sort({ createdAt: 1 }).limit(50).toArray();
  const props = new Map((await propertiesCol(db).find({ _id: { $in: rows.map((r) => str(r["propertyId"])) } }, { projection: { title: 1, slug: 1, status: 1, referenceCode: 1, agencyId: 1 } }).toArray()).map((p) => [p._id, p]));
  const counts = await db.collection("listingReports").aggregate([{ $match: { propertyId: { $in: [...props.keys()] }, status: { $in: ["open", "reviewing"] } } }, { $group: { _id: "$propertyId", n: { $sum: 1 } } }]).toArray();
  const byProp = new Map(counts.map((c) => [str(c["_id"]), Number(c["n"])]));
  return rows.map((r) => { const p = props.get(str(r["propertyId"])); return {
    id: str(r["_id"]), wait: waiting(r["createdAt"] as Date, sla), reason: str(r["reason"]), details: typeof r["details"] === "string" ? r["details"] : null, createdAt: iso(r["createdAt"]),
    property: p ? { id: p._id, title: p.title, slug: p.slug, status: p.status, referenceCode: p.referenceCode, openReports: byProp.get(p._id) ?? 1 } : null,
  }; });
}

export const decideReport = z.object({ id: z.string().min(1).max(64), decision: z.enum(["dismiss", "pause_listing", "remove_listing"]), note: z.string().trim().max(500).optional() });

export async function decideOnReport(db: Db, admin: { id: string }, input: z.infer<typeof decideReport>) {
  const r = await db.collection("listingReports").findOne({ _id: input.id as never, status: { $in: ["open", "reviewing"] } });
  if (!r) return fail("This report was already handled");
  const now = new Date();
  const propertyId = str(r["propertyId"]);
  if (input.decision !== "dismiss") {
    // Pausing hides the listing but keeps it editable; removing marks it rejected so the agent sees the reason.
    const set: Document = input.decision === "pause_listing" ? { status: "paused", updatedAt: now } : { status: "rejected", moderation: { reviewedBy: admin.id, reviewedAt: now, rejectionReason: input.note || "Removed after a report" }, updatedAt: now };
    await propertiesCol(db).updateOne({ _id: propertyId, status: { $in: ["published", "paused"] } } as Filter<PropertyDocument>, { $set: set } as never);
  }
  const final = input.decision === "dismiss" ? "dismissed" : "actioned";
  // Every other open report on the same listing is settled the same way, so one problem is not handled twice.
  await db.collection("listingReports").updateMany({ propertyId, status: { $in: ["open", "reviewing"] } }, { $set: { status: final, handledBy: admin.id, handledAt: now, resolution: input.note || input.decision.replace("_", " ") } });
  return { ok: true as const };
}
