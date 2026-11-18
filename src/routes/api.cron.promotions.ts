import { createFileRoute } from "@tanstack/react-router";

/**
 * Sends "ends soon" and "ended" notices for boosts and Premium packages. Call it once an hour from any scheduler
 * (cron-job.org, GitHub Actions, the host's cron) with the header  Authorization: Bearer <CRON_SECRET>.
 * Agencies also get their own notices when they open their dashboard, so a missed run only delays other people's notices.
 */
export const Route = createFileRoute("/api/cron/promotions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["CRON_SECRET"]?.trim();
        const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        const ok = !!secret && given.length === secret.length && [...given].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ secret.charCodeAt(i)), 0) === 0;
        if (!ok) return new Response("Unauthorized", { status: 401 });
        const { withDb } = await import("@/lib/community.server");
        const { sweepPromotions } = await import("@/lib/packages.server");
        const r = await withDb((db) => sweepPromotions(db));
        return Response.json(r);
      },
    },
  },
});
