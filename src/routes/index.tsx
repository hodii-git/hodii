import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { searchHeading } from "@/lib/search-title";
import { LocationBar, scopeText, useNearbyHome } from "@/components/property/near-you";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { LayoutPill } from "@/components/property/layout-pill";
import { HomeSearch } from "@/components/home/home-search";
import { ExploreBar } from "@/components/property/explore-bar";
import { ViewPill } from "@/components/property/view-pill";
import { InfiniteResults } from "@/components/property/infinite-results";
import { PropertyGrid, PropertyGridSkeleton } from "@/components/property/property-card";
import { useSavedSet } from "@/components/property/results";
import { DataUnavailable } from "@/components/data-unavailable";
import { homeQuery, searchListings, searchQuery } from "@/lib/properties.functions";
import { absUrl } from "@/lib/site";
import { paramsFromUrl, urlFromParams, type SearchUrl } from "@/lib/search-url";
import type { SearchParams } from "@/lib/listing-search";

const KEYS = ["q", "for", "cat", "type", "county", "area", "min", "max", "beds", "baths", "sqmMin", "sqmMax", "features", "furnishing", "cond", "verified", "sort", "lat", "lng", "r", "poly"] as const;

export const Route = createFileRoute("/")({
  validateSearch: (s): SearchUrl => Object.fromEntries(KEYS.flatMap((k) => (typeof s[k] === "string" || typeof s[k] === "number" ? [[k, String(s[k])]] : []))),
  head: () => ({
    meta: [
      { property: "og:url", content: absUrl("/") },
      { title: "Hodii — Houses, apartments, land & rentals in Kenya" },
      { name: "description", content: "Find houses, apartments, land and commercial property for sale and to rent across Kenya, listed by verified agencies and owners on Hodii." },
      { property: "og:title", content: "Hodii — Houses, apartments, land & rentals in Kenya" },
      { property: "og:description", content: "Houses, apartments, land and commercial property for sale and to rent across Kenya." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: absUrl("/") }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: HomePage,
});


function HomePage() {
  const data = Route.useLoaderData();
  const navigate = useNavigate({ from: "/" });
  const search = Route.useSearch();
  const params = paramsFromUrl(search);
  const filtering = Object.keys(search).length > 0;
  const change = (next: Partial<SearchParams>) => navigate({ to: "/properties", search: urlFromParams({ ...params, ...next, page: 1 }) });
  const q = useQuery({ ...searchQuery({ ...params, page: 1 }), placeholderData: keepPreviousData, enabled: filtering });
  const geoSearch = urlFromParams(params);
  const { setPlace, nearby } = useNearbyHome();
  const featured = nearby && nearby.featured.length > 0 ? nearby.featured : data.featured;
  const latest = nearby && nearby.latest.length > 0 ? nearby.latest : data.latest;
  const featuredNote = nearby && nearby.featured.length > 0 ? scopeText(nearby.featuredScopes) : "";
  const latestNote = nearby && nearby.latest.length > 0 ? scopeText(nearby.latestScopes) : "";
  const saved = useSavedSet([...featured, ...latest]);
  const heading = searchHeading(params);
  const homeResult = q.data && !q.data.unavailable ? { total: q.data.nearest ? 0 : q.data.total, ...(q.data.nearest ? { nearest: q.data.nearest } : {}), loading: q.isPlaceholderData || q.isFetching } : undefined;
  return (
    <main className="pt-[calc(5rem+var(--pills-h,4rem))] pb-24 transition-[padding] duration-500 ease-out max-sm:px-4 md:pt-[calc(6.5rem+var(--pills-h,4rem))] lg:pt-[calc(4.5rem+var(--pills-h,5rem))]">
      {/* Kept for search engines and screen readers only; nothing is shown to visitors. */}
      <div className="sr-only"><h1>{heading.title}</h1>{heading.subtitle && <p>{heading.subtitle}</p>}</div>
      {/* Phone: the search sheet (opened from the header bar or the Explore tab). Hidden on large screens, where the header carries the search. */}
      <div className="mx-auto max-w-[112rem]">
        <ExploreBar deferred value={params} onChange={change} result={homeResult} />
        <div className="mx-auto mt-4 max-w-4xl lg:hidden"><HomeSearch deferred value={params} onChange={change} result={homeResult} /></div>
      </div>
      <div className="mx-auto grid max-w-[112rem] gap-5">

        <div className={`min-w-0 ${filtering ? "" : "hidden"}`}>
          <div className="mt-6 md:mt-8">
            {filtering ? (
              <div className={q.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
                {q.data && !q.data.unavailable && (
                  <div className="mb-5 flex items-start justify-between gap-4" aria-live="polite">
                    <div>
                      <h2 className="text-xl font-extrabold">{(() => { const n = q.data.nearest ? 0 : q.data.total; return n === 0 ? "No properties found" : `${n.toLocaleString("en-KE")} ${n === 1 ? "property" : "properties"} found`; })()}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">You can change the filters to see more results</p>
                    </div>
                    <span data-tour="layout" className="inline-flex"><LayoutPill /></span>
                  </div>
                )}
                {q.data ? <InfiniteResults first={q.data} unavailable={q.data.unavailable} resetKey={JSON.stringify(geoSearch)} fetchPage={(page) => searchListings({ data: { ...params, page } })} />
                  : <PropertyGridSkeleton />}
              </div>
            ) : null}
            {filtering && <Link to="/properties" search={geoSearch} className="mt-6 inline-flex items-center gap-1.5 font-semibold text-foreground">See all homes<ArrowRight className="h-4 w-4" aria-hidden /></Link>}
          </div>
        </div>

      </div>
      {!filtering && (data.unavailable ? <div className="mx-auto mt-6 max-w-[112rem]"><DataUnavailable /></div> : (
        <div className="mx-auto mt-6 max-w-[112rem] space-y-10 md:mt-8">
          {(() => {
            const items = [...featured.filter((c) => c.tier === "premium"), ...featured.filter((c) => c.tier === "boost")];
            return items.length > 0 && (
              <section aria-labelledby="top-properties">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div><h2 id="top-properties" className="text-xl font-extrabold">Top properties</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Featured by their agencies{featuredNote ? `, in ${featuredNote}` : ""}</p></div>
                  <LocationBar label={nearby?.place?.label ?? null} onChange={setPlace} onFilters={change} />
                </div>
                <PropertyGrid items={items} saved={saved} />
              </section>
            );
          })()}
          <section aria-labelledby="latest" data-tour="latest">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 id="latest" className="text-xl font-extrabold">{latestNote ? "Latest near you" : "Latest listings"}</h2>{latestNote && <p className="mt-1 text-sm text-muted-foreground">In {latestNote}</p>}</div>{!featured.some((c) => c.tier !== "none") && <LocationBar label={nearby?.place?.label ?? null} onChange={setPlace} onFilters={change} />}<Link to="/properties" className="inline-flex items-center gap-1 text-sm font-bold text-primary">See all<ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
            <PropertyGrid items={latest} saved={saved} empty={<div className="empty-card"><p className="text-sm font-semibold text-muted-foreground">New listings will appear here soon.</p></div>} />
          </section>
          {data.counties.length > 0 && (
            <section aria-labelledby="where" data-tour="counties"><h2 id="where" className="mb-5 text-xl font-extrabold">Browse by county</h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {data.counties.map((c) => <li key={c.code}><Link to="/properties" search={{ county: String(c.code) }} className="glass-lux block rounded-2xl p-4"><span className="block font-bold">{c.name}</span><span className="text-sm text-muted-foreground">{c.count.toLocaleString("en-KE")} {c.count === 1 ? "property" : "properties"}</span></Link></li>)}
              </ul></section>
          )}
          <section className="glass-lux flex flex-col items-start gap-4 rounded-3xl p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4"><ShieldCheck className="mt-1 h-8 w-8 shrink-0 text-primary" aria-hidden /><div><h2 className="text-xl font-extrabold">Are you an agent, developer or landlord?</h2><p className="mt-1 text-muted-foreground">Create an agency account, add your team and reach buyers and tenants across Kenya.</p></div></div>
            <Link to="/list-property" className="shrink-0 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">List a property</Link>
          </section>
        </div>
      ))}
      <ViewPill map={false} onChange={(v) => navigate({ to: "/properties", search: v === "map" ? { ...geoSearch, view: "map" } : geoSearch })} />
    </main>
  );
}
