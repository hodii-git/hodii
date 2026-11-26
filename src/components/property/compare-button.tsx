import { Scale } from "lucide-react";
import { toast } from "sonner";
import { COMPARE_MAX, toggleCompare, useCompare } from "@/lib/compare";

/** "Compare" toggle on a card or listing page. The choice is kept in this browser. */
export function CompareButton({ propertyId, label = false, bare = false }: { propertyId: string; label?: boolean; bare?: boolean }) {
  const ids = useCompare();
  const on = ids.includes(propertyId);
  const click = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const r = toggleCompare(propertyId);
    if (r === "full") toast.error(`You can compare up to ${COMPARE_MAX} properties. Remove one first.`);
  };
  return (
    <button type="button" data-tour="compare" onClick={click} aria-pressed={on} aria-label={on ? "Remove from comparison" : "Add to comparison"} className={`relative z-10 inline-flex items-center justify-center rounded-full text-sm font-semibold ${bare ? "" : "backdrop-blur-sm"} transition hover:scale-105 ${label ? "gap-2 px-3 py-2 shadow " + (on ? "bg-foreground text-background" : "bg-background/90") : (bare ? "hero-icon size-8 " : "size-8 " + (on ? "bg-foreground text-background" : "bg-black/35 text-white"))}`}>
      <Scale className={label ? "h-4 w-4" : bare ? "h-5 w-5" : "h-3.5 w-3.5"} strokeWidth={bare ? 2.2 : 2} aria-hidden />{label ? <span>{on ? "Comparing" : "Compare"}</span> : null}
    </button>
  );
}
