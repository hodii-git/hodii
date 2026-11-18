import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const db = () => import("./community.server");
const ai = () => import("./ai-search.server");

const criteriaIn = z.record(z.string(), z.unknown()).optional();

/** The person's AI search allowance and when it comes back. Safe to call for visitors. */
export const getAiStatus = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { withDb } = await db();
    const { aiStatus } = await ai();
    const s = await withDb((d) => aiStatus(d));
    return { ...s, resetsAt: s.resetsAt ? s.resetsAt.toISOString() : null };
  } catch (e) { console.error("getAiStatus", e); return null; }
});

/** Understands a typed request. A follow-up sends the filters it already has plus the last few turns. */
export const aiSearch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    text: z.string().trim().min(2).max(400), current: criteriaIn,
    history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(400) })).max(8).default([]),
  }).parse(d))
  .handler(async ({ data }) => {
    const { withDb } = await db();
    const { aiSearch: run } = await ai();
    const { cleanCriteria } = await import("./ai-criteria");
    const out = await withDb((d) => run(d, { text: data.text, current: cleanCriteria(data.current), history: data.history }));
    const status = { ...out.status, resetsAt: out.status.resetsAt ? out.status.resetsAt.toISOString() : null };
    return out.ok ? { ...out, status } : { ...out, status };
  });
