import { LoaderBlock } from "@/components/loader";
import { X } from "lucide-react";
import { RadiusEditor } from "@/components/property/radius-editor";
import { ShareButton } from "@/components/share-button";
import { ViewPill } from "@/components/property/view-pill";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { searchHeading } from "@/lib/search-title";
import { Pick } from "@/components/ui/pick";
import { lazy, Suspense } from "react";
import { SaveSearchButton } from "@/components/property/save-search";
import { InfiniteResults } from "@/components/property/infinite-results";
import { SearchForm } from "@/components/property/search-form";
import { absUrl } from "@/lib/site";
import { searchListings, searchQuery } from "@/lib/properties.functions";
import { paramsFromUrl, urlFromParams, type SearchUrl } from "@/lib/search-url";
import { listingTypeLabel } from "@/lib/format";
import { COUNTY_LIST } from "@/lib/mongodb/kenya";
import type { SearchParams } from "@/lib/listing-search";

const SearchMap = lazy(() => import("@/components/property/search-map").then((m) => ({ default: m.SearchMap })));
const KEYS = ["q", "for", "cat", "type", "county", "area", "min", "max", "beds", "baths", "sqmMin", "sqmMax", "features", "furnishing", "cond", "verified", "sort", "page", "lat", "lng", "r", "poly", "view"] as const;
const SORTS = [["relevance", "Best match"], ["newest", "Newest"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"], ["size_desc", "Largest"]] as const;

export const Route = createFileRoute("/properties/")({
  validateSearch: (s): SearchUrl => Object.fromEntries(KEYS.flatMap((k) => (typeof s[k] === "string" || typeof s[k] === "number" ? [[k, String(s[k])]] : []))),
  loaderDeps: ({ search }) => ({ search }),
  // On the server the first page is ready before the page is sent. In the browser a new search never blocks: the page stays as it is
  // and the new results slide in when they arrive, so typing and clicking filters never reload the screen.
  loader: ({ deps, context }) => {
    const q = searchQuery(paramsFromUrl(deps.search));
    if (typeof window === "undefined") return context.queryClient.ensureQueryData(q);
    void context.queryClient.prefetchQuery(q);
    return undefined;
  },
  head: ({ match }) => {
    const p = paramsFromUrl(match.search as SearchUrl);
    const title = `${searchHeading(p).title} | Hodii`;
    const desc = "Browse homes, land and commercial property across Kenya from verified agents and owners.";
    return {
      meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
        // Filtered and paged searches are not indexed; the plain listing page is.
        ...(Object.keys(match.search).length ? [{ name: "robots", content: "noindex, follow" }] : [])],
      links: [{ rel: "canonical", href: absUrl("/properties") }],
    };
  },
  component: PropertiesPage,
});

function PropertiesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/properties/" });
  const params = paramsFromUrl(search);
  const q = useQuery({ ...searchQuery(params), placeholderData: keepPreviousData });
  const result = q.data;
  const updating = q.isPlaceholderData || (q.isFetching && !!result);
  const heading = searchHeading(params);
  const map = search.view === "map";
  const change = (next: Partial<SearchParams>) => navigate({ search: { ...urlFromParams({ ...params, ...next }), ...(map ? { view: "map" } : {}) }, resetScroll: next.page === undefined });
  const setView = (v: "list" | "map") => navigate({ search: { ...urlFromParams(params), ...(v === "map" ? { view: "map" } : {}) } });
  // Drawing a new area replaces the old one; an empty object clears it.
  const setGeo = (g: Pick<SearchParams, "circle" | "polygon">) => change({ circle: undefined, polygon: undefined, ...g, page: 1 });

  return (
    <main className="mx-auto max-w-[82rem] px-4 pt-28 pb-24">
      <div className="lg:hidden">
      <h1  className="text-2xl font-extrabold tracking-tight md:text-3xl">{heading.title}</h1>
      <p className="mt-2 text-muted-foreground">{heading.subtitle}</p>
      </div>
      <div className="mt-6 lg:mt-0 lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <aside aria-label="Filters"><SearchForm value={params} onChange={change} side /></aside>
      <div className="min-w-0">
        <div className="mb-6 hidden lg:block">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{heading.title}</h1>
      <p className="mt-2 text-muted-foreground">{heading.subtitle}</p>
        </div>
      <div className="mt-8 lg:mt-0 flex flex-wrap items-center gap-3">
        <p className="mr-auto text-sm font-semibold text-muted-foreground" aria-live="polite">{!result || result.unavailable ? (updating || q.isPending ? "Searching…" : "") : `${result.total.toLocaleString("en-KE")} ${result.total === 1 ? "property" : "properties"}`}</p>
        <SaveSearchButton params={params} />
        <ShareButton title={heading.title} />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort by</span>
          <div className="w-48"><Pick label="Sort by" value={params.sort} onChange={(v) => change({ sort: v as SearchParams["sort"], page: 1 })} options={SORTS.map(([k, l]) => ({ value: k, label: l }))} className="h-10" /></div>
        </label>
      </div>
      {map && <div className="mt-4"><Suspense fallback={<LoaderBlock className="py-10" />}><SearchMap params={params} onGeo={setGeo} /></Suspense></div>}
      {!map && (params.circle || params.polygon) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
          <span className="text-sm font-bold">{params.circle ? "Within" : "Inside the area you drew"}</span>
          {params.circle && <RadiusEditor radiusM={params.circle.radiusM} onChange={(m) => change({ circle: { ...params.circle!, radiusM: m }, page: 1 })} compact />}
          {params.circle && <span className="text-sm text-muted-foreground">of your pin</span>}
          <button type="button" onClick={() => setView("map")} className="ml-auto text-sm font-bold text-primary underline">Edit on map</button>
          <button type="button" onClick={() => setGeo({})} aria-label="Remove area" className="grid size-8 place-items-center rounded-full border border-input hover:bg-muted"><X className="size-4" aria-hidden /></button>
        </div>
      )}
      <div className={`mt-4 transition-opacity ${updating ? "opacity-60" : ""}`} aria-busy={updating}>
        {result ? <InfiniteResults first={result} unavailable={result.unavailable} resetKey={JSON.stringify({ ...urlFromParams({ ...params, page: 1 }) })} fetchPage={(page) => searchListings({ data: { ...params, page } })} />
          : q.isError ? <p role="alert" className="rounded-2xl border border-border p-6 text-center text-muted-foreground">Could not load results. <button type="button" className="font-bold underline" onClick={() => q.refetch()}>Try again</button></p>
          : <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]" aria-label="Loading results">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}</div>}
      </div>
      </div>
      </div>
    <ViewPill map={map} onChange={setView} />
    </main>
  );
}
