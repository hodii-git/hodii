import type { Db } from "mongodb";
import { getSettings } from "./settings.server";
import { keyPool, whoIsAsking, reserve, refund, usage, aiConfigured } from "./ai-search.server";
import { quotaState } from "./ai-quota";
import { classify } from "./key-pool";
import { MAX_AUDIO_BYTES, MIN_AUDIO_BYTES, base64Bytes, baseMime, cleanTranscript, extFor, voiceLimitFor } from "./voice";

// Server-only. Speech to text with Groq Whisper, inside each person's own voice allowance.

export type VoiceStatus = { enabled: boolean; limit: number; used: number; remaining: number; resetsAt: string | null; maxSeconds: number };
export type VoiceAnswer =
  | { ok: true; text: string; status: VoiceStatus }
  | { ok: false; reason: "off" | "quota" | "too_big" | "bad_audio" | "nothing" | "failed"; message: string; status: VoiceStatus };

const subjectOf = (s: string) => `v:${s}`;

export async function voiceStatus(db: Db): Promise<VoiceStatus> {
  const [v, who] = await Promise.all([getSettings(), whoIsAsking(db)]);
  const limit = voiceLimitFor(who.tier, v), windowHours = Number(v["ai.windowHours"]);
  const q = quotaState(await usage(db).findOne({ _id: subjectOf(who.subject) }), limit, windowHours);
  return { enabled: v["voice.enabled"] === true && aiConfigured(), limit, used: q.used, remaining: q.remaining, resetsAt: q.resetsAt ? q.resetsAt.toISOString() : null, maxSeconds: Number(v["voice.maxSeconds"]) };
}

/** One transcription call, rotating through the keys the same way AI search does. Throws on a transient failure so the caller can refund. */
async function whisper(bytes: Uint8Array, mime: string): Promise<string> {
  const p = keyPool(), tried = new Set<string>();
  for (;;) {
    const now = Date.now();
    const key = p.available(now).find((k) => !tried.has(k));
    if (!key) throw new Error("all keys are resting");
    tried.add(key);
    const form = new FormData();
    form.set("file", new Blob([bytes as BlobPart], { type: mime }), `voice.${extFor(mime)}`);
    form.set("model", process.env["GROQ_WHISPER_MODEL"] ?? "whisper-large-v3-turbo");
    form.set("language", "en");
    form.set("temperature", "0");
    form.set("response_format", "json");
    // A short hint keeps Kenyan place names from being spelled as ordinary words.
    form.set("prompt", "Property search in Kenya: Kilimani, Westlands, Kileleshwa, Karen, Nyali, Ruaka, Syokimau, bedroom, to rent, for sale.");
    let res: Response;
    try { res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(20_000) }); }
    catch { p.fail(key, "transient", now); continue; }
    if (res.ok) { p.used(key); return cleanTranscript(((await res.json()) as { text?: string }).text); }
    const kind = classify(res.status, await res.text().catch(() => "")) ?? "transient";
    p.fail(key, kind, now, Number(res.headers.get("retry-after")) || undefined);
    if (res.status === 400 || res.status === 413) throw Object.assign(new Error("bad audio"), { bad: true });
  }
}

export async function transcribe(db: Db, input: { audio: string; mime: string }): Promise<VoiceAnswer> {
  const v = await getSettings(), status = await voiceStatus(db);
  const fail = (reason: Extract<VoiceAnswer, { ok: false }>["reason"], message: string, s = status): VoiceAnswer => ({ ok: false, reason, message, status: s });
  if (!status.enabled) return fail("off", "Voice search is not available right now. You can type instead.");
  const mime = baseMime(input.mime);
  if (!mime) return fail("bad_audio", "This browser recorded in a format we cannot read. Please type your search.");
  const size = base64Bytes(input.audio);
  if (size > MAX_AUDIO_BYTES) return fail("too_big", "That recording is too long. Try a shorter one.");
  if (size < MIN_AUDIO_BYTES) return fail("nothing", "We did not hear anything. Hold the button and speak.");
  const who = await whoIsAsking(db);
  if (!(await reserve(db, subjectOf(who.subject), who.tier, voiceLimitFor(who.tier, v), Number(v["ai.windowHours"]) * 3_600_000))) return fail("quota", "You have used all your voice searches for now. You can still type.", await voiceStatus(db));
  try {
    const text = await whisper(Buffer.from(input.audio, "base64"), mime);
    if (!text) { await refund(db, subjectOf(who.subject)); return fail("nothing", "We did not catch that. Try again, a little closer to the microphone.", await voiceStatus(db)); }
    return { ok: true, text, status: await voiceStatus(db) };
  } catch (e) {
    await refund(db, subjectOf(who.subject)); // not served, not charged
    if ((e as { bad?: boolean }).bad) return fail("bad_audio", "We could not read that recording. Please try again or type.", await voiceStatus(db));
    console.error("transcribe", e);
    throw new Error("temporarily unavailable"); // transient: the browser retries
  }
}
