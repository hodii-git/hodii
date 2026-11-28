import { useSyncExternalStore } from "react";

/** Whether the phone search sheet is open. Shared by the header search bar, the bottom bar's Search icon and the search card itself. */
let open = false;
const subs = new Set<() => void>();
const emit = () => { if (typeof document !== "undefined") { if (open) document.documentElement.dataset["sheet"] = "1"; else delete document.documentElement.dataset["sheet"]; } subs.forEach((f) => f()); };
export const setSheet = (v: boolean) => { if (open !== v) { open = v; emit(); } };
export const toggleSheet = () => setSheet(!open);
export const useSheetOpen = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => open, () => false);
/** Pages that carry the search card. */
export const isSearchPage = (p: string) => p === "/";
