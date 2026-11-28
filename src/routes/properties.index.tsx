import { PROPERTY_TYPES } from "@/lib/mongodb/taxonomy";
import { PropertyGridSkeleton } from "@/components/property/property-card";
import { CLEAR_ALL } from "@/lib/criteria-chips";
import { LoaderBlock } from "@/components/loader";
import { X } from "lucide-react";
import { RadiusEditor } from "@/components/property/radius-editor";
import { ShareButton } from "@/components/share-button";
import { ViewPill } from "@/components/property/view-pill";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { searchHeading } from "@/lib/search-title";
import { Pick } from "@/components/ui/pick";
import { lazy, Suspense, useEffect, useState } from "react";
import { HomeSearch } from "@/components/home/home-search";
import { ExploreBar } from "@/components/property/explore-bar";
import { SaveSearchButton } from "@/components/property/save-search";
import { InfiniteResults } from "@/components/property/infinite-results";
import { LayoutPill } from "@/components/property/layout-pill";
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
  // "3 properties in Kenya for rent in Kiambu": the number leads the title once results are in.
  const total = !result || result.unavailable ? null : result.nearest ? 0 : result.total;
  const countTitle = total === null ? heading.title : (() => {
    const t = heading.title; const one = total === 1;
    const lead = t.replace(/^(\d+\+ bedroom )?(\S+)/, (_m, b: string | undefined, w: string) => `${b ?? ""}${one ? (PROPERTY_TYPES.find((x) => x.plural === w)?.label ?? (w === "Properties" ? "Property" : w)) : w}`);
    return `${total.toLocaleString("en-KE")} ${lead.charAt(0).toLowerCase()}${lead.slice(1)}`;
  })();
  const aiResult = result && !result.unavailable ? { total: result.nearest ? 0 : result.total, ...(result.nearest ? { nearest: result.nearest } : {}), loading: updating } : undefined;
  const map = search.view === "map";
  const [wide, setWide] = useState(false);
  useEffect(() => { const r = document.documentElement; if (map && wide) r.setAttribute("data-mapside", ""); else r.removeAttribute("data-mapside"); return () => r.removeAttribute("data-mapside"); }, [map, wide]);
  useEffect(() => { const mq = window.matchMedia("(min-width: 1024px)"); const f = () => setWide(mq.matches); f(); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  const change = (next: Partial<SearchParams>) => navigate({ search: { ...urlFromParams({ ...params, ...next }), ...(map ? { view: "map" } : {}) }, resetScroll: next.page === undefined });
  const setView = (v: "list" | "map") => navigate({ search: { ...urlFromParams(params), ...(v === "map" ? { view: "map" } : {}) } });
  // Drawing a new area replaces the old one; an empty object clears it.
  const setGeo = (g: Pick<SearchParams, "circle" | "polygon">) => change({ circle: undefined, polygon: undefined, ...g, page: 1 });

  return (
    <main className="props-page pt-[calc(var(--head-h,9.75rem)+1rem)] pb-24 max-sm:px-4 lg:pt-[calc(var(--head-h,11rem)+1.5rem)]">
      {!(map && wide) && <div className="mx-auto max-w-[112rem]">
        <div className="mx-auto mt-4 max-w-4xl lg:hidden"><HomeSearch value={params} onChange={change} result={aiResult} /></div>
      </div>}
      <div className={`mx-auto mt-6 max-w-[112rem] md:mt-8 ${map ? "lg:pr-[35.5rem]" : ""}`}>
      {map && <aside className="map-aside max-lg:mb-6 lg:fixed lg:bottom-4 lg:right-4 lg:top-[calc(var(--head-h,6rem)+0.75rem)] lg:z-30 lg:flex lg:w-[34rem] lg:flex-col lg:gap-3 xl:right-[max(1rem,calc((100vw-112rem)/2+1rem))]">
        <Suspense fallback={<LoaderBlock className="py-10" />}><SearchMap params={params} onGeo={setGeo} /></Suspense>
        {wide && <div className="flex min-h-0 flex-1 flex-col"><HomeSearch pinned value={params} onChange={change} result={aiResult} /></div>}
      </aside>}
      <div className="min-w-0">
      <div className="mb-4 lg:mb-5"><ExploreBar value={params} onChange={change} result={aiResult} /></div>
      <div className="-mt-1 mb-3 md:flex md:items-end md:justify-between md:gap-4">
        <div className="min-w-0">
          <h1 title={countTitle} className="line-clamp-1 font-display text-xl font-extrabold leading-tight">{countTitle}</h1>
          {heading.subtitle && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{heading.subtitle}</p>}
        </div>
        <div className="flex flex-nowrap items-center justify-end gap-2 overflow-x-auto pb-1 pt-3 [scrollbar-width:none] md:shrink-0 md:pt-0 sm:gap-3 [&::-webkit-scrollbar]:hidden">
          <span data-tour="layout" className="inline-flex"><LayoutPill /></span>
          <SaveSearchButton params={params} />
          <ShareButton title={heading.title} />
          <div className="w-36 shrink-0 sm:w-44"><Pick label="Sort by" pillText="Sort by" value={params.sort} onChange={(v) => change({ sort: v as SearchParams["sort"], page: 1 })} options={SORTS.map(([k, l]) => ({ value: k, label: l }))} className="h-10" /></div>
        </div>
      </div>
      {!map && (params.circle || params.polygon) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
          <span className="text-sm font-bold">{params.circle ? "Within" : "Inside the area you drew"}</span>
          {params.circle && <RadiusEditor radiusM={params.circle.radiusM} onChange={(m) => change({ circle: { ...params.circle!, radiusM: m }, page: 1 })} compact />}
          {params.circle && <span className="text-sm text-muted-foreground">of your pin</span>}
          <button type="button" onClick={() => setView("map")} className="ml-auto text-sm font-bold text-primary underline">Edit on map</button>
          <button type="button" onClick={() => setGeo({})} aria-label="Remove area" className="close-circle"><X className="size-4" aria-hidden /></button>
        </div>
      )}
      <div className={`mt-4 transition-opacity ${updating ? "opacity-60" : ""}`} aria-busy={updating}>
        {result ? <InfiniteResults onClearAll={() => change({ ...CLEAR_ALL, circle: undefined, polygon: undefined, page: 1 })} first={result} unavailable={result.unavailable} resetKey={JSON.stringify({ ...urlFromParams({ ...params, page: 1 }) })} fetchPage={(page) => searchListings({ data: { ...params, page } })} />
          : q.isError ? <p role="alert" className="rounded-2xl border border-border p-6 text-center text-muted-foreground">Could not load results. <button type="button" className="font-bold underline" onClick={() => q.refetch()}>Try again</button></p>
          : <PropertyGridSkeleton count={8} />}
      </div>
      </div>
      </div>
    <ViewPill map={map} onChange={setView} />
    </main>
  );
}
