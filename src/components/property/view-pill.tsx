import { List, Map as MapIcon } from "lucide-react";

/** A floating List / Map switch at the bottom centre. It lifts above the compare bar when that is showing, and stays clear of the corner buttons. */
export function ViewPill({ map, onChange }: { map: boolean; onChange: (v: "list" | "map") => void }) {
    const item = (_on: boolean) => "seg";
  return (
    <div data-floating role="group" aria-label="Show listings as" className={`fixed left-1/2 z-30 -translate-x-1/2 seg-pill view-pill`}>
      <button type="button" aria-pressed={!map} onClick={() => onChange("list")} className={item(!map)}><List className="size-4" aria-hidden />List</button>
      <button type="button" aria-pressed={map} onClick={() => onChange("map")} className={item(map)}><MapIcon className="size-4" aria-hidden />Map</button>
    </div>
  );
}
