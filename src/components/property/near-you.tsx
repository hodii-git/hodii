import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { COUNTY_OPTIONS } from "@/lib/pick-options";
import { Pick } from "@/components/ui/pick";
import { LayoutPill } from "./layout-pill";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, LocateFixed, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { getNearbyHome } from "@/lib/properties.functions";
import { COUNTY_LIST } from "@/lib/mongodb/kenya";
import type { Scope } from "@/lib/home-nearby.server";

/** What the visitor chose for the home page. Kept in this browser only. */
export type HomePlace = { areaSlug?: string; countyCode?: number; lat?: number; lng?: number };
const KEY = "hodii:home-place";
const listeners = new Set<() => void>();
let cached: string | null | undefined;

const read = () => {
  if (cached === undefined) { try { cached = localStorage.getItem(KEY); } catch { cached = null; } }
  return cached;
};
const write = (p: HomePlace | null) => {
  cached = p ? JSON.stringify(p) : null;
  try { if (cached) localStorage.setItem(KEY, cached); else localStorage.removeItem(KEY); } catch { /* storage blocked: the choice lasts until the page closes */ }
  listeners.forEach((l) => l());
};

export function useHomePlace() {
  const raw = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, read, () => null);
  let place: HomePlace | null = null;
  try { place = raw ? (JSON.parse(raw) as HomePlace) : null; } catch { place = null; }
  return [place, write] as const;
}

/** Local lists for the visitor's place, or nothing while loading or when we can't tell where they are. */
export function useNearbyHome() {
  const [place, setPlace] = useHomePlace();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const q = useQuery({
    queryKey: ["home-nearby", place],
    queryFn: () => getNearbyHome({ data: place ?? {} }),
    enabled: ready,
    staleTime: 120_000,
  });
  return { place, setPlace, nearby: q.data?.place ? q.data : null, loading: !ready || q.isPending };
}

/** "Kilimani, Nairobi and nearby": names the widest place the list had to reach. */
export function scopeText(scopes: Scope[]) {
  if (scopes.length === 0) return "";
  const names = scopes.filter((s) => s.level !== "country").map((s) => s.label);
  const widest = scopes[scopes.length - 1]!;
  if (widest.level === "country") return names.length ? `${names.join(", ")} and across Kenya` : "across Kenya";
  return names.length > 1 ? `${names[0]} and nearby` : names[0] ?? "";
}

type GeoFilters = { countyCodes?: number[] | undefined; circle?: { lat: number; lng: number; radiusM: number } | undefined; polygon?: undefined };

/** "Showing listings near …" with a frosted Change pill. Choices also fill the search filters when onFilters is given. */
export function LocationBar({ label, onChange, onFilters }: { label: string | null; onChange: (p: HomePlace | null) => void; onFilters?: (f: GeoFilters) => void }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const locate = () => {
    if (!navigator.geolocation) { toast.error("Your browser can't share a location"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 1000) / 1000, lng = Math.round(pos.coords.longitude * 1000) / 1000;
        onChange({ lat, lng }); onFilters?.({ circle: { lat: pos.coords.latitude, lng: pos.coords.longitude, radiusM: 5000 }, countyCodes: undefined, polygon: undefined }); setOpen(false);
      },
      () => toast.error("We couldn't get your location. Choose a county instead."),
      { maximumAge: 600_000, timeout: 8000 },
    );
  };
  return (
    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
    <div ref={anchor} className="relative min-w-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`glass-menu pill-lift group inline-flex h-10 items-center gap-2 rounded-full pl-2 pr-4 text-sm ${open ? "ring-2 ring-ring/30" : ""}`}>
        <span className="grid size-7 place-items-center rounded-full bg-foreground text-background"><MapPin className="size-3.5" aria-hidden /></span>
        <span className="text-muted-foreground">Near</span>
        <strong className="max-w-[12rem] truncate font-semibold">{label ?? "All of Kenya"}</strong>
        <ChevronDown className={`size-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <FloatingPanel anchor={anchor} open={open} onClose={() => setOpen(false)} minWidth={300} className="!rounded-3xl !p-3">
        <div role="group" aria-label="Choose where to look" className="space-y-2">
          <p className="px-1 text-[0.7rem] font-bold uppercase text-muted-foreground">Where to look</p>
          <button type="button" onClick={locate} className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition hover:bg-foreground/5">
            <span className="grid size-8 place-items-center rounded-full bg-foreground text-background"><LocateFixed className="size-4" aria-hidden /></span>Use my location
          </button>
          <label className="sr-only" htmlFor="home-county">County</label>
          <Pick id="home-county" label="County" clearLabel="Choose a county…" value="" panelClassName="glass-menu" onChange={(v) => { if (v) { onChange({ countyCode: Number(v) }); onFilters?.({ countyCodes: [Number(v)], circle: undefined, polygon: undefined }); setOpen(false); } }} options={COUNTY_OPTIONS} searchable className="input-glass !h-11 !rounded-2xl !border-0 !px-3 !text-sm" />
          {label && <button type="button" onClick={() => { onChange(null); onFilters?.({ countyCodes: undefined, circle: undefined, polygon: undefined }); setOpen(false); }} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"><X className="size-4" aria-hidden />Show all of Kenya</button>}
        </div>
      </FloatingPanel>
    </div>
    <LayoutPill />
    </div>
  );
}
