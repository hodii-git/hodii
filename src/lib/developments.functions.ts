import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { DevelopmentInput } from "./developments.server";

const dev = createServerOnlyFn(() => import("./developments.server"));
const dash = createServerOnlyFn(() => import("./dashboard.server"));
const auth = createServerOnlyFn(() => import("./auth.server"));
const slugIn = z.string().min(1).max(120);

async function asMember<T>(slug: string, fn: (db: import("mongodb").Db, m: import("./dashboard.server").Member) => Promise<T>) {
  const { requireUser, authDb } = await auth(); const { requireMember } = await dash();
  const me = await requireUser();
  return authDb(async (db) => fn(db, await requireMember(db, me, slug, "development.manage")));
}

export const searchDevelopments = createServerFn({ method: "GET" })
  .inputValidator((d) => d as Record<string, unknown>)
  .handler(async ({ data }) => { const m = await dev(); const p = m.developmentSearch.parse(data); const { withDb } = await import("./community.server"); return withDb((db) => m.listDevelopments(db, p)); });
export const developmentsQuery = (p: z.input<Awaited<ReturnType<typeof dev>>["developmentSearch"]>) => queryOptions({ queryKey: ["developments", p], queryFn: () => searchDevelopments({ data: p as never }) });

export const getPublicDevelopment = createServerFn({ method: "GET" }).inputValidator((d) => z.object({ slug: slugIn }).parse(d))
  .handler(async ({ data }) => { const { withDb } = await import("./community.server"); return withDb((db) => dev().then((m) => m.getDevelopment(db, data.slug))); });

export const getAgencyDevelopments = createServerFn({ method: "GET" }).inputValidator((d) => z.object({ slug: slugIn }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, async (db, m) => (await dev()).listAgencyDevelopments(db, m)));
export const getDevelopmentForEdit = createServerFn({ method: "GET" }).inputValidator((d) => z.object({ slug: slugIn, id: z.string().max(64) }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, async (db, m) => (await dev()).loadDevelopmentForEdit(db, m, data.id)));
export const saveAgencyDevelopment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: slugIn, dev: z.unknown() }).parse(d))
  .handler(async ({ data }) => { const mod = await dev(); const input = mod.developmentInput.parse(data.dev) as DevelopmentInput; return asMember(data.slug, async (db, m) => mod.saveDevelopment(db, m, input)); });
export const deleteAgencyDevelopment = createServerFn({ method: "POST" }).inputValidator((d) => z.object({ slug: slugIn, id: z.string().max(64) }).parse(d))
  .handler(async ({ data }) => asMember(data.slug, async (db, m) => (await dev()).deleteDevelopment(db, m, data.id)));
