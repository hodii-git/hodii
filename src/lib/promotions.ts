/** Rules for paid visibility. Pure, so the money-adjacent logic is tested without a database. */

export type Promotion = { boostUntil?: Date | null | undefined; premiumUntil?: Date | null | undefined };
export type Tier = "none" | "boost" | "premium";

const live = (d: Date | null | undefined, now: number) => d instanceof Date && d.getTime() > now;

/** What a listing is right now. Premium wins when both run, because it is the higher tier. */
export function tierNow(p: Promotion | null | undefined, now = Date.now()): Tier {
  if (live(p?.premiumUntil, now)) return "premium";
  if (live(p?.boostUntil, now)) return "boost";
  return "none";
}

/** The stored summary: tier now, and the latest end date of anything still running (so a plain `until > now` check keeps working). */
export function summarise(p: Promotion, now = Date.now()): { tier: Tier; until: Date | null } {
  const ends = [p.boostUntil, p.premiumUntil].filter((d): d is Date => d instanceof Date && d.getTime() > now);
  return { tier: tierNow(p, now), until: ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null };
}

/* ---------- Premium packages ---------- */

export type PackagePrice = { priceKes: number; slots: number; days: number; extraSlots: number };

/** Base price covers the standard number of slots; each slot above that costs extra. Never trust the browser: this runs on the server. */
export function packagePrice(slots: number, v: { priceKes: number; slots: number; days: number; extraSlotKes: number; maxSlots: number }): PackagePrice | null {
  if (!Number.isInteger(slots) || slots < 1 || slots > v.maxSlots) return null;
  const extraSlots = Math.max(0, slots - v.slots);
  return { priceKes: v.priceKes + extraSlots * v.extraSlotKes, slots, days: v.days, extraSlots };
}

export type PackageState = "active" | "expired";
export const packageState = (endsAt: Date, now = Date.now()): PackageState => (endsAt.getTime() > now ? "active" : "expired");
export const slotsFree = (slots: number, attached: number) => Math.max(0, slots - attached);

/** Why a listing cannot join a package right now, or null when it can. */
export function cannotJoin(l: { status: string; inPackage: boolean }, pkg: { endsAt: Date; slots: number; attached: number }, now = Date.now()): string | null {
  if (pkg.endsAt.getTime() <= now) return "This package has ended. Renew it first.";
  if (l.inPackage) return "This listing is already in a package.";
  // Live listings, and ones waiting to go live (a draft, a frozen or an expired listing goes live when it joins).
  if (!["published", "pending_review", "draft", "frozen", "expired"].includes(l.status)) return "Only live listings, drafts, frozen and expired listings can join a package.";
  if (pkg.attached >= pkg.slots) return "This package is full. Remove a listing or buy another package.";
  return null;
}

/** The end date of a package that starts now. */
export const packageEnds = (days: number, from = new Date()) => new Date(from.getTime() + days * 86_400_000);

/* ---------- Expiry notices ---------- */

export type Ending = { until: Date };
/** Splits things that end into "soon" (within `noticeDays`, still running) and "ended" (ended in the last `graceDays`, so the notice is sent once, not forever). */
export function classifyEnding(until: Date, noticeDays: number, now = Date.now(), graceDays = 3): "soon" | "ended" | "other" {
  const t = until.getTime();
  if (t > now && t - now <= noticeDays * 86_400_000) return "soon";
  if (t <= now && now - t <= graceDays * 86_400_000) return "ended";
  return "other";
}

/* ---------- Search mix ---------- */

/**
 * Orders results so paid listings are lifted but never take over a page.
 * `items` arrive best first. Within every page of `pageSize`, at most `maxPaidPct`% may be paid; paid listings that do not fit
 * wait for the next page, and unpaid ones fill the gap, so nothing is dropped and relevance order is kept inside each group.
 */
export function mixPaid<T extends { paid: boolean }>(items: readonly T[], pageSize: number, maxPaidPct: number): T[] {
  const maxPaid = Math.max(0, Math.floor((pageSize * maxPaidPct) / 100));
  const paid = items.filter((i) => i.paid), free = items.filter((i) => !i.paid);
  const out: T[] = [];
  let pi = 0, fi = 0;
  const original = new Map(items.map((it, idx) => [it, idx] as const));
  while (pi < paid.length || fi < free.length) {
    const page: T[] = [];
    let paidOnPage = 0;
    while (page.length < pageSize && (pi < paid.length || fi < free.length)) {
      const nextPaid = paid[pi], nextFree = free[fi];
      const canPaid = nextPaid !== undefined && paidOnPage < maxPaid;
      if (canPaid && (nextFree === undefined || original.get(nextPaid)! < original.get(nextFree)!)) { page.push(nextPaid); pi++; paidOnPage++; }
      else if (nextFree !== undefined) { page.push(nextFree); fi++; }
      else if (canPaid) { page.push(nextPaid!); pi++; paidOnPage++; }
      else if (nextPaid !== undefined) { page.push(nextPaid); pi++; paidOnPage++; } // only paid ones are left: the cap cannot leave a page empty
    }
    out.push(...page);
  }
  return out;
}
