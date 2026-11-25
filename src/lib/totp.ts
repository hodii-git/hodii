/** Time-based one-time codes (RFC 6238) for authenticator apps: 6 digits, 30 seconds, HMAC-SHA1. Uses only Web Crypto. */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP = 30;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of clean) { value = (value << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Uint8Array.from(out);
}

export const generateTotpSecret = () => base32Encode(crypto.getRandomValues(new Uint8Array(20)));

async function hotp(secret: string, counter: number, digits = 6): Promise<string> {
  const key = await crypto.subtle.importKey("raw", base32Decode(secret) as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new ArrayBuffer(8);
  const view = new DataView(msg);
  view.setUint32(0, Math.floor(counter / 2 ** 32)); view.setUint32(4, counter >>> 0);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = h[h.length - 1]! & 15;
  const bin = ((h[o]! & 127) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const totpStep = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / TOTP_STEP);
export const totpAt = (secret: string, step: number, digits = 6) => hotp(secret, step, digits);

/**
 * Checks a code against the current 30-second step and one either side (clock drift). Returns the step that matched, or null.
 * The caller stores the step and refuses to accept it, or any earlier one, again.
 */
export async function verifyTotp(secret: string, code: string, nowMs = Date.now()): Promise<number | null> {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const now = totpStep(nowMs);
  for (const step of [now, now - 1, now + 1]) if ((await hotp(secret, step)) === clean) return step;
  return null;
}

export const otpauthUri = (secret: string, account: string, issuer: string) =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_STEP}`;
