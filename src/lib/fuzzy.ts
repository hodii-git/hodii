/** Small spelling helpers for place names ("kimboi" → Kiambu). Pure, so they are tested and shared by server and browser. */
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Edit distance, stopping early once it is certain to exceed `max`. */
export function distance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v); if (v < low) low = v;
    }
    if (low > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

/** Sounds alike: keeps the consonant skeleton, so "kimboi" and "kiambu" meet. */
export const skeleton = (s: string) => norm(s).replace(/[aeiouy ]/g, "").replace(/(.)\1+/g, "$1").replace(/b/g, "p").replace(/[dt]/g, "t").replace(/[kgc]/g, "k");

export type Named<T> = { name: string; item: T };
/** Best spelling match for `text`, or null. Allows more mistakes in longer words. */
export function closest<T>(text: string, list: readonly Named<T>[]): { item: T; name: string; exact: boolean } | null {
  const t = norm(text);
  if (t.length < 3) return null;
  const sk = skeleton(t);
  let best: { item: T; name: string; score: number; exact: boolean } | null = null;
  for (const c of list) {
    const n = norm(c.name);
    const exact = n === t;
    const max = t.length <= 4 ? 1 : 2;
    let d = exact ? 0 : n.startsWith(t) || t.startsWith(n) ? 0.5 : distance(t, n, max);
    if (d > max && skeleton(n) === sk && sk.length >= 3) d = max; // sounds alike
    if (d > max) continue;
    if (d > 0.5 && n[0] !== t[0]) continue; // a different first letter is almost never a typo
    if (d > 0.5 && d / Math.max(n.length, t.length) > 0.34) continue;
    if (!best || d < best.score) best = { item: c.item, name: c.name, score: d, exact };
  }
  return best ? { item: best.item, name: best.name, exact: best.exact } : null;
}
