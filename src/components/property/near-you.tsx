import { useEffect, useState, useSyncExternalStore } from "react";
import { COUNTY_OPTIONS } from "@/lib/pick-options";
import { Pick } from "@/components/ui/pick";
import { useQuery } from "@tanstack/react-query";
import { LocateFixed, MapPin, X } from "lucide-react";
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

export function LocationBar({ label, onChange }: { label: string | null; onChange: (p: HomePlace | null) => void }) {
  const [open, setOpen] = useState(false);
  const locate = () => {
    if (!navigator.geolocation) { toast.error("Your browser can't share a location"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { onChange({ lat: Math.round(pos.coords.latitude * 1000) / 1000, lng: Math.round(pos.coords.longitude * 1000) / 1000 }); setOpen(false); },
      () => toast.error("We couldn't get your location. Choose a county instead."),
      { maximumAge: 600_000, timeout: 8000 },
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="inline-flex items-center gap-1.5 font-semibold"><MapPin className="h-4 w-4 text-primary" aria-hidden />{label ? <>Showing listings near <strong>{label}</strong></> : "Showing listings across Kenya"}</span>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="rounded-full border border-border px-3 py-1 font-semibold hover:bg-muted">Change</button>
      {open && (
        <div className="glass-strong flex w-full flex-wrap items-center gap-2 rounded-2xl p-3 sm:w-auto" role="group" aria-label="Choose where to look">
          <label className="sr-only" htmlFor="home-county">County</label>
          <div className="w-56"><Pick id="home-county" label="County" clearLabel="Choose a county…" value="" onChange={(v) => { if (v) { onChange({ countyCode: Number(v) }); setOpen(false); } }} options={COUNTY_OPTIONS} searchable className="h-10" /></div>
          <button type="button" onClick={locate} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 font-semibold text-primary-foreground"><LocateFixed className="h-4 w-4" aria-hidden />Use my location</button>
          <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="inline-flex h-10 items-center gap-1 rounded-xl px-3 font-semibold hover:bg-muted"><X className="h-4 w-4" aria-hidden />Reset</button>
        </div>
      )}
    </div>
  );
}
