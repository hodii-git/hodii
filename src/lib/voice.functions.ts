import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

const db = () => import("./community.server");
const vs = () => import("./voice.server");

export const getVoiceStatus = createServerFn({ method: "GET" }).handler(async () => {
  try { const { withDb } = await db(); const { voiceStatus } = await vs(); return await withDb((d) => voiceStatus(d)); }
  catch (e) { console.error("getVoiceStatus", e); return null; }
});
export const voiceStatusQuery = queryOptions({ queryKey: ["voice-status"], queryFn: () => getVoiceStatus(), staleTime: 60_000 });

/** Audio travels as base64 text; the server checks kind and size before spending anything. */
export const transcribeVoice = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ audio: z.string().min(100).max(2_100_000).regex(/^[A-Za-z0-9+/]+={0,2}$/), mime: z.string().max(80) }).parse(d))
  .handler(async ({ data }) => { const { withDb } = await db(); const { transcribe } = await vs(); return withDb((d) => transcribe(d, data)); });
