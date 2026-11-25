import type { Db } from "mongodb";
import { z } from "zod";
import { MAX_OWNED_AGENCIES, canCreateAgency, type AgencyRef } from "./access";
import { ensureCollectionIndexes } from "./mongodb/ensure";
import { toSlug, normalizeKenyaPhone } from "./mongodb/kenya";
import { AGENCY_LIMITS } from "./mongodb/limits";
import { agencyMemberSchema, agencySchema, type AgencyDocument, type AgencyMemberDocument } from "./mongodb/property-schemas";
import { AGENCY_KIND_KEYS } from "./mongodb/taxonomy";

// Server-only: agencies and their team members.
export const agenciesCol = (db: Db) => db.collection<AgencyDocument>("agencies");
export const membersCol = (db: Db) => db.collection<AgencyMemberDocument>("agencyMembers");
export const ensureAgencyIndexes = (db: Db) => ensureCollectionIndexes(db, ["agencies", "agencyMembers"]);

/** What a person gives when they create an agency (at sign-up, or later from their account). */
export const createAgencyInput = z.object({
  name: z.string().trim().min(AGENCY_LIMITS.nameMin, "Enter your agency or business name").max(AGENCY_LIMITS.nameMax),
  kind: z.enum(AGENCY_KIND_KEYS).default("estate_agency"),
  phone: z.string().trim().transform((v, ctx) => {
    const p = normalizeKenyaPhone(v);
    if (!p) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a Kenyan phone number, like 0712 345 678" });
    return p ?? "";
  }),
  countyCode: z.number().int().min(1).max(47).nullable().default(null),
});
export type CreateAgencyInput = z.infer<typeof createAgencyInput>;

/** Agencies a person actively belongs to, with their role in each: what the dashboards and the header menu are built from. */
export async function agenciesOfUser(db: Db, userId: string): Promise<AgencyRef[]> {
  await ensureAgencyIndexes(db);
  const memberships = await membersCol(db).find({ userId, status: "active" }, { projection: { agencyId: 1, role: 1 } }).limit(50).toArray();
  if (!memberships.length) return [];
  const agencies = await agenciesCol(db).find({ _id: { $in: memberships.map((m) => m.agencyId) }, status: "active" }, { projection: { slug: 1, name: 1 } }).toArray();
  const byId = new Map(agencies.map((a) => [a._id, a]));
  return memberships.flatMap((m) => { const a = byId.get(m.agencyId); return a ? [{ id: a._id, slug: a.slug, name: a.name, role: m.role }] : []; });
}

const isDuplicate = (e: unknown) => (e as { code?: number }).code === 11000;
const suffix = () => Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");

/**
 * Creates an agency and makes `user` its owner. Throws when the person already owns the maximum number of agencies.
 * The slug is the name in URL form; if it is taken, a short suffix is added.
 */
export async function createAgency(db: Db, user: { id: string; email: string }, input: CreateAgencyInput): Promise<{ id: string; slug: string }> {
  await ensureAgencyIndexes(db);
  const owned = await membersCol(db).countDocuments({ userId: user.id, role: "owner", status: "active" });
  if (!canCreateAgency(owned)) throw new Error(`You can own up to ${MAX_OWNED_AGENCIES} agencies`);

  const now = new Date();
  const base = toSlug(input.name).slice(0, 60) || "agency";
  const id = crypto.randomUUID();
  let slug = base;
  for (let attempt = 0; ; attempt++) {
    const doc = agencySchema.parse({
      _id: id, schemaVersion: 1, slug, name: input.name, kind: input.kind, legalName: null, description: "", logo: null, cover: null,
      contact: { phone: input.phone, whatsapp: null, email: user.email.toLowerCase(), website: null },
      address: { countyCode: input.countyCode, area: null, street: null }, serviceAreas: input.countyCode ? [input.countyCode] : [],
      registration: { earbNumber: null, businessRegNumber: null },
      verification: { status: "unverified", submittedAt: null, reviewedAt: null, reviewedBy: null, rejectionReason: null, documents: [] },
      status: "active", suspendedReason: null, createdBy: user.id, createdAt: now, updatedAt: now,
    });
    try { await agenciesCol(db).insertOne(doc); break; }
    catch (e) { if (!isDuplicate(e) || attempt >= 5) throw e; slug = `${base}-${suffix()}`; }
  }

  const member = agencyMemberSchema.parse({
    _id: crypto.randomUUID(), schemaVersion: 1, agencyId: id, userId: user.id, role: "owner", status: "active", invite: null,
    title: null, phone: input.phone, whatsapp: null, photoUrl: null, bio: null, joinedAt: now, createdAt: now, updatedAt: now,
  });
  try { await membersCol(db).insertOne(member); }
  catch (e) { await agenciesCol(db).deleteOne({ _id: id }); throw e; } // never leave an agency nobody owns
  return { id, slug };
}
