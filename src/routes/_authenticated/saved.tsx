import { useState } from "react";
import { Sel } from "@/components/ui/sel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PropertyGrid } from "@/components/property/property-card";
import { FREQUENCY_LABEL, nameSearch } from "@/components/property/save-search";
import { deleteSavedSearch, getSavedSearches, updateSavedSearch } from "@/lib/notifications.functions";
import { getSavedListings } from "@/lib/properties.functions";
import { urlFromParams } from "@/lib/search-url";
import { ALERT_FREQUENCIES } from "@/lib/mongodb/taxonomy";

const savedQuery = queryOptions({ queryKey: ["saved", "list"], queryFn: () => getSavedListings(), staleTime: 15_000, refetchInterval: 60_000 });
const searchesQuery = queryOptions({ queryKey: ["saved", "searches"], queryFn: () => getSavedSearches(), staleTime: 15_000 });

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({ meta: [{ title: "Saved — Hodii" }, { name: "robots", content: "noindex" }] }),
  component: SavedPage,
});

function SavedPage() {
  const [tab, setTab] = useState<"properties" | "searches">("properties");
  const saved = useQuery(savedQuery);
  const searches = useQuery(searchesQuery);
  return (
    <main className="mx-auto max-w-[112rem] px-4 pt-28 pb-24">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Saved</h1>
      <p className="mt-1 text-muted-foreground">Properties you saved, and searches we watch for you. New matches and price drops appear in your notifications.</p>
      <div className="mt-6 inline-flex rounded-full bg-muted p-1" role="tablist">
        {([["properties", "Properties", Heart, saved.data?.items.length], ["searches", "Searches", Search, searches.data?.length]] as const).map(([k, l, Icon, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold ${tab === k ? "bg-background shadow-sm" : "text-muted-foreground"}`}><Icon className="h-4 w-4" aria-hidden />{l}{n ? <span className="text-xs text-muted-foreground">{n}</span> : null}</button>
        ))}
      </div>
      {tab === "properties" ? (
        <section className="mt-8" aria-label="Saved properties">
          {saved.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : saved.isError ? <p role="alert" className="text-sm text-destructive">Could not load your saved properties.</p> : (
            <>
              {saved.data.unavailable > 0 && <p className="mb-3 text-sm text-muted-foreground">{saved.data.unavailable} saved {saved.data.unavailable === 1 ? "property is" : "properties are"} no longer available.</p>}
              <PropertyGrid items={saved.data.items} saved={new Set(saved.data.items.map((i) => i.id))} empty={<div className="empty-card"><p className="text-sm font-semibold text-muted-foreground">Tap the heart on any listing to keep it here. We will tell you if its price drops.</p></div>} />
            </>
          )}
        </section>
      ) : (
        <section className="mt-8 max-w-3xl" aria-label="Saved searches"><SearchList query={searches} /></section>
      )}
    </main>
  );
}

function SearchList({ query }: { query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof getSavedSearches>>>> }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["saved", "searches"] });
  const update = useMutation({ mutationFn: (v: { id: string; frequency: (typeof ALERT_FREQUENCIES)[number] }) => updateSavedSearch({ data: v }), onSuccess: refresh, onError: (e) => toast.error((e as Error).message) });
  const remove = useMutation({ mutationFn: (id: string) => deleteSavedSearch({ data: { id } }), onSuccess: () => { toast.success("Search deleted"); refresh(); }, onError: (e) => toast.error((e as Error).message) });
  if (query.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!query.data?.length) return <div className="empty-card"><p className="text-sm font-semibold text-muted-foreground">No saved searches yet. Search for properties, then tap “Save search”.</p><Link to="/properties" className="mt-3 inline-block font-bold text-primary underline">Search properties</Link></div>;
  return (
    <ul className="grid gap-3">
      {query.data.map((s) => (
        <li key={s.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
          <Link to="/properties" search={urlFromParams(s.criteria)} className="min-w-0 font-bold hover:underline"><span className="block truncate">{s.name}</span><span className="block truncate text-xs font-normal text-muted-foreground">{nameSearch(s.criteria)}</span></Link>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`f-${s.id}`}>How often</label>
            <Sel id={`f-${s.id}`} value={s.frequency} onChange={(e) => update.mutate({ id: s.id, frequency: e.target.value as (typeof ALERT_FREQUENCIES)[number] })} className="h-9 rounded-xl border border-input bg-background px-2 text-sm">
              {ALERT_FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
            </Sel>
            <button type="button" aria-label={`Delete ${s.name}`} onClick={() => remove.mutate(s.id)} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        </li>
      ))}
    </ul>
  );
}
