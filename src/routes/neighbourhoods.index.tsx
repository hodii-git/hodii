import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { Stars } from "@/components/agency/stars";
import { Pick } from "@/components/ui/pick";
import { Pager } from "@/components/property/results";
import { COUNTY_OPTIONS } from "@/lib/pick-options";
import { ASPECTS, ASPECT_KEYS, aspectLabel, type AspectKey } from "@/lib/neighbourhood";
import { neighbourhoodsQuery } from "@/lib/neighbourhoods.functions";

type Sort = "rating" | "reviews" | "listings" | "name";
type Search = { q?: string | undefined; county?: number | undefined; sort?: Sort | undefined; min?: number | undefined; aspect?: AspectKey | undefined; amin?: number | undefined; page?: number | undefined };
const SORTS: [Sort, string][] = [["rating", "Best rated"], ["reviews", "Most reviewed"], ["listings", "Most listings"], ["name", "A to Z"]];
const toParams = (s: Search) => ({ ...(s.q ? { q: s.q } : {}), ...(s.county ? { countyCode: s.county } : {}), sort: s.sort ?? "rating", ...(s.min ? { minRating: s.min } : {}), ...(s.aspect && s.amin ? { aspect: s.aspect, minAspect: s.amin } : {}), page: s.page ?? 1 });
const MINS = [{ value: "", label: "Any rating" }, { value: "3", label: "3 stars and up" }, { value: "4", label: "4 stars and up" }, { value: "4.5", label: "4.5 stars and up" }];

export const Route = createFileRoute("/neighbourhoods/")({
  validateSearch: (s): Search => {
    const n = (v: unknown, max: number) => { const x = Number(v); return Number.isFinite(x) && x >= 1 && x <= max ? x : undefined; };
    return {
      ...(typeof s["q"] === "string" && s["q"].trim() ? { q: s["q"].trim().slice(0, 60) } : {}), ...(n(s["county"], 47) ? { county: Math.floor(n(s["county"], 47)!) } : {}),
      ...(SORTS.some(([k]) => k === s["sort"]) ? { sort: s["sort"] as Sort } : {}), ...(n(s["min"], 5) ? { min: n(s["min"], 5)! } : {}),
      ...(ASPECT_KEYS.includes(s["aspect"] as AspectKey) ? { aspect: s["aspect"] as AspectKey } : {}), ...(n(s["amin"], 5) ? { amin: n(s["amin"], 5)! } : {}), ...(n(s["page"], 100) && n(s["page"], 100)! > 1 ? { page: Math.floor(n(s["page"], 100)!) } : {}),
    };
  },
  head: () => ({ meta: [{ title: "Neighbourhoods in Kenya: ratings, reviews and chat — Hodii" }, { name: "description", content: "Compare neighbourhoods by security, amenities, transport and more, read what residents say and join the conversation." }] }),
  component: Page,
});

const field = "h-11 rounded-xl border border-input bg-background px-3 text-sm";

function Page() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/neighbourhoods/" });
  const set = (next: Partial<Search>) => navigate({ search: { ...search, ...next, page: next.page } as Search });
  const { data, isPending, isError } = useQuery({ ...neighbourhoodsQuery(toParams(search)), placeholderData: keepPreviousData });
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= 3 ? p : [...p, k]));
  return (
    <main className="mx-auto max-w-[112rem] px-4 pt-28 pb-32">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">Neighbourhoods</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Find the right area, not just the right house. Ratings and chat come from people who know the place.</p>
      <form role="search" aria-label="Search neighbourhoods" onSubmit={(e) => { e.preventDefault(); set({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() || undefined }); }} className="mt-6 flex flex-wrap gap-3">
        <input name="q" type="search" defaultValue={search.q ?? ""} key={search.q ?? ""} placeholder="Area or county" aria-label="Area or county" className={`${field} min-w-48 flex-1`} />
        <Pick label="County" clearLabel="All counties" value={search.county ? String(search.county) : ""} onChange={(v) => set({ county: v ? Number(v) : undefined })} options={COUNTY_OPTIONS} searchable />
        <Pick label="Rating" value={search.min ? String(search.min) : ""} onChange={(v) => set({ min: v ? Number(v) : undefined })} options={MINS} />
        <Pick label="Strong in" clearLabel="Anything" value={search.aspect ?? ""} onChange={(v) => set({ aspect: (v || undefined) as AspectKey | undefined, amin: v ? search.amin ?? 4 : undefined })} options={ASPECTS.map((a) => ({ value: a.key, label: a.label }))} />
        {search.aspect && <Pick label={`${aspectLabel(search.aspect)} score`} value={String(search.amin ?? 4)} onChange={(v) => set({ amin: Number(v) })} options={[{ value: "3", label: "3 and up" }, { value: "4", label: "4 and up" }, { value: "4.5", label: "4.5 and up" }]} />}
        <Pick label="Sort by" value={search.sort ?? "rating"} onChange={(v) => set({ sort: v as Sort })} options={SORTS.map(([k, l]) => ({ value: k, label: l }))} />
        <button className="h-11 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">Search</button>
      </form>
      {isPending ? <div className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />)}</div>
        : isError || !data ? <p role="alert" className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">Could not load neighbourhoods. Please try again.</p>
        : <>
          <p className="mt-6 text-sm font-semibold text-muted-foreground" aria-live="polite">{data.total.toLocaleString("en-KE")} {data.total === 1 ? "neighbourhood" : "neighbourhoods"}. Tick up to 3 to compare.</p>
          {data.items.length === 0 ? <p className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">Nothing matches. Try a lower rating or clear a filter.</p> : (
            <ul className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]">
              {data.items.map((n) => (
                <li key={n.key} className="relative flex min-w-0 flex-col rounded-2xl border border-border p-4 transition hover:shadow-sm">
                  <Link to="/neighbourhoods/$county/$area" params={{ county: n.countySlug, area: n.areaSlug }} className="min-w-0">
                    <span className="block truncate text-lg font-extrabold">{n.name}</span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4 shrink-0" aria-hidden /><span className="truncate">{n.county}</span></span>
                    <span className="mt-2 flex items-center gap-2 text-sm">{n.summary.overall ? <><Stars value={n.summary.overall} size={14} /><span className="font-bold">{n.summary.overall.toFixed(1)}</span><span className="text-muted-foreground">({n.summary.count})</span></> : <span className="text-muted-foreground">No reviews yet</span>}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{n.listings} {n.listings === 1 ? "listing" : "listings"}{n.summary.aspects.security ? ` · Security ${n.summary.aspects.security.avg.toFixed(1)}` : ""}</span>
                  </Link>
                  <label className="mt-3 flex items-center gap-2 text-xs font-bold"><input type="checkbox" className="size-4" checked={picked.includes(n.key)} disabled={!picked.includes(n.key) && picked.length >= 3} onChange={() => toggle(n.key)} />Compare</label>
                </li>
              ))}
            </ul>
          )}
          <Pager page={search.page ?? 1} pageSize={data.pageSize} total={data.total} onPage={(page) => { set({ page: page > 1 ? page : undefined }); window.scrollTo({ top: 0 }); }} />
        </>}
      {picked.length >= 2 && (
        <div data-floating className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
          <Link to="/neighbourhoods/compare" search={{ a: picked.join(",") }} className="inline-flex h-12 items-center rounded-full bg-foreground px-6 text-sm font-bold text-background shadow-xl">Compare {picked.length} neighbourhoods</Link>
        </div>
      )}
    </main>
  );
}
