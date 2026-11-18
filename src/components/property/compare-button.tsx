import { Scale } from "lucide-react";
import { toast } from "sonner";
import { COMPARE_MAX, toggleCompare, useCompare } from "@/lib/compare";

/** "Compare" toggle on a card or listing page. The choice is kept in this browser. */
export function CompareButton({ propertyId, label = false }: { propertyId: string; label?: boolean }) {
  const ids = useCompare();
  const on = ids.includes(propertyId);
  const click = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const r = toggleCompare(propertyId);
    if (r === "full") toast.error(`You can compare up to ${COMPARE_MAX} properties. Remove one first.`);
  };
  return (
    <button type="button" data-tour="compare" onClick={click} aria-pressed={on} aria-label={on ? "Remove from comparison" : "Add to comparison"} className={`relative z-10 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold shadow ${on ? "bg-primary text-primary-foreground" : "bg-background/90"}`}>
      <Scale className="h-4 w-4" aria-hidden />{label ? <span>{on ? "Comparing" : "Compare"}</span> : null}
    </button>
  );
}
