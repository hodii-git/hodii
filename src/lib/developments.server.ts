import type { Db, Document } from "mongodb";
import { z } from "zod";
import { agenciesById } from "./properties.server";
import { fail, type Member } from "./dashboard.server";
import { foreignNewPhotos } from "./images.server";
import { countyByCode, toSlug } from "./mongodb/kenya";
import { DEVELOPMENT_LIMITS, LISTING_LIMITS } from "./mongodb/limits";
import { developmentSchema, imageSchema } from "./mongodb/property-schemas";
import { DEVELOPMENT_STATUSES, PROPERTY_TYPE_KEYS, FEATURE_KEYS } from "./mongodb/taxonomy";

// Server-only. New developments and upcoming projects: public reads, and the agency's own create/edit/publish.

const col = (db: Db) => db.collection("developments");
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);
export const STATUS_LABEL: Record<string, string> = { planning: "Planning", off_plan: "Off-plan", under_construction: "Under construction", completed: "Completed" };

export type DevelopmentCard = {
  id: string; slug: string; name: string; status: string; areaName: string; county: string | null; priceFrom: number | null; priceTo: number | null; currency: string;
  completionDate: string | null; image: { url: string; thumbUrl: string | null; alt: string } | null; unitTypes: number;
  agency: { slug: string; name: string; verified: boolean } | null;
};
export type DevelopmentDetail = DevelopmentCard & {
  description: string; features: string[]; images: { url: string; thumbUrl: string | null; alt: string; width: number; height: number }[];
  unitTypeRows: { label: string; propertyType: string; bedrooms: number | null; priceFrom: number | null; unitsAvailable: number | null }[];
  brochureUrl: string | null; videoUrl: string | null; point: { lat: number; lng: number } | null;
};

function cardOf(d: Document, agencies: Map<string, Document>): DevelopmentCard {
  const loc = (d["location"] ?? {}) as Document, img = (Array.isArray(d["images"]) ? d["images"][0] : null) as Document | null;
  const a = agencies.get(str(d["agencyId"]));
  return {
    id: str(d["_id"]), slug: str(d["slug"]), name: str(d["name"]), status: str(d["status"]), areaName: str(loc["areaName"]), county: typeof loc["county"] === "string" ? loc["county"] : null,
    priceFrom: num(d["priceFrom"]), priceTo: num(d["priceTo"]), currency: str(d["currency"], "KES"), completionDate: iso(d["completionDate"]),
    image: img ? { url: str(img["url"]), thumbUrl: typeof img["thumbUrl"] === "string" ? img["thumbUrl"] : null, alt: str(img["alt"]) } : null,
    unitTypes: Array.isArray(d["unitTypes"]) ? d["unitTypes"].length : 0,
    agency: a ? { slug: str(a["slug"]), name: str(a["name"]), verified: ((a["verification"] as Document | undefined)?.["status"]) === "verified" } : null,
  };
}

/** Only projects from active agencies are public, so a suspended agency's projects disappear with it. */
async function activeAgencyIds(db: Db) { return (await db.collection("agencies").find({ status: "active" }, { projection: { _id: 1 } }).toArray()).map((a) => String(a["_id"])); }

export const developmentSearch = z.object({
  q: z.string().trim().max(80).optional(), status: z.enum(["upcoming", ...DEVELOPMENT_STATUSES]).optional(), countyCode: z.number().int().min(1).max(47).optional(),
  page: z.number().int().min(1).max(100).default(1),
});

export async function listDevelopments(db: Db, p: z.infer<typeof developmentSearch>) {
  const f: Document = { publishStatus: "published", agencyId: { $in: await activeAgencyIds(db) } };
  if (p.status === "upcoming") f["status"] = { $in: ["planning", "off_plan", "under_construction"] }; else if (p.status) f["status"] = p.status;
  if (p.countyCode) f["location.countyCode"] = p.countyCode;
  if (p.q) { const rx = { $regex: p.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" }; f["$or"] = [{ name: rx }, { "location.areaName": rx }, { "location.county": rx }, { description: rx }]; }
  const size = 24;
  const [rows, total] = await Promise.all([
    col(db).find(f, { projection: { description: 0 } }).sort({ publishedAt: -1, _id: 1 }).skip((p.page - 1) * size).limit(size).toArray(),
    col(db).countDocuments(f),
  ]);
  const agencies = await agenciesById(db, rows.map((r) => str(r["agencyId"])));
  return { items: rows.map((r) => cardOf(r, agencies)), total, pages: Math.max(1, Math.ceil(total / size)) };
}

export async function getDevelopment(db: Db, slug: string): Promise<DevelopmentDetail | null> {
  const d = await col(db).findOne({ slug, publishStatus: "published" });
  if (!d) return null;
  const agencies = await agenciesById(db, [str(d["agencyId"])]);
  if (agencies.get(str(d["agencyId"]))?.["status"] !== "active") return null;
  void col(db).updateOne({ _id: d["_id"] }, { $inc: { "stats.views": 1 } }).catch(() => undefined);
  const loc = (d["location"] ?? {}) as Document, pt = (loc["point"] as Document | undefined)?.["coordinates"] as number[] | undefined;
  return {
    ...cardOf(d, agencies), description: str(d["description"]), features: Array.isArray(d["features"]) ? d["features"].map(String) : [],
    images: (Array.isArray(d["images"]) ? d["images"] : []).map((i: Document) => ({ url: str(i["url"]), thumbUrl: typeof i["thumbUrl"] === "string" ? i["thumbUrl"] : null, alt: str(i["alt"]), width: Number(i["width"]) || 1200, height: Number(i["height"]) || 800 })),
    unitTypeRows: (Array.isArray(d["unitTypes"]) ? d["unitTypes"] : []).map((u: Document) => ({ label: str(u["label"]), propertyType: str(u["propertyType"]), bedrooms: num(u["bedrooms"]), priceFrom: num(u["priceFrom"]), unitsAvailable: num(u["unitsAvailable"]) })),
    brochureUrl: typeof d["brochureUrl"] === "string" ? d["brochureUrl"] : null, videoUrl: typeof d["videoUrl"] === "string" ? d["videoUrl"] : null,
    point: pt && !loc["hideExactLocation"] ? { lat: pt[1]!, lng: pt[0]! } : null,
  };
}

/* ───────────────────────────── Agency side ───────────────────────────── */

const looseImage = imageSchema.innerType().omit({ order: true });
export const developmentInput = z.object({
  id: z.string().max(64).nullable(),
  name: z.string().trim().min(DEVELOPMENT_LIMITS.nameMin).max(DEVELOPMENT_LIMITS.nameMax),
  description: z.string().trim().max(DEVELOPMENT_LIMITS.descriptionMax),
  status: z.enum(DEVELOPMENT_STATUSES),
  countyCode: z.number().int().min(1).max(47), areaName: z.string().trim().min(2).max(LISTING_LIMITS.areaNameMax),
  point: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  completionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  currency: z.enum(["KES", "USD"]), priceFrom: z.number().int().min(1).nullable(), priceTo: z.number().int().min(1).nullable(),
  unitTypes: z.array(z.object({ label: z.string().trim().min(1).max(60), propertyType: z.enum(PROPERTY_TYPE_KEYS), bedrooms: z.number().int().min(0).max(LISTING_LIMITS.bedroomsMax).nullable(), priceFrom: z.number().int().min(1).nullable(), unitsAvailable: z.number().int().min(0).nullable() }).strict()).max(DEVELOPMENT_LIMITS.unitTypesMax),
  features: z.array(z.enum(FEATURE_KEYS)).max(LISTING_LIMITS.featuresMax),
  images: z.array(looseImage).max(DEVELOPMENT_LIMITS.imagesMax),
  brochureUrl: z.string().max(500).regex(/^https:\/\//).nullable(), videoUrl: z.string().max(500).regex(/^https:\/\//).nullable(),
  publish: z.boolean(),
}).strict();
export type DevelopmentInput = z.infer<typeof developmentInput>;

export async function listAgencyDevelopments(db: Db, m: Member) {
  const rows = await col(db).find({ agencyId: m.agencyId }, { projection: { description: 0 } }).sort({ updatedAt: -1 }).limit(100).toArray();
  const agencies = await agenciesById(db, [m.agencyId]);
  return rows.map((r) => ({ ...cardOf(r, agencies), publishStatus: str(r["publishStatus"]), views: Number((r["stats"] as Document | undefined)?.["views"]) || 0 }));
}

export async function loadDevelopmentForEdit(db: Db, m: Member, id: string): Promise<DevelopmentInput> {
  const d = await col(db).findOne({ _id: id as never, agencyId: m.agencyId });
  if (!d) return fail("Development not found");
  const loc = (d["location"] ?? {}) as Document, c = (loc["point"] as Document | undefined)?.["coordinates"] as number[] | undefined;
  return {
    id, name: str(d["name"]), description: str(d["description"]), status: d["status"] as never, countyCode: Number(loc["countyCode"]) || 47, areaName: str(loc["areaName"]),
    point: c ? { lat: c[1]!, lng: c[0]! } : null, completionDate: d["completionDate"] instanceof Date ? d["completionDate"].toISOString().slice(0, 10) : null,
    currency: str(d["currency"], "KES") as never, priceFrom: num(d["priceFrom"]), priceTo: num(d["priceTo"]),
    unitTypes: (Array.isArray(d["unitTypes"]) ? d["unitTypes"] : []) as never, features: (Array.isArray(d["features"]) ? d["features"] : []) as never,
    images: (Array.isArray(d["images"]) ? d["images"] : []).map(({ order: _o, ...i }: Document) => i) as never,
    brochureUrl: typeof d["brochureUrl"] === "string" ? d["brochureUrl"] : null, videoUrl: typeof d["videoUrl"] === "string" ? d["videoUrl"] : null,
    publish: d["publishStatus"] === "published",
  };
}

export async function saveDevelopment(db: Db, m: Member, input: DevelopmentInput) {
  const existing = input.id ? await col(db).findOne({ _id: input.id as never, agencyId: m.agencyId }) : null;
  if (input.id && !existing) return fail("Development not found");
  const bad = foreignNewPhotos(input.images, (Array.isArray(existing?.["images"]) ? existing!["images"] : []) as { url: string }[], m.agencyId);
  if (bad.length) return fail("Some photos were not uploaded through Hodii. Please upload them again.");
  if (input.publish) {
    if (input.description.length < DEVELOPMENT_LIMITS.descriptionMin) return fail(`Describe the project in at least ${DEVELOPMENT_LIMITS.descriptionMin} characters before publishing.`);
    if (input.images.length < DEVELOPMENT_LIMITS.imagesMin) return fail("Add at least one photo or render before publishing.");
  }
  if (input.priceFrom && input.priceTo && input.priceFrom > input.priceTo) return fail("The highest price cannot be below the lowest.");
  const now = new Date(), county = countyByCode(input.countyCode);
  const id = existing ? String(existing["_id"]) : crypto.randomUUID();
  const doc = {
    _id: id, schemaVersion: 1 as const, slug: existing ? str(existing["slug"]) : `${toSlug(input.name).slice(0, 60)}-${id.slice(0, 5)}`, agencyId: m.agencyId, createdBy: existing ? str(existing["createdBy"]) : m.userId,
    name: input.name, description: input.description, status: input.status, publishStatus: input.publish ? "published" : "draft",
    location: { countyCode: county?.code ?? null, county: county?.name ?? null, countySlug: county?.slug ?? null, subCounty: null, areaName: input.areaName, areaSlug: toSlug(input.areaName) || null, address: null, landmark: null,
      ...(input.point ? { point: { type: "Point" as const, coordinates: [input.point.lng, input.point.lat] } } : {}), hideExactLocation: false },
    completionDate: input.completionDate ? new Date(`${input.completionDate}T00:00:00Z`) : null, priceFrom: input.priceFrom, priceTo: input.priceTo, currency: input.currency,
    unitTypes: input.unitTypes, features: input.features, images: input.images.map((i, order) => ({ ...i, order })), brochureUrl: input.brochureUrl, videoUrl: input.videoUrl,
    stats: (existing?.["stats"] as { views: number; enquiries: number } | undefined) ?? { views: 0, enquiries: 0 },
    createdAt: existing ? (existing["createdAt"] as Date) : now, updatedAt: now,
    publishedAt: input.publish ? ((existing?.["publishedAt"] as Date | null | undefined) ?? now) : (existing?.["publishedAt"] as Date | null | undefined) ?? null,
  };
  const parsed = developmentSchema.safeParse(doc);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the details.");
  await col(db).replaceOne({ _id: id as never }, parsed.data as never, { upsert: true });
  return { id, slug: doc.slug };
}

export async function deleteDevelopment(db: Db, m: Member, id: string) {
  const r = await col(db).deleteOne({ _id: id as never, agencyId: m.agencyId });
  if (!r.deletedCount) return fail("Development not found");
  return { ok: true as const };
}
