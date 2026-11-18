/** Voice search rules as pure functions, so they are tested. The Groq call lives in voice.server.ts. */
import type { Tier } from "./ai-quota";

export const VOICE_MIMES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-m4a"] as const;
/** A 60 second Opus clip is well under this; it also keeps a request small enough for a phone on a poor connection. */
export const MAX_AUDIO_BYTES = 1_500_000;
export const MIN_AUDIO_BYTES = 1_000;

export const voiceLimitFor = (tier: Tier, v: Record<string, number | boolean>): number =>
  Number(v[tier === "guest" ? "voice.guestLimit" : tier === "user" ? "voice.userLimit" : tier === "agency" ? "voice.agencyLimit" : "voice.premiumLimit"]);

/** "audio/webm;codecs=opus" -> "audio/webm", or null when we do not accept the kind. */
export function baseMime(m: string): string | null {
  const b = m.split(";")[0]!.trim().toLowerCase();
  return (VOICE_MIMES as readonly string[]).includes(b) ? b : null;
}
export const extFor = (mime: string) => ({ "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-m4a": "m4a" } as Record<string, string>)[mime] ?? "webm";

/** Size of the decoded audio from its base64 text, without decoding it. */
export const base64Bytes = (b64: string) => Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);

/** Whisper sometimes returns filler for silence; treat those as "heard nothing". */
export function cleanTranscript(t: unknown): string {
  const s = (typeof t === "string" ? t : "").replace(/\s+/g, " ").trim().slice(0, 400);
  if (s.length < 2) return "";
  if (/^(thanks? for watching[.!]*|thank you[.!]*|you[.!]*|\.+|bye[.!]*)$/i.test(s)) return "";
  return s;
}
