import { LISTING_LIMITS } from "./mongodb/limits";

/** Rules for acting on many listings at once. Pure, so they are tested without a database. */
export const MAX_BULK = 100;

/** What a person must type before something is deleted. One listing: its reference code. Several: DELETE and the number. */
export const deletePhrase = (count: number, referenceCode?: string) => (count === 1 && referenceCode ? referenceCode : `DELETE ${count}`);
export const phraseMatches = (typed: string, expected: string) => typed.trim().toUpperCase() === expected.toUpperCase();

export const PERCENT_MIN = -50, PERCENT_MAX = 100;

/** New price after a percentage change. Rounded to the nearest 100 for amounts of 1,000 and more so prices stay tidy. */
export function adjustAmount(amount: number, percent: number): number | null {
  if (!Number.isFinite(percent) || percent < PERCENT_MIN || percent > PERCENT_MAX || percent === 0) return null;
  const raw = amount * (1 + percent / 100);
  const next = amount >= 1000 ? Math.round(raw / 100) * 100 : Math.round(raw);
  return next >= LISTING_LIMITS.priceMin && next <= LISTING_LIMITS.priceMax ? next : null;
}
