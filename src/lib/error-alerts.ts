/** Pure helpers for error alerts: group like errors together, keep personal data out of what we store, and alert without flooding. */

/** Removes things that identify a person or open an account from a message or stack before it is stored or sent anywhere. */
export function redact(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:\+?254|0)[17]\d{8}\b/g, "[phone]")
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{10,}/gi, "[token]")
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, "[hash]")
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, "[database-url]");
}

/** Same bug, same fingerprint: built from the message with numbers and ids flattened, plus the first stack frame. */
export function fingerprint(message: string, stack: string | null | undefined): string {
  const flat = redact(message).replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "<id>").replace(/\d+/g, "<n>").slice(0, 160);
  const frame = (stack ?? "").split("\n").find((l) => /^\s*at\s/.test(l))?.replace(/\d+/g, "<n>").trim().slice(0, 160) ?? "";
  let h = 5381;
  for (const ch of `${flat}|${frame}`) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

export const ALERT_EVERY_MS = 60 * 60 * 1000;
/** Alert the first time a problem is seen, then at most once an hour while it keeps happening. */
export const shouldAlert = (lastAlertAt: Date | null | undefined, now = Date.now()) => !lastAlertAt || now - lastAlertAt.getTime() >= ALERT_EVERY_MS;
