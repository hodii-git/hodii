import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const pay = () => import("./payments.server");
const dash = () => import("./dashboard.server");
const auth = () => import("./auth.server");
const slugIn = z.string().min(1).max(120);
const idIn = z.string().min(1).max(64);

async function asMember<T>(slug: string, fn: (db: import("mongodb").Db, m: import("./dashboard.server").Member) => Promise<T>) {
  const { requireUser, authDb } = await auth();
  const { requireMember } = await dash();
  const me = await requireUser();
  return authDb(async (db) => fn(db, await requireMember(db, me, slug)));
}

export const getPromoteInfo = createServerFn({ method: "GET" }).inputValidator((d) => z.object({ slug: slugIn, id: idIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, async (db, m) => (await pay()).promoteInfo(db, m, data.id)));

export const startBoostPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: slugIn, id: idIn, days: z.number().int().min(1).max(730), phone: z.string().trim().min(9).max(20) }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, async (db, m) => (await pay()).startBoost(db, m, data)));

export const startPackagePayment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: slugIn, slots: z.number().int().min(1).max(2000), phone: z.string().trim().min(9).max(20), renewFrom: idIn.optional() }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, async (db, m) => (await pay()).startPackage(db, m, data)));

const pk = () => import("./packages.server");
export const getPackages = createServerFn({ method: "GET" }).inputValidator((d) => z.object({ slug: slugIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, async (db, m) => { const k = await pk(); await k.sweepPromotions(db, { agencyId: m.agencyId }).catch(() => undefined); return k.listPackages(db, m); }));

export const addListingsToPackage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: slugIn, packageId: idIn, ids: z.array(idIn).min(1).max(200) }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, async (db, m) => (await pk()).addToPackage(db, m, data.packageId, data.ids)));

export const removeListingFromPackage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: slugIn, packageId: idIn, listingId: idIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, async (db, m) => (await pk()).detachListing(db, m, data.packageId, data.listingId)));

export const getPaymentStatus = createServerFn({ method: "GET" }).inputValidator((d) => z.object({ slug: slugIn, paymentId: idIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, async (db, m) => (await pay()).paymentStatus(db, m, data.paymentId)));

/** The agency's Basic listing space: what it may have, what it uses, and the price of more. */
export const getListingSpace = createServerFn({ method: "GET" }).inputValidator((d) => z.object({ slug: slugIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, async (db, m) => {
    const { agencyUsage, enforceBasicLimits } = await import("./basic-space.server");
    await enforceBasicLimits(db, m.agencyId).catch(() => undefined);
    const p = await pay(), { can } = await import("./access"), { mpesaConfigured } = await import("./payments.server");
    return { usage: await agencyUsage(db, m.agencyId), quote: await p.spaceQuote(), paymentsEnabled: mpesaConfigured(), canBuy: can(m, "billing.manage") };
  }));

export const startSpacePayment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: slugIn, phone: z.string().trim().min(9).max(20) }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, async (db, m) => (await pay()).startSpacePack(db, m, data)));

/** The agency's own payments, newest first, for receipts. Only people who manage billing see them. */
export const getAgencyPayments = createServerFn({ method: "GET" }).inputValidator((d) => z.object({ slug: slugIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, async (db, m) => {
    const { can } = await import("./access");
    if (!can(m, "billing.manage")) throw new Error("Only people who manage billing can see payments.");
    const p = await pay();
    const rows = await p.listPayments(db, { agencyId: m.agencyId, status: { $in: ["paid", "refunded"] } }, 200);
    const agency = await db.collection("agencies").findOne({ _id: m.agencyId as never }, { projection: { name: 1 } });
    return { agencyName: String(agency?.["name"] ?? ""), rows };
  }));
