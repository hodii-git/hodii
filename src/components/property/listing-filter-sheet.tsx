import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { LISTING_TYPES, PROPERTY_TYPES } from "@/lib/mongodb/taxonomy";
import { THEME_PIN } from "@/components/property/listing-map";
import type { PropertyDetail } from "@/lib/property-dto";

const BEDS = [["", "Any"], ["1", "1+"], ["2", "2+"], ["3", "3+"], ["4", "4+"], ["5", "5+"]] as const;
const digits = (s: string) => s.replace(/\D/g, "").slice(0, 11);

/** Quick filters on the phone listing page: pick what you want and jump to the matching search results. */
export function ListingFilterSheet({ p, open, onClose }: { p: PropertyDetail; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [deal, setDeal] = useState<string>(p.listingType);
  const [types, setTypes] = useState<string[]>([p.propertyType]);
  const [beds, setBeds] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [here, setHere] = useState(!!p.location.countySlug);

  // Each time the sheet opens, start from this listing again.
  useEffect(() => {
    if (!open) return;
    setDeal(p.listingType); setTypes([p.propertyType]); setBeds(p.bedrooms && p.bedrooms > 0 ? String(Math.min(p.bedrooms, 5)) : ""); setMin(""); setMax(""); setHere(!!p.location.countySlug);
  }, [open, p.id, p.listingType, p.propertyType, p.bedrooms, p.location.countySlug]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;

  const toggleType = (k: string) => setTypes((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]));
  const apply = () => {
    const search: Record<string, string> = { for: deal };
    if (types.length) search["type"] = types.join(",");
    if (beds) search["beds"] = beds;
    if (min) search["min"] = min;
    if (max) search["max"] = max;
    if (here && p.location.countySlug) search["county"] = p.location.countySlug;
    onClose();
    void navigate({ to: "/properties", search });
  };
  const reset = () => { setDeal(p.listingType); setTypes([]); setBeds(""); setMin(""); setMax(""); setHere(false); };
  const chip = (on: boolean) => `shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[0.95rem] font-semibold transition active:scale-95 ${on ? "border-transparent text-white" : "border-white/15 bg-[#1c1c1f] text-zinc-300"}`;
  const on = { background: THEME_PIN } as const;
  const num = "h-11 w-full rounded-xl border border-white/15 bg-[#1c1c1f] px-3 text-base text-white outline-none placeholder:text-zinc-500 focus:border-white/40";

  return (
    <div className="ld-font fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label="Filters">
      <button type="button" aria-label="Close filters" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[1.6rem] border-t border-white/10 bg-[#141416] text-white shadow-[0_-18px_50px_-20px_rgb(0_0_0/0.9)]">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-lg font-bold">Filters</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-[#26262a] text-white active:scale-95"><X className="size-5" aria-hidden /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-4 pt-2">
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-400">I want</h3>
            <div className="flex flex-wrap gap-2">
              {LISTING_TYPES.map((t) => <button key={t.key} type="button" aria-pressed={deal === t.key} onClick={() => setDeal(t.key)} style={deal === t.key ? on : undefined} className={chip(deal === t.key)}>{t.label}</button>)}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-400">Property type</h3>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((t) => <button key={t.key} type="button" aria-pressed={types.includes(t.key)} onClick={() => toggleType(t.key)} style={types.includes(t.key) ? on : undefined} className={chip(types.includes(t.key))}>{t.label}</button>)}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-400">Bedrooms</h3>
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {BEDS.map(([k, l]) => <button key={l} type="button" aria-pressed={beds === k} onClick={() => setBeds(k)} style={beds === k ? on : undefined} className={chip(beds === k)}>{l}</button>)}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-400">Price (KES)</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="sr-only" htmlFor="lf-min">Minimum price</label>
              <input id="lf-min" inputMode="numeric" value={min} onChange={(e) => setMin(digits(e.target.value))} placeholder="Min" className={num} />
              <label className="sr-only" htmlFor="lf-max">Maximum price</label>
              <input id="lf-max" inputMode="numeric" value={max} onChange={(e) => setMax(digits(e.target.value))} placeholder="Max" className={num} />
            </div>
          </section>
          {p.location.countySlug && (
            <label className="flex items-center gap-3 text-[0.95rem] font-medium text-zinc-200">
              <input type="checkbox" checked={here} onChange={(e) => setHere(e.target.checked)} className="size-5 accent-[#ff385c]" />
              Only in {p.county ?? "this county"}
            </label>
          )}
        </div>
        <div className="flex gap-3 border-t border-white/10 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button type="button" onClick={reset} className="h-12 rounded-full border border-white/15 px-5 text-[0.95rem] font-semibold text-zinc-200 active:scale-95">Reset</button>
          <button type="button" onClick={apply} style={{ background: THEME_PIN }} className="h-12 flex-1 rounded-full text-base font-bold text-white active:scale-[0.98]">Show results</button>
        </div>
      </div>
    </div>
  );
}
