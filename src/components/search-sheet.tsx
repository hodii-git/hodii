import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { setSheet, useSheetOpen } from "@/lib/search-sheet";

/**
 * Wraps the search card. On desktop it is just the card (and Ask AI opens it as a centred popup, sized like the filters popup).
 * On a phone it is hidden until the search bar (or the bottom bar's Search icon) opens it, then it slides up from the bottom and rests on the bottom bar.
 * The card stays mounted, so what was typed, picked or chatted is never lost by closing it.
 */
export function SearchSheet({ children, ai = false, pinned = false }: { children: ReactNode; ai?: boolean; pinned?: boolean }) {
  const open = useSheetOpen();
  const box = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  const drag = useRef<{ y: number; h: number } | null>(null);
  // Every reopen (and every switch into or out of Ask AI) starts from the default height; the user can stretch again.
  useEffect(() => { setH(null); }, [open, ai]);
  /** Drag the handle: pull down to shrink the sheet and see more listings, pull up to grow it. */
  const limits = () => { const tab = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tab-h")) || 0; return [140, Math.max(220, Math.round(window.innerHeight * 0.7) - 0 * tab)] as const; };
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setSheet(false); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  return (
    <div ref={anchor} className="m-anchor" data-pinned={pinned ? "true" : undefined}>
    <div ref={box} className="m-sheet" data-pinned={pinned ? "true" : undefined} style={h && open ? { height: h, maxHeight: "none" } : undefined} data-open={open ? "true" : undefined} data-ai={ai ? "true" : undefined} role={open ? "dialog" : undefined} aria-label={open ? "Search" : undefined}>
      <div className="m-grab" aria-hidden
        onPointerDown={(e) => { drag.current = { y: e.clientY, h: box.current?.offsetHeight ?? 300 }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { const d = drag.current; if (!d) return; const [lo, hi] = limits(); setH(Math.min(hi, Math.max(lo, d.h + (d.y - e.clientY)))); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
      <div className="m-sheet-bar">
        <span className="text-base font-extrabold">Search</span>
        <button type="button" onClick={() => setSheet(false)} aria-label="Close search" className="close-circle"><X className="h-4 w-4" aria-hidden /></button>
      </div>
      {children}
      {open && !pinned && typeof document !== "undefined" && createPortal(<div aria-hidden className="m-sheet-scrim" onClick={() => setSheet(false)} />, document.body)}
    </div>
    </div>
  );
}
