import { useEffect } from "react";

const SEL = ".fb-fab, .view-pill, .compare-tray, .tour-prompt:not([role=dialog])";
const STORE = "hodii-float-hidden", DAY = 24 * 60 * 60 * 1000;
/** Put-away buttons stay away for a day, then come back by themselves. */
const readHidden = (): Record<string, number> => { try { const o = JSON.parse(localStorage.getItem(STORE) ?? "{}") as Record<string, number>; const now = Date.now(); return Object.fromEntries(Object.entries(o).filter(([, t]) => t > now)); } catch { return {}; } };
const keyOf = (el: Element) => (el.classList.contains("fb-fab") ? "fb" : el.classList.contains("view-pill") ? "view" : el.classList.contains("compare-tray") ? "tray" : "tour");

/**
 * The floating pills (feedback, guide, List/Map, compare) can be put away three ways: a small ✕ that appears on hover,
 * a swipe sideways, or a long press. Put away for a day; nothing is lost.
 */
export function FloatDismiss() {
  useEffect(() => {
    const root = document.documentElement;
    const saved = Object.keys(readHidden()); if (saved.length) root.setAttribute("data-hide", saved.join(" "));
    const hide = (el: Element) => { const k = keyOf(el); const cur = new Set((root.getAttribute("data-hide") ?? "").split(" ").filter(Boolean)); cur.add(k); root.setAttribute("data-hide", [...cur].join(" ")); try { localStorage.setItem(STORE, JSON.stringify({ ...readHidden(), [k]: Date.now() + DAY })); } catch { /* ignore */ } x.style.display = "none"; };
    const x = document.createElement("button");
    x.type = "button"; x.setAttribute("aria-label", "Remove this button"); x.textContent = "×"; x.className = "float-x";
    x.style.display = "none"; document.body.appendChild(x);
    let target: Element | null = null; let t = 0;
    const place = (el: Element) => { const r = el.getBoundingClientRect(); x.style.left = `${r.right - 12}px`; x.style.top = `${r.top - 10}px`; x.style.display = "grid"; target = el; };
    const over = (e: Event) => { const el = (e.target as Element | null)?.closest?.(SEL); if (el && matchMedia("(hover: hover)").matches) { clearTimeout(t); place(el); } };
    const out = () => { t = window.setTimeout(() => { x.style.display = "none"; }, 250); };
    x.addEventListener("mouseenter", () => clearTimeout(t)); x.addEventListener("mouseleave", out);
    x.addEventListener("click", () => { if (target) hide(target); });
    let sx = 0, sy = 0, press = 0, el0: Element | null = null, moved = false;
    const down = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(SEL); if (!el || (e.target as Element).closest(".float-x")) return;
      el0 = el; sx = e.clientX; sy = e.clientY; moved = false;
      press = window.setTimeout(() => { if (!moved && el0) { hide(el0); navigator.vibrate?.(20); } }, 700);
    };
    const move = (e: PointerEvent) => {
      if (!el0) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { moved = true; clearTimeout(press); }
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) { hide(el0); el0 = null; }
    };
    const up = () => { clearTimeout(press); el0 = null; };
    document.addEventListener("pointerover", over); document.addEventListener("pointerout", out);
    document.addEventListener("pointerdown", down); document.addEventListener("pointermove", move); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
    return () => { document.removeEventListener("pointerover", over); document.removeEventListener("pointerout", out); document.removeEventListener("pointerdown", down); document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); x.remove(); root.removeAttribute("data-hide"); };
  }, []);
  return null;
}
