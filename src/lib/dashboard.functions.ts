import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { listingFormSchema } from "./listing-compose";
import { REPORT_REASON_KEYS } from "./mongodb/taxonomy";

const dash = () => import("./dashboard.server");
const bulk = () => import("./bulk.server");
const threads = () => import("./enquiry-threads.server");
const auth = () => import("./auth.server");
const slugIn = z.string().min(1).max(120);
const idIn = z.string().min(1).max(64);

/** Runs `fn` as a member of the agency, turning our own error type into a message the page can show. */
async function asMember<T>(slug: string, action: Parameters<Awaited<ReturnType<typeof dash>>["requireMember"]>[3], fn: (db: import("mongodb").Db, m: import("./dashboard.server").Member, me: { id: string }) => Promise<T>) {
  const { requireUser, authDb } = await auth();
  const { requireMember } = await dash();
  const me = await requireUser();
  return authDb(async (db) => fn(db, await requireMember(db, me, slug, action), me));
}

export const getAgencyOverview = createServerFn({ method: "GET" }).inputValidator((d) => z.object({ slug: slugIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, undefined, async (db, m) => ({ agency: { name: m.agency.name, slug: m.agency.slug, role: m.role, access: { role: m.role, permissions: m.permissions ?? null } }, ...(await (await dash()).overview(db, m)) })));

export const getAgencyListings = createServerFn({ method: "GET" })
  .inputValidator(async (d) => { const { listingFilter } = await dash(); return z.object({ slug: slugIn }).and(listingFilter).parse(d); })
  .handler(async ({ data }) => asMember(data.slug, undefined, async (db, m) => (await dash()).listAgencyListings(db, m, data)));

export const getListingForEdit = createServerFn({ method: "GET" }).inputValidator((d) => z.object({ slug: slugIn, id: idIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, undefined, async (db, m) => (await dash()).loadListingForEdit(db, m, data.id)));

/** For the agent picker in the listing form. */
export const getAgencyAgents = createServerFn({ method: "GET" }).inputValidator((d) => z.object({ slug: slugIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, "listing.create", async (db, m) => {
    const team = await (await dash()).listTeam(db, { ...m, role: "admin" });
    return team.map((t) => ({ userId: t.userId, name: t.username, canPick: m.role !== "agent" || t.userId === m.userId })).filter((t) => t.canPick);
  }));

export const saveAgencyListing = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: slugIn, id: idIn.nullable(), intent: z.enum(["draft", "publish"]), form: listingFormSchema }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, "listing.create", async (db, m) => {
    try { return await (await import("./dashboard.server")).saveListing(db, m, data.id, data.form, data.intent); }
    catch (e) {
      // Say what the database refused, so the person (and we) are not left with "could not save".
      const err = e as { code?: number; message?: string; errInfo?: { details?: { schemaRulesNotSatisfied?: { propertyName?: string; description?: string; reason?: string }[] } } };
      if (err.code === 121) {
        const rule = JSON.stringify(err.errInfo?.details?.schemaRulesNotSatisfied ?? []).slice(0, 300);
        console.error("[saveListing] validator rejected:", rule);
        throw new Error(`The database rejected this listing: ${rule.replace(/[[\]{}"]/g, " ").replace(/\s+/g, " ").trim() || "a field has a value it does not accept"}`);
      }
      if (err.code === 11000) throw new Error("This listing clashes with an existing one (same reference code or slug). Save again to get a fresh one.");
      throw e;
    }
  }));

export const setListingStatus = createServerFn({ method: "POST" })
  .inputValidator(async (d) => { const { statusChange } = await dash(); return z.object({ slug: slugIn }).and(statusChange).parse(d); })
  .handler(async ({ data }) => asMember(data.slug, undefined, async (db, m) => (await dash()).changeListingStatus(db, m, data)));

export const renewListing = createServerFn({ method: "POST" }).inputValidator((d) => z.object({ slug: slugIn, id: idIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, undefined, async (db, m) => (await dash()).confirmListing(db, m, data.id)));

export const getAgencyEnquiries = createServerFn({ method: "GET" })
  .inputValidator(async (d) => { const { enquiryFilter } = await dash(); return z.object({ slug: slugIn }).and(enquiryFilter).parse(d); })
  .handler(async ({ data }) => asMember(data.slug, undefined, async (db, m) => (await dash()).listEnquiries(db, m, data)));

export const updateAgencyEnquiry = createServerFn({ method: "POST" })
  .inputValidator(async (d) => { const { enquiryUpdate } = await dash(); return z.object({ slug: slugIn }).and(enquiryUpdate).parse(d); })
  .handler(async ({ data }) => asMember(data.slug, undefined, async (db, m) => (await dash()).updateEnquiry(db, m, data)));

export const getAgencyTeam = createServerFn({ method: "GET" }).inputValidator((d) => z.object({ slug: slugIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, "team.view", async (db, m) => (await dash()).listTeam(db, m)));

export const addAgencyMember = createServerFn({ method: "POST" })
  .inputValidator(async (d) => { const { addMemberInput } = await dash(); return z.object({ slug: slugIn }).and(addMemberInput).parse(d); })
  .handler(async ({ data }) => asMember(data.slug, "team.invite", async (db, m) => (await dash()).addMember(db, m, data)));

export const removeAgencyMember = createServerFn({ method: "POST" }).inputValidator((d) => z.object({ slug: slugIn, userId: idIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, "team.remove", async (db, m) => (await dash()).removeMember(db, m, data.userId)));

export const setMemberAccess = createServerFn({ method: "POST" }).inputValidator((d) => z.object({ slug: slugIn, userId: idIn, permissions: z.array(z.string().max(40)).max(40).nullable() }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, "team.invite", async (db, m) => (await dash()).setMemberPermissions(db, m, data.userId, data.permissions)));
export const setMemberRole = createServerFn({ method: "POST" }).inputValidator((d) => z.object({ slug: slugIn, userId: idIn, role: z.enum(["owner", "admin", "agent"]) }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, "team.change_role", async (db, m) => (await dash()).changeMemberRole(db, m, data.userId, data.role)));

export const getAgencyProfile = createServerFn({ method: "GET" }).inputValidator((d) => z.object({ slug: slugIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, undefined, async (db, m) => (await dash()).loadAgencyProfile(db, m)));

export const saveAgencyProfile = createServerFn({ method: "POST" })
  .inputValidator(async (d) => { const { agencyProfileInput } = await dash(); return z.object({ slug: slugIn }).and(agencyProfileInput).parse(d); })
  .handler(async ({ data }) => asMember(data.slug, "agency.edit", async (db, m) => (await dash()).updateAgencyProfile(db, m, data)));

export const requestVerification = createServerFn({ method: "POST" }).inputValidator((d) => z.object({ slug: slugIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, "agency.submit_verification", async (db, m) => (await dash()).submitVerification(db, m)));

/** Signed parameters for a direct photo upload. */
export const getUploadSignature = createServerFn({ method: "POST" }).inputValidator((d) => z.object({ slug: slugIn, kind: z.enum(["listing", "logo", "cover"]) }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, data.kind !== "listing" ? "agency.edit" : "listing.create", async (_db, m) => (await import("./images.server")).signUpload(m.agencyId, data.kind)));

export { REPORT_REASON_KEYS };

/* Personal dashboard: enquiries the person has sent. */
export const getMyEnquiries = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser, authDb } = await auth();
  const me = await requireUser();
  return authDb(async (db) => {
    const rows = await db.collection("enquiries").find({ userId: me.id }).sort({ createdAt: -1 }).limit(50).toArray();
    const unread = await (await threads()).unreadByEnquiry(db, me.id, rows.map((r) => String(r["_id"])));
    return rows.map((r) => ({ id: String(r["_id"]), propertyId: String(r["propertyId"]), propertyRef: String(r["propertyRef"]), propertyTitle: String(r["propertyTitle"]), message: String(r["message"]), status: String(r["status"]), createdAt: (r["createdAt"] as Date).toISOString(), unread: unread.get(String(r["_id"])) ?? 0 }));
  });
});

/* ---------- Bulk work ---------- */

export const commitListingImport = createServerFn({ method: "POST" })
  .inputValidator(async (d) => { const { importInput } = await bulk(); return z.object({ slug: slugIn }).and(importInput).parse(d); })
  .handler(async ({ data }) => asMember(data.slug, "listing.create", async (db, m) => (await bulk()).commitImport(db, m, data.text)));

export const bulkListingAction = createServerFn({ method: "POST" })
  .inputValidator(async (d) => { const { bulkInput } = await bulk(); return z.object({ slug: slugIn }).and(bulkInput).parse(d); })
  .handler(async ({ data }) => asMember(data.slug, undefined, async (db, m, me) => {
    const { users, verifyPassword } = await auth();
    const { slug: _s, ...input } = data;
    void _s;
    return (await bulk()).bulkAction(db, m, input, async (pw) => { const u = await users(db).findOne({ _id: me.id }); return !!u && (await verifyPassword(pw, u.passwordHash)); });
  }));

export const exportAgencyListings = createServerFn({ method: "GET" }).inputValidator((d) => z.object({ slug: slugIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, undefined, async (db, m) => (await bulk()).exportListingsCsv(db, m)));

/* ---------- Enquiry conversations ---------- */

/** Turns the thread module's own error into a message the page can show, like asMember does for the dashboard. */
async function threadCall<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) { const { ThreadError } = await threads(); if (e instanceof ThreadError) throw new Error(e.message); throw e; }
}

export const getAgencyThread = createServerFn({ method: "GET" }).inputValidator(async (d) => { const { threadInput } = await threads(); return z.object({ slug: slugIn }).and(threadInput).parse(d); })
  .handler(async ({ data }) => threadCall(() => asMember(data.slug, undefined, async (db, m) => (await threads()).agencyThread(db, m, data.enquiryId))));

export const replyAsAgency = createServerFn({ method: "POST" }).inputValidator(async (d) => { const { replyInput } = await threads(); return z.object({ slug: slugIn }).and(replyInput).parse(d); })
  .handler(async ({ data }) => threadCall(() => asMember(data.slug, undefined, async (db, m) => (await threads()).agencyReply(db, m, data))));

export const getMyThread = createServerFn({ method: "GET" }).inputValidator(async (d) => { const { threadInput } = await threads(); return threadInput.parse(d); })
  .handler(async ({ data }) => threadCall(async () => { const { requireUser, authDb } = await auth(); const me = await requireUser(); return authDb((db) => import("./enquiry-threads.server").then((t) => t.myThread(db, me.id, data.enquiryId))); }));

export const replyAsEnquirer = createServerFn({ method: "POST" }).inputValidator(async (d) => { const { replyInput } = await threads(); return replyInput.parse(d); })
  .handler(async ({ data }) => threadCall(async () => { const { requireUser, authDb } = await auth(); const me = await requireUser(); return authDb((db) => import("./enquiry-threads.server").then((t) => t.myReply(db, me.id, data))); }));
