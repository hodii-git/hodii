import { List, Map as MapIcon } from "lucide-react";
import { useCompare } from "@/lib/compare";

/** A floating List / Map switch at the bottom centre. It lifts above the compare bar when that is showing, and stays clear of the corner buttons. */
export function ViewPill({ map, onChange }: { map: boolean; onChange: (v: "list" | "map") => void }) {
  const compare = useCompare().length > 0;
  const item = (on: boolean) => `inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold sm:h-11 sm:px-5 ${on ? "bg-foreground text-background" : "text-foreground"}`;
  return (
    <div data-floating role="group" aria-label="Show listings as" className={`fixed left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-full border border-border bg-background p-1 shadow-xl ${compare ? "bottom-[4.5rem]" : "bottom-5"}`}>
      <button type="button" aria-pressed={!map} onClick={() => onChange("list")} className={item(!map)}><List className="size-4" aria-hidden />List</button>
      <button type="button" aria-pressed={map} onClick={() => onChange("map")} className={item(map)}><MapIcon className="size-4" aria-hidden />Map</button>
    </div>
  );
}
