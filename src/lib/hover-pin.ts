import { useSyncExternalStore } from "react";

/** The listing the pointer is on, shared between the cards and the map so each can light up the other. */
let current: string | null = null;
const subs = new Set<() => void>();
export const setHoverPin = (id: string | null) => { if (id !== current) { current = id; subs.forEach((f) => f()); } };
export const useHoverPin = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => current, () => null);
