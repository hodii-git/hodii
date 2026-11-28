import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { clearCompare, useCompare } from "@/lib/compare";

/** A bar at the bottom of the screen while listings are picked. Swipe it sideways or down to put it away; it returns when the picks change. */
export function CompareTray() {
  const ids = useCompare();
  const key = ids.join(",");
  const [away, setAway] = useState<string | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const start = useRef<{ x: number; y: number } | null>(null);
  const hidden = ids.length < 1 || away === key;
  useEffect(() => {
    if (hidden) delete document.documentElement.dataset["compare"]; else document.documentElement.dataset["compare"] = "1";
    return () => { delete document.documentElement.dataset["compare"]; };
  }, [hidden]);
  if (hidden) return null;
  const end = () => {
    const d = drag; start.current = null;
    if (Math.abs(d.x) > 70 || d.y > 36) { setAway(key); setDrag({ x: 0, y: 0 }); } else setDrag({ x: 0, y: 0 });
  };
  return (
    <div role="region" aria-label="Compare properties"
      onPointerDown={(e) => { if ((e.target as HTMLElement).closest("a,button")) return; start.current = { x: e.clientX, y: e.clientY }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { if (start.current) setDrag({ x: e.clientX - start.current.x, y: Math.max(0, e.clientY - start.current.y) }); }}
      onPointerUp={end} onPointerCancel={end}
      style={{ transform: `translate(${drag.x}px, ${drag.y}px)`, opacity: 1 - Math.min(0.6, Math.abs(drag.x) / 300 + drag.y / 120) }}
      className="compare-tray glass-white fixed inset-x-0 z-40 mx-auto flex w-[min(92vw,28rem)] items-center justify-between gap-3 rounded-full py-1 pl-4 pr-1 text-foreground">
      <p className="text-sm font-semibold">{ids.length} to compare</p>
      <div className="flex items-center gap-2">
        {ids.length >= 2 ? <Link to="/compare" search={{ ids: key }} className="rounded-full bg-foreground px-4 py-1.5 text-sm font-bold text-background">Compare</Link> : <span className="text-xs text-muted-foreground">Pick one more</span>}
        <button type="button" onClick={clearCompare} aria-label="Clear comparison" className="close-circle ml-auto shrink-0"><X className="h-4 w-4" aria-hidden /></button>
      </div>
    </div>
  );
}
