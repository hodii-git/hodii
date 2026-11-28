import { useEffect } from "react";

const TEXTY = /^(text|search|email|tel|url|number|password|)$/i;
const isField = (el: EventTarget | null): el is HTMLElement =>
  el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TEXTY.test(el.type)) || (el instanceof HTMLElement && el.isContentEditable);

/**
 * When any text field is tapped, keep it (and its cursor) visible a little above the on-screen keyboard, even before
 * the person has typed. Runs again when the keyboard finishes opening, because the visible height changes then.
 */
export function useKeyboardSafeFocus() {
  useEffect(() => {
    const vv = window.visualViewport;
    let active: HTMLElement | null = null;
    const GAP = 28;
    const reveal = () => {
      const el = active; if (!el || !document.contains(el)) return;
      const h = vv?.height ?? window.innerHeight, top = vv?.offsetTop ?? 0;
      const r = el.getBoundingClientRect();
      const bottomLimit = top + h - GAP;
      if (r.bottom > bottomLimit) {
        const by = r.bottom - bottomLimit;
        // A scrollable parent (a sheet or popup) moves first; otherwise the page does.
        let p: HTMLElement | null = el.parentElement, done = false;
        while (p && p !== document.body) { const o = getComputedStyle(p).overflowY; if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) { p.scrollBy({ top: by, behavior: "smooth" }); done = true; break; } p = p.parentElement; }
        if (!done) window.scrollBy({ top: by, behavior: "smooth" });
      } else if (r.top < top + 8) window.scrollBy({ top: r.top - top - 80, behavior: "smooth" });
    };
    const onFocus = (e: FocusEvent) => { if (!isField(e.target)) return; active = e.target; setTimeout(reveal, 60); setTimeout(reveal, 320); };
    const onBlur = () => { active = null; };
    document.addEventListener("focusin", onFocus); document.addEventListener("focusout", onBlur);
    vv?.addEventListener("resize", reveal);
    return () => { document.removeEventListener("focusin", onFocus); document.removeEventListener("focusout", onBlur); vv?.removeEventListener("resize", reveal); };
  }, []);
}
