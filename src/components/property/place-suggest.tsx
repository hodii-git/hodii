import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Landmark, MapPin } from "lucide-react";
import { suggestPlaces } from "@/lib/places.functions";
import type { PlaceHit } from "@/lib/places.server";
import { understand } from "@/lib/query-intent";

/** The words in the box that look like a place: what is left once prices, bedrooms and the like are read out. */
export const placeWords = (text: string) => understand(text.trim()).leftover.trim();

/** Suggestions for the place being typed, from counties, areas with listings and map data. Shows nothing until there is something to offer. */
export function PlaceSuggest({ text, onPick }: { text: string; onPick: (hit: PlaceHit) => void }) {
  const words = placeWords(text);
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(words), 250); return () => clearTimeout(t); }, [words]);
  const [hidden, setHidden] = useState("");
  const on = debounced.length >= 3 && debounced === words && hidden !== debounced;
  const q = useQuery({ queryKey: ["places", debounced], queryFn: () => suggestPlaces({ data: { q: debounced } }) as Promise<PlaceHit[]>, enabled: on, staleTime: 120_000 });
  const hits = (on ? q.data : undefined) ?? [];
  if (!hits.length) return null;
  const icon = { county: Landmark, area: Building2, place: MapPin } as const;
  return (
    <div role="listbox" aria-label="Place suggestions" className="mt-2 w-full overflow-hidden rounded-2xl border border-border bg-background/85 shadow-sm">
      <p className="px-4 pb-1 pt-2.5 text-xs font-bold uppercase text-muted-foreground">Did you mean one of these places?</p>
      <ul>
        {hits.map((h) => { const I = icon[h.kind]; return (
          <li key={h.id}>
            <button type="button" role="option" aria-selected={false} onClick={() => { setHidden(debounced); onPick(h); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><I className="size-4" aria-hidden /></span>
              <span className="min-w-0"><span className="block truncate font-semibold">{h.label}</span><span className="block truncate text-xs text-muted-foreground">{h.detail}</span></span>
            </button>
          </li>
        ); })}
      </ul>
    </div>
  );
}
