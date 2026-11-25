/**
 * Every number the business may want to change without a release: prices, limits, quotas and ranking weights.
 * Defaults live here; the admin Settings tab stores overrides in `appSettings`. Pure, so the rules are tested.
 */
export type SettingDef = { key: string; group: string; label: string; help?: string; type: "int" | "float" | "bool"; default: number | boolean; min?: number; max?: number; unit?: string };

export const SETTING_GROUPS = ["Boosting a single listing", "Premium packages", "Basic listings", "Staff review", "AI search", "Search ranking", "Safety limits"] as const;

export const SETTINGS: readonly SettingDef[] = [
  // Boosting: priced per day, from the county's demand and the listing's value (see pricing.ts).
  { key: "boost.defaultDays", group: "Boosting a single listing", label: "Default boost length", type: "int", default: 7, min: 1, max: 365, unit: "days" },
  { key: "boost.maxDays", group: "Boosting a single listing", label: "Longest boost", type: "int", default: 365, min: 1, max: 730, unit: "days" },
  { key: "boost.dailyHigh", group: "Boosting a single listing", label: "Daily rate, busiest counties", help: "Nairobi, Mombasa, Kiambu.", type: "int", default: 60, min: 1, max: 100000, unit: "KES/day" },
  { key: "boost.dailyMid", group: "Boosting a single listing", label: "Daily rate, busy counties", type: "int", default: 40, min: 1, max: 100000, unit: "KES/day" },
  { key: "boost.dailyBase", group: "Boosting a single listing", label: "Daily rate, other counties", type: "int", default: 25, min: 1, max: 100000, unit: "KES/day" },
  { key: "boost.minPriceKes", group: "Boosting a single listing", label: "Lowest boost price", type: "int", default: 100, min: 1, max: 100000, unit: "KES" },
  { key: "boost.discount14", group: "Boosting a single listing", label: "Discount from 14 days", type: "float", default: 10, min: 0, max: 90, unit: "%" },
  { key: "boost.discount30", group: "Boosting a single listing", label: "Discount from 30 days", type: "float", default: 25, min: 0, max: 90, unit: "%" },
  { key: "boost.discount90", group: "Boosting a single listing", label: "Discount from 90 days", type: "float", default: 40, min: 0, max: 90, unit: "%" },
  // Premium: one tier, bought as packages.
  { key: "premium.priceKes", group: "Premium packages", label: "Package price", type: "int", default: 15000, min: 1, max: 10_000_000, unit: "KES" },
  { key: "premium.days", group: "Premium packages", label: "Package length", type: "int", default: 30, min: 1, max: 365, unit: "days" },
  { key: "premium.slots", group: "Premium packages", label: "Listings per package", type: "int", default: 10, min: 1, max: 1000, unit: "listings" },
  { key: "premium.extraSlotKes", group: "Premium packages", label: "Price of each extra listing slot", help: "Charged on top of the package price when an agency picks more than the default slots.", type: "int", default: 1000, min: 0, max: 1_000_000, unit: "KES" },
  { key: "premium.maxSlots", group: "Premium packages", label: "Most slots in one package", type: "int", default: 200, min: 1, max: 2000, unit: "listings" },
  { key: "premium.renewalNoticeDays", group: "Premium packages", label: "Warn this many days before a package or boost ends", type: "int", default: 3, min: 1, max: 30, unit: "days" },
  // Basic (free) listings: capped per agency; Boosted and Premium listings are never counted.
  { key: "basic.maxLive", group: "Basic listings", label: "Live Basic listings per agency", help: "Boosted and Premium listings do not count towards this.", type: "int", default: 10, min: 0, max: 10000, unit: "listings" },
  { key: "basic.maxStored", group: "Basic listings", label: "Basic listings an agency may keep in total", help: "Counts drafts, paused, frozen and live Basic listings. This is what limits storage (photos).", type: "int", default: 40, min: 0, max: 50000, unit: "listings" },
  { key: "basic.graceDays", group: "Basic listings", label: "Grace after a boost or package ends", help: "Listings that lose their paid status stay visible as Basic this long before any are frozen for being over the limit. 0 freezes at once.", type: "int", default: 3, min: 0, max: 30, unit: "days" },
  { key: "space.priceKes", group: "Basic listings", label: "Price of an extra-space pack", type: "int", default: 1500, min: 0, max: 1_000_000, unit: "KES" },
  { key: "space.slots", group: "Basic listings", label: "Extra Basic listings in a pack", type: "int", default: 10, min: 1, max: 1000, unit: "listings" },
  { key: "space.days", group: "Basic listings", label: "Length of an extra-space pack", type: "int", default: 30, min: 1, max: 365, unit: "days" },
  // Staff review targets (shown as "overdue" in the admin queues).
  { key: "review.verifySlaHours", group: "Staff review", label: "Agency verification target", help: "A request waiting longer than this shows as overdue. 0 turns the flag off.", type: "int", default: 48, min: 0, max: 720, unit: "hours" },
  { key: "review.reportSlaHours", group: "Staff review", label: "Listing report target", type: "int", default: 24, min: 0, max: 720, unit: "hours" },
  // AI search quotas
  { key: "ai.enabled", group: "AI search", label: "AI search on", type: "bool", default: true },
  { key: "ai.windowHours", group: "AI search", label: "Quota refills every", help: "Each person's counter restarts this long after their first AI search.", type: "int", default: 24, min: 1, max: 720, unit: "hours" },
  { key: "ai.guestLimit", group: "AI search", label: "Searches for visitors not signed in", type: "int", default: 3, min: 0, max: 10000, unit: "per window" },
  { key: "ai.userLimit", group: "AI search", label: "Searches for normal accounts", type: "int", default: 10, min: 0, max: 10000, unit: "per window" },
  { key: "ai.agencyLimit", group: "AI search", label: "Searches for agency members", type: "int", default: 40, min: 0, max: 10000, unit: "per window" },
  { key: "ai.premiumLimit", group: "AI search", label: "Searches for Premium agency members", type: "int", default: 120, min: 0, max: 10000, unit: "per window" },
  // Voice search (speech to text)
  { key: "voice.enabled", group: "Voice search", label: "Voice search on", type: "bool", default: true },
  { key: "voice.guestLimit", group: "Voice search", label: "Voice searches for visitors not signed in", type: "int", default: 3, min: 0, max: 10000, unit: "per window" },
  { key: "voice.userLimit", group: "Voice search", label: "Voice searches for normal accounts", type: "int", default: 10, min: 0, max: 10000, unit: "per window" },
  { key: "voice.agencyLimit", group: "Voice search", label: "Voice searches for agency members", type: "int", default: 40, min: 0, max: 10000, unit: "per window" },
  { key: "voice.premiumLimit", group: "Voice search", label: "Voice searches for Premium agency members", type: "int", default: 120, min: 0, max: 10000, unit: "per window" },
  { key: "voice.maxSeconds", group: "Voice search", label: "Longest recording", help: "Recordings stop by themselves at this length.", type: "int", default: 20, min: 5, max: 60, unit: "seconds" },
  // Ranking: how paid placement mixes with relevance. See search ranking notes in docs/ranking.md.
  { key: "rank.boostLift", group: "Search ranking", label: "Boost lift", help: "Extra relevance points a boosted listing earns. A perfect match is 100.", type: "int", default: 12, min: 0, max: 50 },
  { key: "rank.premiumLift", group: "Search ranking", label: "Premium lift", type: "int", default: 8, min: 0, max: 50 },
  { key: "rank.maxPaidSharePct", group: "Search ranking", label: "Most paid listings on a results page", type: "int", default: 35, min: 0, max: 100, unit: "%" },
  { key: "rank.freshDays", group: "Search ranking", label: "New listings get a small lift for", type: "int", default: 7, min: 0, max: 60, unit: "days" },
  // Safety
  { key: "reveal.guestPerDay", group: "Safety limits", label: "Phone reveals a day, not signed in", type: "int", default: 10, min: 1, max: 1000 },
  { key: "reveal.userPerDay", group: "Safety limits", label: "Phone reveals a day, signed in", type: "int", default: 40, min: 1, max: 1000 },
  { key: "reveal.networkPerDay", group: "Safety limits", label: "Phone reveals a day, per network", type: "int", default: 120, min: 1, max: 10000 },
];

export type SettingKey = (typeof SETTINGS)[number]["key"];
export type Values = Record<string, number | boolean>;

const byKey = new Map(SETTINGS.map((s) => [s.key, s]));
export const defaults = (): Values => Object.fromEntries(SETTINGS.map((s) => [s.key, s.default]));

/** Checks one submitted value against its definition. Returns the cleaned value or an error message. */
export function checkValue(key: string, raw: unknown): { ok: true; value: number | boolean } | { ok: false; error: string } {
  const d = byKey.get(key);
  if (!d) return { ok: false, error: `Unknown setting ${key}` };
  if (d.type === "bool") return typeof raw === "boolean" ? { ok: true, value: raw } : { ok: false, error: `${d.label} must be on or off` };
  const n = typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n)) return { ok: false, error: `${d.label} must be a number` };
  if (d.type === "int" && !Number.isInteger(n)) return { ok: false, error: `${d.label} must be a whole number` };
  if (d.min !== undefined && n < d.min) return { ok: false, error: `${d.label} cannot be below ${d.min}` };
  if (d.max !== undefined && n > d.max) return { ok: false, error: `${d.label} cannot be above ${d.max}` };
  return { ok: true, value: n };
}

/** Rules that span settings, so one cannot undo another. */
export function crossCheck(v: Values): string | null {
  if (Number(v["boost.defaultDays"]) > Number(v["boost.maxDays"])) return "The default boost length cannot be longer than the longest boost.";
  if (Number(v["premium.slots"]) > Number(v["premium.maxSlots"])) return "Listings per package cannot be more than the most slots in one package.";
  if (Number(v["ai.guestLimit"]) > Number(v["ai.userLimit"]) || Number(v["ai.userLimit"]) > Number(v["ai.agencyLimit"]) || Number(v["ai.agencyLimit"]) > Number(v["ai.premiumLimit"])) return "AI limits should rise from visitors to normal accounts to agencies to Premium.";
  if (Number(v["basic.maxStored"]) < Number(v["basic.maxLive"])) return "The total Basic listings kept cannot be fewer than the live Basic listings allowed.";
  if (Number(v["reveal.guestPerDay"]) > Number(v["reveal.userPerDay"])) return "Signed-in people should get at least as many phone reveals as visitors.";
  return null;
}

/** Overrides merged over defaults; anything unknown or invalid in storage is ignored, so a bad row can never break the site. */
export function merge(stored: Record<string, unknown> | null | undefined): Values {
  const out = defaults();
  for (const [k, raw] of Object.entries(stored ?? {})) { const c = checkValue(k, raw); if (c.ok) out[k] = c.value; }
  return out;
}
