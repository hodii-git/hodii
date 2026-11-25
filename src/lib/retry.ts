/** Try again a few times with growing waits when something fails for a reason that may pass (a dropped connection, a busy server). Pure apart from the timer. */
export type RetryOptions = { tries?: number; baseMs?: number; maxMs?: number; shouldRetry?: (e: unknown, attempt: number) => boolean; sleep?: (ms: number) => Promise<void>; onRetry?: (attempt: number, e: unknown) => void };

/** Network drops and server trouble are worth another go; a refusal because of what was sent (bad file, no permission) is not. */
export function isTransient(e: unknown): boolean {
  if (e instanceof TypeError) return true; // fetch fails with TypeError when the connection drops
  const status = (e as { status?: number } | null)?.status;
  if (typeof status === "number") return status === 408 || status === 429 || status >= 500;
  const msg = e instanceof Error ? e.message : "";
  return /network|failed to fetch|timeout|timed out|temporar|unavailable|aborted|ECONNRESET|503|502|504/i.test(msg);
}

export const waitFor = (attempt: number, baseMs: number, maxMs: number, rand = Math.random) => Math.min(maxMs, baseMs * 2 ** attempt) * (0.75 + rand() * 0.5);

export async function retry<T>(fn: (attempt: number) => Promise<T>, o: RetryOptions = {}): Promise<T> {
  const tries = o.tries ?? 3, baseMs = o.baseMs ?? 600, maxMs = o.maxMs ?? 6000;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(i); } catch (e) {
      last = e;
      if (i === tries - 1 || !(o.shouldRetry ?? isTransient)(e, i)) throw e;
      o.onRetry?.(i + 1, e);
      await sleep(waitFor(i, baseMs, maxMs));
    }
  }
  throw last;
}
