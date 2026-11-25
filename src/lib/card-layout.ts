import { useSyncExternalStore } from "react";

/** How listing cards are laid out: the normal grid, one big card per row (phones only), or photo-right horizontal cards. Kept in this browser. */
export type CardLayout = "grid" | "single";
const KEY = "hodii:card-layout";
const listeners = new Set<() => void>();
let cached: CardLayout | undefined;
const read = (): CardLayout => {
  if (cached === undefined) { try { const v = localStorage.getItem(KEY); cached = v === "single" ? v : "grid"; } catch { cached = "grid"; } }
  return cached;
};
export const setCardLayout = (v: CardLayout) => { cached = v; try { localStorage.setItem(KEY, v); } catch { /* storage blocked */ } listeners.forEach((l) => l()); };
export function useCardLayout() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, read, () => "grid" as CardLayout);
}
