import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Shows a small dark label under an icon on hover, keyboard focus or long press.
 * The label is drawn in a portal with fixed positioning and clamped to the screen, so it is never clipped by the
 * photo's rounded overflow or pushed off the edge when the icon sits near a corner.
 */
export function IconHint({ label, children, side = "bottom" }: { label: string; children: React.ReactNode; side?: "bottom" | "top" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const host = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const longPressed = useRef(false);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => clear, []);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const h = host.current, t = tip.current;
    if (!h || !t) return;
    const r = h.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight, m = 8;
    const w = t.offsetWidth, ht = t.offsetHeight;
    const left = Math.max(m, Math.min(r.left + r.width / 2 - w / 2, vw - w - m));
    let top = side === "top" ? r.top - ht - 8 : r.bottom + 8;
    if (side === "top" && top < m) top = r.bottom + 8; // no room above: flip below
    if (top + ht > vh - m) top = Math.max(m, r.top - ht - 8); // no room below: flip above
    setPos({ left, top });
  }, [open, label, side]);

  useEffect(() => {
    if (!open) return;
    const off = () => setOpen(false);
    window.addEventListener("scroll", off, { passive: true });
    window.addEventListener("resize", off);
    return () => { window.removeEventListener("scroll", off); window.removeEventListener("resize", off); };
  }, [open]);

  return (
    <span
      ref={host}
      className="relative inline-flex"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true); }}
      onPointerLeave={() => { clear(); setOpen(false); }}
      onPointerDown={(e) => { longPressed.current = false; if (e.pointerType !== "mouse") { clear(); timer.current = setTimeout(() => { longPressed.current = true; setOpen(true); }, 450); } }}
      onPointerUp={() => { clear(); if (open) setTimeout(() => setOpen(false), 1400); }}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
      onClickCapture={(e) => { if (longPressed.current) { longPressed.current = false; e.preventDefault(); e.stopPropagation(); } }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
      {open && typeof document !== "undefined" && createPortal(
        <span
          ref={tip}
          role="tooltip"
          style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
          className={`ld-font pointer-events-none fixed z-[200] max-w-[calc(100vw-16px)] whitespace-nowrap rounded-full border border-white/15 bg-[#141416]/95 px-3 py-1.5 text-[12px] font-semibold text-[#f3ead7] shadow-[0_8px_24px_rgb(0_0_0/0.55)] backdrop-blur-md transition-opacity duration-150 ${pos ? "opacity-100" : "opacity-0"}`}
        >{label}</span>,
        document.body,
      )}
    </span>
  );
}

/** Fades its children out while scrolling down and brings them back gently on scroll up. */
export function ScrollFade({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    let last = window.scrollY;
    const on = () => { const y = window.scrollY; if (Math.abs(y - last) < 6) return; setShown(y < last || y < 40); last = y; };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return <div className={`transition-opacity duration-500 ease-out ${shown ? "opacity-100" : "pointer-events-none opacity-0"} ${className}`}>{children}</div>;
}
