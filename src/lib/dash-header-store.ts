import { useSyncExternalStore } from "react";

/** The admin console keeps its section in component state, so it tells the header what to show through this tiny store. */
export type AdminHeaderCtx = { title: string; waiting: number; role: string; name: string } | null;
let ctx: AdminHeaderCtx = null;
const subs = new Set<() => void>();
export const setAdminHeader = (c: AdminHeaderCtx) => {
  if (JSON.stringify(c) === JSON.stringify(ctx)) return;
  ctx = c; subs.forEach((f) => f());
};
export const useAdminHeader = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => ctx, () => null);
