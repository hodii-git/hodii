import { LayoutGrid, Square } from "lucide-react";
import { setCardLayout, useCardLayout } from "@/lib/card-layout";

/** Phones only: switches between the normal grid and one big card per row. */
export function LayoutPill() {
  const layout = useCardLayout();
  const next = layout === "grid" ? "single" : "grid";
  const Icon = layout === "grid" ? LayoutGrid : Square;
  return (
    <button type="button" onClick={() => setCardLayout(next)} aria-label={layout === "grid" ? "Show one card per row" : "Show cards in a grid"} className="glass-menu pill-lift grid size-10 shrink-0 place-items-center rounded-full md:hidden"><Icon className="size-4" aria-hidden /></button>
  );
}
