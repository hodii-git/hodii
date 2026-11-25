import { tierNow, type Promotion } from "./promotions";

/**
 * The Basic listing limit, as pure rules.
 * - A listing counts as Basic when it is live (published or awaiting review) and neither Boosted nor in a Premium package.
 * - Paid listings are never counted, so paying always makes room.
 * - When a paid term ends and the agency is over its limit, the listings that just lost paid status are frozen first (after a grace period),
 *   then, only if still over, the Basic listings with the fewest views.
 */
export type Row = { id: string; status: string; promotion?: Promotion | undefined; views: number; publishedAt: Date | null };

export const LIVE = ["published", "pending_review"] as const;
export const isLive = (s: string) => (LIVE as readonly string[]).includes(s);

export const allowance = (base: number, activePackSlots: number) => Math.max(0, base) + Math.max(0, activePackSlots);

/** Live listings that are Basic right now. */
export const countedBasic = (rows: readonly Row[], now = Date.now()) => rows.filter((r) => isLive(r.status) && tierNow(r.promotion, now) === "none");

/** When the last paid term of this listing ended, if it ever had one. */
export function paidEndedAt(p: Promotion | undefined): Date | null {
  const ends = [p?.boostUntil, p?.premiumUntil].filter((d): d is Date => d instanceof Date);
  return ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;
}

export type Room = { used: number; allowance: number; room: number; full: boolean };
export const roomFor = (rows: readonly Row[], allow: number, now = Date.now()): Room => {
  const used = countedBasic(rows, now).length;
  return { used, allowance: allow, room: Math.max(0, allow - used), full: used >= allow };
};

/** Which listings to freeze so the agency is back within its limit. Empty when it already is, or while listings are still in their grace period. */
export function pickToFreeze(rows: readonly Row[], allow: number, graceDays: number, now = Date.now()): string[] {
  const basic = countedBasic(rows, now);
  const excess = basic.length - allow;
  if (excess <= 0) return [];
  const graceMs = graceDays * 86_400_000;
  const lost = basic.map((r) => ({ r, ended: paidEndedAt(r.promotion) })).filter((x): x is { r: Row; ended: Date } => x.ended !== null);
  const pastGrace = lost.filter((x) => x.ended.getTime() + graceMs <= now).sort((a, b) => b.ended.getTime() - a.ended.getTime()).map((x) => x.r.id);
  const inGrace = lost.length - pastGrace.length;
  const picked = pastGrace.slice(0, excess);
  if (picked.length >= excess) return picked;
  // Still over after freezing every listing that lost paid status. If some are still in grace, wait for them rather than freeze others.
  if (inGrace > 0) return picked;
  const lostIds = new Set(lost.map((x) => x.r.id));
  const others = basic.filter((r) => !lostIds.has(r.id)).sort((a, b) => a.views - b.views || (a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0));
  return [...picked, ...others.slice(0, excess - picked.length).map((r) => r.id)];
}
