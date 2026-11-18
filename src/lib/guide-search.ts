/** Search over the help articles, in the browser. Words match anywhere; title and keywords count most; plurals and small typos are forgiven. */
export type Article = { id: string; audience: "user" | "agency"; category: string; title: string; summary: string; keywords: string[]; body: Block[]; related?: string[] };
export type Block = { h?: string; p?: string; steps?: string[]; bullets?: string[]; note?: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const stem = (w: string) => (w.length > 3 ? w.replace(/(ing|ed|es|s)$/, "") : w);
export const words = (q: string) => norm(q).split(" ").filter((w) => w.length > 1).map(stem);

/** True when the two words are the same or one letter apart (typos like "verifcation"). */
export function near(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length === b.length) { i++; j++; } else if (a.length > b.length) i++; else j++;
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}

const flatBody = (a: Article) => a.body.flatMap((b) => [b.h, b.p, b.note, ...(b.steps ?? []), ...(b.bullets ?? [])]).filter((x): x is string => !!x).join(" ");

export function score(a: Article, q: string): number {
  const ws = words(q);
  if (!ws.length) return 0;
  const title = words(a.title), kw = a.keywords.flatMap(words), sum = words(a.summary), body = words(flatBody(a));
  let total = 0;
  for (const w of ws) {
    const hit = (pool: string[], pts: number, fuzzy = false) => (pool.some((p) => p.includes(w) || w.includes(p) && p.length > 3 || (fuzzy && near(p, w))) ? pts : 0);
    const best = Math.max(hit(title, 10), hit(kw, 8), hit(sum, 4), hit(body, 2), hit(title, 6, true), hit(kw, 5, true), hit(body, 1, true));
    if (best === 0) return 0; // every word must be found somewhere
    total += best;
  }
  return total;
}

export function searchArticles(all: readonly Article[], q: string, audience?: "user" | "agency"): Article[] {
  const pool = audience ? all.filter((a) => a.audience === audience) : all;
  if (!q.trim()) return [...pool];
  return pool.map((a) => ({ a, s: score(a, q) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s).map((x) => x.a);
}
