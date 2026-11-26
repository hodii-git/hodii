import { useEffect, useRef, useState } from "react";
import { BedDouble, BedSingle, Blocks, Briefcase, Building, Building2, Castle, ChevronLeft, ChevronRight, ConciergeBell, Crown, Factory, Fence, GraduationCap, Hotel, House, LandPlot, Landmark, LayoutGrid, Layers, MapPinned, Mountain, Palmtree, Shapes, Sprout, Store, Tent, Tractor, TreePine, Warehouse, type LucideIcon } from "lucide-react";
import { PROPERTY_TYPES } from "@/lib/mongodb/taxonomy";

const ICONS: Record<string, LucideIcon> = {
  apartment: Building2, house: House, maisonette: Layers, bungalow: Tent, townhouse: Building, villa: Palmtree, mansion: Castle, penthouse: Crown,
  cottage: TreePine, bedsitter: BedSingle, studio: BedDouble, serviced_apartment: ConciergeBell, student_hostel: GraduationCap, apartment_block: Blocks,
  office: Briefcase, shop: Store, warehouse: Warehouse, commercial_building: Landmark, industrial: Factory, hotel_lodge: Hotel, other_commercial: Shapes,
  residential_plot: LandPlot, commercial_plot: MapPinned, agricultural_land: Sprout, farm_ranch: Tractor, industrial_land: Fence, other_land: Mountain,
};

/** One row of property-type pills that scrolls sideways with no scrollbar; chevrons appear when there is more to see. */
export function TypePills({ selected, onChange }: { selected: string[] | undefined; onChange: (next: string[] | undefined) => void }) {
  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const measure = () => {
    const el = row.current; if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    const el = row.current; if (!el) return;
    const ro = new ResizeObserver(measure); ro.observe(el);
    const t = window.setTimeout(measure, 400);
    return () => { ro.disconnect(); window.clearTimeout(t); };
  }, []);
  const go = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * Math.max(240, (row.current?.clientWidth ?? 0) * 0.7), behavior: "smooth" });
  const on = (k: string) => !!selected?.includes(k);
  const tab = (active: boolean) => `group relative flex h-[3.25rem] w-[4rem] shrink-0 flex-col items-center justify-center gap-1 whitespace-nowrap px-0.5 text-[0.65rem] font-semibold sm:h-14 sm:w-[4.5rem] sm:text-[0.68rem] lg:w-[4.75rem] lg:text-[0.7rem] transition ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`;
  const bar = (active: boolean) => `absolute inset-x-2.5 bottom-0 h-0.5 rounded-full transition ${active ? "bg-foreground" : "bg-transparent group-hover:bg-black/20"}`;
  const chev = "absolute top-1/2 z-10 hidden size-6 -translate-y-1/2 place-items-center rounded-full glass-chevron md:grid";
  return (
    <div className="relative" data-tour="type-pills">
      {edge.left && <button type="button" aria-label="Scroll left" onClick={() => go(-1)} className={`${chev} left-0`}><ChevronLeft className="size-4" aria-hidden /></button>}
      <div ref={row} onScroll={measure} role="group" aria-label="Property types" className="flex gap-0.5 overflow-x-auto sm:gap-1 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" aria-pressed={!selected?.length} onClick={() => onChange(undefined)} className={tab(!selected?.length)}><LayoutGrid className="size-[1.15rem] sm:size-5" aria-hidden /><span>All</span><span className={bar(!selected?.length)} /></button>
        {PROPERTY_TYPES.map((t) => { const Icon = ICONS[t.key] ?? Building2; const a = on(t.key); return (
          <button key={t.key} type="button" aria-pressed={a} onClick={() => onChange(a ? (selected!.length > 1 ? selected!.filter((x) => x !== t.key) : undefined) : [...(selected ?? []), t.key])} className={tab(a)}>
            <Icon className="size-[1.15rem] sm:size-5" strokeWidth={a ? 2.2 : 1.7} aria-hidden /><span className="max-w-full truncate">{t.label.split(" or ")[0]}</span><span className={bar(a)} />
          </button>); })}
      </div>
      {edge.right && <button type="button" aria-label="Scroll right" onClick={() => go(1)} className={`${chev} right-0`}><ChevronRight className="size-4" aria-hidden /></button>}
    </div>
  );
}
