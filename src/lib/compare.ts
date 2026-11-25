import { useSyncExternalStore } from "react";

/** Up to four listings picked for side-by-side comparison. Kept in this browser only, so it works without an account. */
export const COMPARE_MAX = 4;
const KEY = "hodii-compare";
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, COMPARE_MAX) : [];
  } catch { cache = []; }
  return cache;
}
function write(ids: string[]) {
  cache = ids;
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* private window: the choice lasts until the page is closed */ }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const EMPTY: string[] = [];

export const toggleCompare = (id: string): "added" | "removed" | "full" => {
  const cur = read();
  if (cur.includes(id)) { write(cur.filter((x) => x !== id)); return "removed"; }
  if (cur.length >= COMPARE_MAX) return "full";
  write([...cur, id]); return "added";
};
export const clearCompare = () => write([]);
export const useCompare = () => useSyncExternalStore(subscribe, read, () => EMPTY);

/** Price per square metre, when both numbers are known. */
export const perSqm = (amount: number | null | undefined, sqm: number | null | undefined) => (amount && sqm && sqm > 0 ? Math.round(amount / sqm) : null);
