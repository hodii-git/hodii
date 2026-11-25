/**
 * Boost pricing. Pure, so it is tested without a database.
 *
 * A boost lifts one listing in search and puts it in the boosted strips for a number of days the agency chooses.
 * The price follows how much attention that spot is worth:
 *   daily rate (by how busy the county is) × value band (a luxury listing earns the agency more, a bedsitter less),
 *   then a discount for longer runs, rounded to the nearest KES 10, never below the minimum.
 * Rates, discounts and limits come from admin Settings (see settings-registry.ts); the numbers below are only the fallback shape.
 */
export type BoostConfig = { dailyHigh: number; dailyMid: number; dailyBase: number; minPrice: number; maxDays: number; defaultDays: number; discounts: { fromDays: number; pct: number }[] };

export const boostConfig = (v: Record<string, number | boolean>): BoostConfig => ({
  dailyHigh: Number(v["boost.dailyHigh"]), dailyMid: Number(v["boost.dailyMid"]), dailyBase: Number(v["boost.dailyBase"]), minPrice: Number(v["boost.minPriceKes"]),
  maxDays: Number(v["boost.maxDays"]), defaultDays: Number(v["boost.defaultDays"]),
  discounts: [{ fromDays: 14, pct: Number(v["boost.discount14"]) }, { fromDays: 30, pct: Number(v["boost.discount30"]) }, { fromDays: 90, pct: Number(v["boost.discount90"]) }],
});

/** Quick-pick lengths shown as buttons; any whole number of days up to the maximum can also be typed. */
export const BOOST_PRESETS = [7, 14, 30, 90, 180, 365] as const;

/** Busiest markets first. Everything else is the base rate. */
const HIGH_DEMAND = new Set([47, 1, 22]); // Nairobi, Mombasa, Kiambu
const MID_DEMAND = new Set([34, 16, 32, 42, 27, 31]); // Kajiado, Machakos, Nakuru, Kisumu, Uasin Gishu, Laikipia

export type PriceInput = { countyCode: number | null; listingType: "sale" | "rent" | "short_stay"; category: string; amountKes: number };

export function demandTier(countyCode: number | null) {
  if (countyCode !== null && HIGH_DEMAND.has(countyCode)) return "high" as const;
  if (countyCode !== null && MID_DEMAND.has(countyCode)) return "mid" as const;
  return "base" as const;
}

/** Cheaper listings pay less, expensive ones more. Rent and sale have their own bands because the amounts differ by a factor of a hundred. */
export function valueMultiplier(i: Pick<PriceInput, "listingType" | "amountKes">) {
  const a = i.amountKes;
  if (i.listingType === "sale") return a >= 50_000_000 ? 1.5 : a >= 15_000_000 ? 1.25 : a < 3_000_000 ? 0.8 : 1;
  if (i.listingType === "rent") return a >= 150_000 ? 1.5 : a >= 60_000 ? 1.25 : a < 15_000 ? 0.8 : 1;
  return a >= 15_000 ? 1.25 : a < 3_000 ? 0.8 : 1; // short stays are priced per night
}

export const roundTo10 = (n: number) => Math.round(n / 10) * 10;

export type Quote = { days: number; amountKes: number; perDayKes: number; discountPct: number; fullKes: number };

const dailyRate = (i: PriceInput, c: BoostConfig) => ({ high: c.dailyHigh, mid: c.dailyMid, base: c.dailyBase })[demandTier(i.countyCode)] * valueMultiplier(i);
const discountFor = (days: number, c: BoostConfig) => c.discounts.filter((d) => days >= d.fromDays).reduce((m, d) => Math.max(m, d.pct), 0);

/** The price of boosting this listing for `days`, or null when the length is not allowed. Never trust a price sent from the browser: call this again on the server. */
export function quoteBoost(i: PriceInput, days: number, c: BoostConfig): Quote | null {
  if (!Number.isInteger(days) || days < 1 || days > c.maxDays) return null;
  const full = dailyRate(i, c) * days;
  const pct = discountFor(days, c);
  const amountKes = Math.max(c.minPrice, roundTo10(full * (1 - pct / 100)));
  return { days, amountKes, perDayKes: Math.round(amountKes / days), discountPct: pct, fullKes: Math.max(c.minPrice, roundTo10(full)) };
}

export const quoteBoostPresets = (i: PriceInput, c: BoostConfig): Quote[] => BOOST_PRESETS.filter((d) => d <= c.maxDays).flatMap((d) => quoteBoost(i, d, c) ?? []);

/** Buying again while still boosted adds to the end of the current run rather than replacing it. */
export const extendedUntil = (current: Date | null, days: number, now = new Date()) => {
  const from = current && current.getTime() > now.getTime() ? current : now;
  return new Date(from.getTime() + days * 86_400_000);
};

/** Safaricom wants 2547XXXXXXXX or 2541XXXXXXXX. Accepts 07…, 01…, +254… and spaces. */
export function normalizeMpesaPhone(raw: string): string | null {
  const d = raw.replace(/[\s\-()]/g, "").replace(/^\+/, "");
  const m = /^(?:254|0)?([17]\d{8})$/.exec(d);
  return m ? `254${m[1]}` : null;
}
