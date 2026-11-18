import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The open list of a dropdown. It is drawn on top of the page (not inside the filter box), so a scrolling or clipped parent can never cut it off.
 * It sits under the button, or above it when there is no room below, and its height follows the space on that device, scrolling inside.
 */
export function FloatingPanel({ anchor, open, onClose, children, minWidth = 192, className = "" }: { anchor: React.RefObject<HTMLElement | null>; open: boolean; onClose: () => void; children: ReactNode; minWidth?: number; className?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);

  const place = () => {
    const a = anchor.current; if (!a) return;
    const r = a.getBoundingClientRect(), vh = window.innerHeight, vw = window.innerWidth, gap = 6, edge = 12;
    const below = vh - r.bottom - gap - edge, above = r.top - gap - edge;
    const up = below < 220 && above > below;
    const width = Math.min(Math.max(r.width, minWidth), vw - edge * 2);
    const left = Math.max(edge, Math.min(r.left, vw - width - edge));
    const room = Math.max(160, up ? above : below);
    setBox(up ? { bottom: vh - r.top + gap, left, width, maxHeight: Math.min(room, 480) } : { top: r.bottom + gap, left, width, maxHeight: Math.min(room, 480) });
  };

  useLayoutEffect(() => { if (open) place(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  useEffect(() => {
    if (!open) return;
    const again = () => place();
    window.addEventListener("resize", again); window.addEventListener("scroll", again, true);
    const away = (e: MouseEvent | TouchEvent) => { const t = e.target as Node; if (!panel.current?.contains(t) && !anchor.current?.contains(t)) onClose(); };
    document.addEventListener("mousedown", away); document.addEventListener("touchstart", away);
    return () => { window.removeEventListener("resize", again); window.removeEventListener("scroll", again, true); document.removeEventListener("mousedown", away); document.removeEventListener("touchstart", away); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !box || typeof document === "undefined") return null;
  return createPortal(
    <div ref={panel} data-floating style={{ position: "fixed", zIndex: 100, left: box.left, width: box.width, top: box.top, bottom: box.bottom, maxHeight: box.maxHeight }}
      className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-float ${className}`}>
      {children}
    </div>, document.body);
}
