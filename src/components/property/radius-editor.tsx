import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { RADIUS_PRESETS, radiusLabel } from "@/lib/geo";

export const MIN_RADIUS_M = 500;
export const MAX_RADIUS_M = 100_000;
export const clampRadius = (m: number) => Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(m / 100) * 100));
/** The −/+ step grows with the distance, so going from 500 m to 50 km does not take a hundred taps. */
export const radiusStep = (m: number) => (m < 2000 ? 250 : m < 10_000 ? 500 : m < 30_000 ? 2000 : 5000);

/** Type a distance in km, or use − / + or a preset. Used on the map and in the list view, so the same area is edited the same way everywhere. */
export function RadiusEditor({ radiusM, onChange, compact = false }: { radiusM: number; onChange: (m: number) => void; compact?: boolean }) {
  const [text, setText] = useState(String(radiusM / 1000));
  useEffect(() => setText(String(radiusM / 1000)), [radiusM]);
  const commit = () => {
    const n = Number(text.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) { setText(String(radiusM / 1000)); return; }
    const m = clampRadius(n * 1000);
    setText(String(m / 1000));
    if (m !== radiusM) onChange(m);
  };
  const btn = "grid h-8 w-8 shrink-0 place-items-center rounded-full border border-input bg-background hover:bg-muted disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Search radius">
      <button type="button" className={btn} aria-label="Smaller radius" disabled={radiusM <= MIN_RADIUS_M} onClick={() => onChange(clampRadius(radiusM - radiusStep(radiusM - 1)))}><Minus className="size-4" aria-hidden /></button>
      <label className="flex h-8 items-center gap-1 rounded-full border border-input bg-background px-3 text-[0.8125rem] font-bold focus-within:ring-2 focus-within:ring-ring">
        <span className="sr-only">Radius in kilometres</span>
        <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} className="w-12 bg-transparent text-right outline-hidden" />
        <span className="text-muted-foreground">km</span>
      </label>
      <button type="button" className={btn} aria-label="Larger radius" disabled={radiusM >= MAX_RADIUS_M} onClick={() => onChange(clampRadius(radiusM + radiusStep(radiusM)))}><Plus className="size-4" aria-hidden /></button>
      {!compact && RADIUS_PRESETS.map((r) => <button key={r} type="button" aria-pressed={radiusM === r} onClick={() => onChange(r)} className={`h-7 rounded-full border px-2.5 text-xs font-bold ${radiusM === r ? "border-primary bg-primary/10 text-primary" : "border-input"}`}>{radiusLabel(r)}</button>)}
    </div>
  );
}
