import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

const fb = () => import("./feedback.server");

/** Open to everyone. Signed-in people are linked to their account; the network address is kept only as a hash for the rate limit. */
export const sendFeedback = createServerFn({ method: "POST" })
  .inputValidator(async (d) => (await fb()).feedbackInput.parse(d))
  .handler(async ({ data }) => {
    const { withDb } = await import("./community.server");
    const { currentUser } = await import("./auth.server");
    const { hashIp } = await import("./properties.server");
    const me = await currentUser().catch(() => null);
    const ipHash = await hashIp("feedback");
    const s = await fb();
    try {
      return await withDb((db) => s.submitFeedback(db, data, { userId: me?.id ?? null, ipHash, userAgent: getRequestHeader("user-agent") ?? null, email: me?.email ?? null }));
    } catch (e) {
      if (e instanceof s.FeedbackError) return { ok: false as const, error: e.message };
      throw e;
    }
  });
