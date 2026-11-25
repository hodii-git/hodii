import { createFileRoute } from "@tanstack/react-router";

/** Safaricom posts the result of an STK push here. The secret in the address is what proves the call is ours; the handler also re-checks the amount. */
export const Route = createFileRoute("/api/mpesa/callback/$secret")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const expected = process.env["DARAJA_CALLBACK_SECRET"]?.trim();
        const ok = !!expected && params.secret.length === expected.length && [...expected].every((c, i) => c === params.secret[i]);
        if (!ok) return new Response("Not found", { status: 404 });
        const body = await request.json().catch(() => null);
        try {
          const { withDb } = await import("@/lib/community.server");
          const { handleCallback } = await import("@/lib/payments.server");
          await withDb((db) => handleCallback(db, body));
        } catch (e) { console.error("mpesa callback", e); }
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
