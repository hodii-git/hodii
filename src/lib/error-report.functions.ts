import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Browser errors, reported by the error page. Public, so it is capped hard: 20 a minute for the whole site, small bodies only. */
let windowStart = 0, windowCount = 0;
export const reportBrowserError = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ message: z.string().max(300), stack: z.string().max(2000).nullable(), path: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const now = Date.now();
    if (now - windowStart > 60_000) { windowStart = now; windowCount = 0; }
    if (++windowCount > 20) return { ok: false as const };
    const { withDb } = await import("./community.server");
    const { recordError } = await import("./error-alerts.server");
    await withDb((db) => recordError(db, { source: "browser", message: data.message, stack: data.stack, path: data.path }));
    return { ok: true as const };
  });
