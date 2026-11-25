import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Place suggestions for the search box. Never throws: no suggestions is a normal answer. */
export const suggestPlaces = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().trim().min(2).max(60) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { suggestPlaces: run } = await import("./places.server");
      const { withDb } = await import("./community.server");
      return await withDb((db) => run(db, data.q)).catch(() => run(null, data.q));
    } catch (e) { console.error("suggestPlaces", e); return []; }
  });
