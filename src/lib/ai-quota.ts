/** AI search allowance, as pure rules so they are tested. The database part lives in ai-search.server.ts. */
export type Tier = "guest" | "user" | "agency" | "premium";
export type Counter = { windowStart: Date; count: number } | null;
export type QuotaState = { limit: number; used: number; remaining: number; /** When the counter restarts; null when nothing has been used yet. */ resetsAt: Date | null };

export function limitFor(tier: Tier, v: Record<string, number | boolean>): number {
  return Number(v[tier === "guest" ? "ai.guestLimit" : tier === "user" ? "ai.userLimit" : tier === "agency" ? "ai.agencyLimit" : "ai.premiumLimit"]);
}

/** The counter counts only inside its window; once the window has passed, the person has everything back. */
export function quotaState(counter: Counter, limit: number, windowHours: number, now = Date.now()): QuotaState {
  const ms = windowHours * 3_600_000;
  if (!counter || counter.windowStart.getTime() + ms <= now) return { limit, used: 0, remaining: limit, resetsAt: null };
  const used = Math.min(counter.count, limit);
  return { limit, used, remaining: Math.max(0, limit - counter.count), resetsAt: new Date(counter.windowStart.getTime() + ms) };
}

/** "2h 05m", "14m 03s": a timer that is readable at both ends of the window. */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}h ${p(m)}m ${p(sec)}s` : `${m}m ${p(sec)}s`;
}
