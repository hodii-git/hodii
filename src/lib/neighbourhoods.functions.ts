import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { reviewInput } from "./neighbourhood";

const nb = () => import("./neighbourhoods.server");
const cm = () => import("./community.server");
const auth = () => import("./auth.server");
const key = z.string().regex(/^[a-z0-9-]{2,60}\/[a-z0-9-]{2,80}$/);
const input = <T extends z.ZodTypeAny>(s: T) => (d: unknown) => s.parse(d) as z.infer<T>;

export const searchNeighbourhoods = createServerFn({ method: "GET" })
  .inputValidator(async (d) => (await nb()).nbSearch.parse(d))
  .handler(async ({ data }) => (await cm()).withDb(async (db) => (await nb()).listNeighbourhoods(db, data)));
export const neighbourhoodsQuery = (p: Record<string, unknown>) => queryOptions({ queryKey: ["neighbourhoods", p], queryFn: () => searchNeighbourhoods({ data: p as never }) });

export const getNeighbourhoodPage = createServerFn({ method: "GET" }).inputValidator(input(z.object({ key })))
  .handler(async ({ data }) => (await cm()).withDb(async (db) => (await nb()).getNeighbourhood(db, data.key)));
export const neighbourhoodQuery = (k: string) => queryOptions({ queryKey: ["neighbourhood", k], queryFn: () => getNeighbourhoodPage({ data: { key: k } }) });

export const compareAreas = createServerFn({ method: "GET" }).inputValidator(input(z.object({ keys: z.array(key).min(1).max(3) })))
  .handler(async ({ data }) => (await cm()).withDb(async (db) => (await nb()).compareNeighbourhoods(db, data.keys)));

export const getNeighbourhoodPosts = createServerFn({ method: "GET" }).inputValidator(input(z.object({ key })))
  .handler(async ({ data }) => (await cm()).withDb(async (db) => (await nb()).listPosts(db, data.key)));
export const postsQuery = (k: string) => queryOptions({ queryKey: ["neighbourhood", k, "posts"], queryFn: () => getNeighbourhoodPosts({ data: { key: k } }), refetchInterval: 20_000 });

/** What the signed-in person has here. Signed-out people get nothing rather than an error. */
export const getMyNeighbourhoodState = createServerFn({ method: "GET" }).inputValidator(input(z.object({ key })))
  .handler(async ({ data }) => {
    const me = await (await auth()).currentUser().catch(() => null);
    if (!me) return null;
    return (await cm()).withDb(async (db) => { const s = await nb(); return { review: await s.myReview(db, me.id, data.key), postIds: await s.myPostIds(db, me.id, data.key) }; });
  });
export const myStateQuery = (k: string) => queryOptions({ queryKey: ["neighbourhood", k, "me"], queryFn: () => getMyNeighbourhoodState({ data: { key: k } }) });

const member = async () => (await auth()).requireUser();
export const saveNeighbourhoodReview = createServerFn({ method: "POST" }).inputValidator(input(reviewInput))
  .handler(async ({ data }) => { const me = await member(); return (await cm()).withDb((db) => nb().then((s) => s.saveReview(db, me.id, data))); });
export const deleteNeighbourhoodReview = createServerFn({ method: "POST" }).inputValidator(input(z.object({ key })))
  .handler(async ({ data }) => { const me = await member(); return (await cm()).withDb((db) => nb().then((s) => s.deleteMyReview(db, me.id, data.key))); });
export const postToNeighbourhood = createServerFn({ method: "POST" })
  .inputValidator(input(z.object({ key, text: z.string().trim().min(1, "Write something before posting").max(600), parentId: z.string().max(64).nullable() })))
  .handler(async ({ data }) => { const me = await member(); return (await cm()).withDb((db) => nb().then((s) => s.addPost(db, me.id, data.key, data.text, data.parentId))); });
export const removeNeighbourhoodPost = createServerFn({ method: "POST" }).inputValidator(input(z.object({ id: z.string().max(64) })))
  .handler(async ({ data }) => { const me = await member(); return (await cm()).withDb((db) => nb().then((s) => s.removePost(db, me.id, data.id))); });
