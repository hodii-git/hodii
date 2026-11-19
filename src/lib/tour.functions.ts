import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const auth = () => import("./auth.server");
const tourId = z.string().regex(/^[a-z-]{2,30}$/);
const stateIn = z.object({ tour: tourId, status: z.enum(["new", "running", "paused", "snoozed", "dismissed", "done"]), step: z.number().int().min(0).max(50), until: z.number().int().min(0), snoozes: z.number().int().min(0).max(10), at: z.number().int().min(0).optional() });

/** The signed-in person's saved tour progress, or null if they have none yet. */
export const getTourProgress = createServerFn({ method: "POST" }) // POST so no browser or CDN ever serves an old answer
  .inputValidator((d) => z.object({ tour: tourId }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, authDb } = await auth();
    const me = await requireUser();
    return authDb(async (db) => {
      const r = await db.collection("tourProgress").findOne({ userId: me.id, tour: data.tour });
      return r ? { status: r["status"] as string, step: r["step"] as number, until: r["until"] as number, snoozes: r["snoozes"] as number, at: r["updatedAt"] instanceof Date ? r["updatedAt"].getTime() : 0 } : null;
    });
  });

export const saveTourProgress = createServerFn({ method: "POST" })
  .inputValidator((d) => stateIn.parse(d))
  .handler(async ({ data }) => {
    const { requireUser, authDb } = await auth();
    const me = await requireUser();
    const { tour, at, ...s } = data;
    await authDb((db) => db.collection("tourProgress").updateOne({ _id: `${me.id}:${tour}` as never }, { $set: { ...s, updatedAt: new Date(Math.min(at ?? Date.now(), Date.now())) }, $setOnInsert: { schemaVersion: 1, userId: me.id, tour } }, { upsert: true }));
    return { ok: true as const };
  });
