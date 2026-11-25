import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const subs = new Set<() => void>();
const tell = () => subs.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; tell(); });
  window.addEventListener("appinstalled", () => { deferred = null; tell(); });
}

export const isStandalone = () => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || !!(navigator as { standalone?: boolean }).standalone);
export const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

/** Where the app stands: installed (offer Update), installable (offer Install), or neither. */
export function usePwa() {
  const [, bump] = useState(0);
  const [client, setClient] = useState(false);
  useEffect(() => { setClient(true); const f = () => bump((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return { standalone: client && isStandalone(), canInstall: client && !isStandalone() && (!!deferred || isIos()) };
}

export async function installApp(): Promise<void> {
  if (!deferred) { window.dispatchEvent(new Event("hodii-install-help")); return; }
  await deferred.prompt(); await deferred.userChoice.catch(() => null); deferred = null; tell();
}

/** Fetch the newest version: drop the cached copies and reload. */
export async function updateApp(): Promise<void> {
  try { const regs = await navigator.serviceWorker?.getRegistrations(); await Promise.all((regs ?? []).map((r) => r.unregister())); const keys = await caches?.keys(); await Promise.all((keys ?? []).map((k) => caches.delete(k))); } catch { /* reload anyway */ }
  window.location.reload();
}
