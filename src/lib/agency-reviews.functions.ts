import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { AGENCY_LIMITS } from "./mongodb/limits";

const rev = () => import("./agency-reviews.server");
const auth = () => import("./auth.server");
const slugIn = z.string().min(1).max(120);

async function agencyIdOf(db: import("mongodb").Db, slug: string) {
  const a = await db.collection("agencies").findOne({ slug, status: "active" }, { projection: { _id: 1 } });
  if (!a) throw new Error("Agency not found");
  return String(a["_id"]);
}

export const getAgencyReviews = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: slugIn }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, currentUser } = await auth();
    const me = await currentUser().catch(() => null);
    return authDb(async (db) => (await rev()).loadReviews(db, await agencyIdOf(db, data.slug), me?.id ?? null));
  });
export const agencyReviewsQuery = (slug: string) => queryOptions({ queryKey: ["agency-reviews", slug], queryFn: () => getAgencyReviews({ data: { slug } }) });

export const submitAgencyReview = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: slugIn, rating: z.number().int().min(1).max(5), body: z.string().trim().min(10, "Write at least a sentence").max(AGENCY_LIMITS.reviewBodyMax) }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, requireUser } = await auth();
    const me = await requireUser();
    return authDb(async (db) => (await rev()).saveReview(db, me, await agencyIdOf(db, data.slug), data));
  });

export const deleteMyAgencyReview = createServerFn({ method: "POST" }).inputValidator((d) => z.object({ id: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => { const { authDb, requireUser } = await auth(); const me = await requireUser(); return authDb(async (db) => (await rev()).deleteReview(db, me.id, data.id)); });

export const reportAgencyReview = createServerFn({ method: "POST" }).inputValidator((d) => z.object({ id: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => { const { authDb, requireUser } = await auth(); const me = await requireUser(); return authDb(async (db) => (await rev()).reportReview(db, me.id, data.id)); });

export const replyToAgencyReview = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: slugIn, id: z.string().min(1).max(64), body: z.string().trim().min(1).max(AGENCY_LIMITS.reviewBodyMax) }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, requireUser } = await auth();
    const { requireMember } = await import("./dashboard.server");
    const me = await requireUser();
    return authDb(async (db) => { const m = await requireMember(db, me, data.slug, "agency.edit"); return (await rev()).replyToReview(db, m.agencyId, me.id, data.id, data.body); });
  });
