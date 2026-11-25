/**
 * Account recovery codes. Hodii sends no email, so each account gets one-time codes at sign-up that can reset a forgotten password.
 * 12 characters from a 32-letter alphabet is 60 bits, so the codes are stored as plain SHA-256 digests.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I
export const RECOVERY_CODE_COUNT = 8;
export const TERMS_VERSION = "2026-11";

export function generateRecoveryCode(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = rand(12);
  const chars = Array.from(bytes, (b) => ALPHABET[b % 32]!).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export const generateRecoveryCodes = (n = RECOVERY_CODE_COUNT) => Array.from({ length: n }, () => generateRecoveryCode());

/** Accepts lower case, spaces and missing dashes. Returns the canonical form, or null if it cannot be a code. */
export function normalizeRecoveryCode(raw: string): string | null {
  const clean = raw.toUpperCase().replace(/[^A-Z2-9]/g, "");
  return clean.length === 12 ? `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}` : null;
}
