import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "hodii-install-dismissed";

function recentlyDismissed() {
  try { const t = Number(localStorage.getItem(KEY)); return t > 0 && Date.now() - t < 14 * 864e5; } catch { return false; }
}

/** One-tap "install the app" card. Android/desktop Chrome use the real install prompt; iPhone gets the Share steps. */
export function InstallPrompt() {
  const [ev, setEv] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onHelp = () => { setHelp(!ev); setShow(true); };
    window.addEventListener("hodii-install-help", onHelp);
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone || recentlyDismissed()) return () => window.removeEventListener("hodii-install-help", onHelp);
    const onPrompt = (e: Event) => { e.preventDefault(); setEv(e as InstallEvent); };
    const onInstalled = () => { setShow(false); setEv(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    setIos(isIos);
    const t = window.setTimeout(() => setShow(true), 25000);
    return () => { window.clearTimeout(t); window.removeEventListener("hodii-install-help", onHelp); window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const close = () => { setShow(false); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* private mode */ } };
  if (!show || (!ev && !ios && !help)) return null;

  const install = async () => {
    if (!ev) { setHelp(true); return; }
    await ev.prompt();
    await ev.userChoice.catch(() => null);
    setEv(null); setShow(false);
  };

  return (
    <div role="dialog" aria-label="Get the Hodii app" className="glass-menu popup-clean fixed inset-x-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl p-3 pr-2 shadow-float" style={{ bottom: "calc(var(--tab-h, 0px) + 0.75rem)" }}>
      <img src="/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl" width={44} height={44} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{help ? "Tap Share, then Add to Home Screen." : "Get Hodii as a mobile app in one click."}</p>
        {!help && <button type="button" onClick={() => void install()} className="mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground"><Download className="size-4" aria-hidden />Download now</button>}
      </div>
      <button type="button" onClick={close} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-black/5"><X className="size-4" aria-hidden /></button>
    </div>
  );
}
