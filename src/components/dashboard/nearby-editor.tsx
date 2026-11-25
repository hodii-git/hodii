import { Plus, X } from "lucide-react";
import { Sel } from "@/components/ui/sel";
import { useState } from "react";
import { inputCls } from "@/components/dashboard/ui";
import { LISTING_LIMITS } from "@/lib/mongodb/limits";
import { NEARBY_CATEGORIES } from "@/lib/mongodb/taxonomy";

export type Nearby = { category: (typeof NEARBY_CATEGORIES)[number]["key"]; name: string; distanceM: number | null };

/** "600 m" or "1.2 km". Shared with the listing page. */
export const formatDistance = (m: number | null) => (m === null ? "" : m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)} km`);

function Row({ item, onChange, onRemove, placeholder }: { item: Nearby; onChange: (n: Nearby) => void; onRemove: () => void; placeholder: string }) {
  const [unit, setUnit] = useState<"m" | "km">(item.distanceM !== null && item.distanceM >= 1000 ? "km" : "m");
  const [text, setText] = useState(item.distanceM === null ? "" : String(unit === "km" ? item.distanceM / 1000 : item.distanceM));
  const push = (t: string, u: "m" | "km") => {
    const n = Number(t);
    const meters = t.trim() === "" || !Number.isFinite(n) || n <= 0 ? null : Math.min(LISTING_LIMITS.nearbyMaxMeters, Math.max(10, Math.round(u === "km" ? n * 1000 : n)));
    onChange({ ...item, distanceM: meters });
  };
  return (
    <li className="grid grid-cols-[1fr_5.5rem_4.5rem_auto] items-center gap-2">
      <input aria-label="Name of the place" value={item.name} maxLength={LISTING_LIMITS.nearbyNameMax} placeholder={placeholder} onChange={(e) => onChange({ ...item, name: e.target.value })} className={inputCls} />
      <input aria-label="Distance" inputMode="decimal" value={text} placeholder="Distance" onChange={(e) => { setText(e.target.value); push(e.target.value, unit); }} className={inputCls} />
      <Sel aria-label="Distance unit" value={unit} onChange={(e) => { const u = e.target.value as "m" | "km"; setUnit(u); push(text, u); }} className={inputCls}><option value="m">m</option><option value="km">km</option></Sel>
      <button type="button" onClick={onRemove} aria-label={`Remove ${item.name || "this place"}`} className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted"><X className="h-4 w-4" aria-hidden /></button>
    </li>
  );
}

/** Places of interest near the property. The agent types the exact name and the distance under each heading. */
export function NearbyEditor({ value, onChange }: { value: Nearby[]; onChange: (v: Nearby[]) => void }) {
  const total = value.length;
  return (
    <div className="space-y-6 sm:col-span-2">
      {NEARBY_CATEGORIES.map((c) => {
        const rows = value.map((v, i) => ({ v, i })).filter((r) => r.v.category === c.key);
        return (
          <fieldset key={c.key}>
            <legend className="mb-2 text-sm font-bold text-muted-foreground">{c.label}</legend>
            {rows.length > 0 && <ul className="space-y-2">{rows.map(({ v, i }) => <Row key={i} item={v} placeholder={c.placeholder} onChange={(n) => onChange(value.map((x, k) => (k === i ? n : x)))} onRemove={() => onChange(value.filter((_, k) => k !== i))} />)}</ul>}
            {rows.length < LISTING_LIMITS.nearbyPerCategory && total < LISTING_LIMITS.nearbyMax && (
              <button type="button" onClick={() => onChange([...value, { category: c.key, name: "", distanceM: null }])} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary"><Plus className="h-4 w-4" aria-hidden />Add {c.label.toLowerCase()}</button>
            )}
          </fieldset>
        );
      })}
      <p className="text-xs text-muted-foreground">Use the real name of each place and an honest distance. Up to {LISTING_LIMITS.nearbyPerCategory} in each group and {LISTING_LIMITS.nearbyMax} in all. Empty rows are ignored.</p>
    </div>
  );
}

/** Drops rows with no name, so a half-filled row never blocks saving. */
export const cleanNearby = (v: Nearby[]): Nearby[] => v.filter((n) => n.name.trim().length >= 2).map((n) => ({ ...n, name: n.name.trim() }));
