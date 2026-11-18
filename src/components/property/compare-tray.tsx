import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { clearCompare, useCompare } from "@/lib/compare";

/** A bar at the bottom of the screen while two or more listings are picked. */
export function CompareTray() {
  const ids = useCompare();
  if (ids.length < 1) return null;
  return (
    <div role="region" aria-label="Compare properties" className="fixed inset-x-0 bottom-3 z-40 mx-auto flex w-[min(92vw,28rem)] items-center justify-between gap-3 rounded-full border border-border bg-background px-4 py-2 shadow-xl">
      <p className="text-sm font-semibold">{ids.length} to compare</p>
      <div className="flex items-center gap-2">
        {ids.length >= 2 ? <Link to="/compare" search={{ ids: ids.join(",") }} className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground">Compare</Link> : <span className="text-xs text-muted-foreground">Pick one more</span>}
        <button type="button" onClick={clearCompare} aria-label="Clear comparison" className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"><X className="h-4 w-4" aria-hidden /></button>
      </div>
    </div>
  );
}
