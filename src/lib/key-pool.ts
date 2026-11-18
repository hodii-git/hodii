/**
 * A set of API keys used in turn. When one runs out of credit or is refused, it is rested for a while and the next one is used,
 * so a spent key never takes AI search down while another still has credit. Pure apart from the clock passed in.
 */
export type Failure = "exhausted" | "rejected" | "transient";

/** 401/403 = the key is wrong; 402 or a 429 about quota/credit = out of credit; other 429 and 5xx = try later. */
export function classify(status: number, body: string): Failure | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401 || status === 403) return "rejected";
  if (status === 402) return "exhausted";
  if (status === 429) return /quota|credit|billing|exceeded your|per day|tokens per day|TPD|RPD/i.test(body) ? "exhausted" : "transient";
  return "transient";
}

const REST_MS: Record<Failure, number> = { exhausted: 60 * 60_000, rejected: 6 * 60 * 60_000, transient: 30_000 };

export class KeyPool {
  private rest = new Map<string, number>();
  private cursor = 0;
  constructor(private keys: string[]) {}

  /** Keys not resting, starting after the one used last so load is spread. */
  available(now: number): string[] {
    const n = this.keys.length;
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const k = this.keys[(this.cursor + i) % n]!;
      if ((this.rest.get(k) ?? 0) <= now) out.push(k);
    }
    return out;
  }
  used(key: string) { const i = this.keys.indexOf(key); if (i >= 0) this.cursor = (i + 1) % this.keys.length; }
  fail(key: string, kind: Failure, now: number, retryAfterSec?: number) {
    const ms = kind === "transient" && retryAfterSec ? Math.min(retryAfterSec * 1000, 10 * 60_000) : REST_MS[kind];
    this.rest.set(key, now + ms);
  }
  get size() { return this.keys.length; }
}

export const parseKeys = (raw: string | undefined, single?: string | undefined) =>
  [...new Set([...(raw ?? "").split(/[\s,]+/), ...(single ? [single] : [])].map((k) => k.trim()).filter((k) => k.length >= 20))];
