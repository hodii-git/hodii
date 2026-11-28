import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { searchHeading } from "@/lib/search-title";
import { LocationBar, scopeText, useNearbyHome } from "@/components/property/near-you";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { LayoutPill } from "@/components/property/layout-pill";
import { HomeSearch } from "@/components/home/home-search";
import { SearchPage } from "@/components/property/search-page";
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

const KEYS = ["q", "for", "cat", "type", "county", "area", "min", "max", "beds", "baths", "sqmMin", "sqmMax", "features", "furnishing", "cond", "verified", "sort", "page", "lat", "lng", "r", "poly", "view"] as const;

export const Route = createFileRoute("/")({
  validateSearch: (s): SearchUrl => Object.fromEntries(KEYS.flatMap((k) => (typeof s[k] === "string" || typeof s[k] === "number" ? [[k, String(s[k])]] : []))),
  loaderDeps: ({ search }) => ({ search }),
  head: () => ({
    meta: [
      // A filtered or paged search is not indexed; the plain homepage is.

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
  loader: ({ deps, context }) => {
    // With filters in the address the first page of results is ready before the page is sent (server) or fetched in the background (browser).
    const home = context.queryClient.ensureQueryData(homeQuery);
    if (!Object.keys(deps.search).length) return home;
    const q = searchQuery(paramsFromUrl(deps.search));
    if (typeof window === "undefined") return Promise.all([context.queryClient.ensureQueryData(q), home]).then(([, h]) => h);
    void context.queryClient.prefetchQuery(q);
    return home;
  },
  component: HomePage,
});


function HomePage() {
  const navigate = useNavigate({ from: "/" });
  const search = Route.useSearch();
  // Any filter, page or the map in the address makes the homepage the search page, in place.
  if (Object.keys(search).length > 0) return <SearchPage search={search} go={(s, o) => void navigate({ to: "/", search: s, ...(o?.resetScroll === false ? { resetScroll: false } : {}) })} />;
  return <HomeLanding />;
}

function HomeLanding() {
  const data = Route.useLoaderData();
  const navigate = useNavigate({ from: "/" });
  const search = Route.useSearch();
  const params = paramsFromUrl(search);
  const change = (next: Partial<SearchParams>) => navigate({ to: "/", search: urlFromParams({ ...params, ...next, page: 1 }) });
  const { setPlace, nearby } = useNearbyHome();
  const featured = nearby && nearby.featured.length > 0 ? nearby.featured : data.featured;
  const latest = nearby && nearby.latest.length > 0 ? nearby.latest : data.latest;
  const featuredNote = nearby && nearby.featured.length > 0 ? scopeText(nearby.featuredScopes) : "";
  const latestNote = nearby && nearby.latest.length > 0 ? scopeText(nearby.latestScopes) : "";
  const saved = useSavedSet([...featured, ...latest]);
  const heading = searchHeading(params);
  return (
    <main className="pt-[calc(var(--head-h,9.75rem)+1rem)] pb-24 max-sm:px-4 lg:pt-[calc(var(--head-h,11rem)+1.5rem)]">
      {/* Kept for search engines and screen readers only; nothing is shown to visitors. */}
      <div className="sr-only"><h1>{heading.title}</h1>{heading.subtitle && <p>{heading.subtitle}</p>}</div>
      {/* Phone: the search sheet (opened from the header bar or the Explore tab). Hidden on large screens, where the header carries the search. */}
      <div className="mx-auto max-w-[112rem]">
        <ExploreBar deferred value={params} onChange={change} />
        <div className="mx-auto mt-4 max-w-4xl lg:hidden"><HomeSearch deferred value={params} onChange={change} /></div>
      </div>
      {(data.unavailable ? <div className="mx-auto mt-6 max-w-[112rem]"><DataUnavailable /></div> : (
        <div className="home-sections mx-auto -mt-2 max-w-[112rem] space-y-10 md:mt-2">
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
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 id="latest" className="text-xl font-extrabold">{latestNote ? "Latest near you" : "Latest listings"}</h2>{latestNote && <p className="mt-1 text-sm text-muted-foreground">In {latestNote}</p>}</div>{!featured.some((c) => c.tier !== "none") && <LocationBar label={nearby?.place?.label ?? null} onChange={setPlace} onFilters={change} />}<Link to="/" className="inline-flex items-center gap-1 text-sm font-bold text-primary">See all<ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
            <PropertyGrid items={latest} saved={saved} empty={<div className="empty-card"><p className="text-sm font-semibold text-muted-foreground">New listings will appear here soon.</p></div>} />
          </section>
          {data.counties.length > 0 && (
            <section aria-labelledby="where" data-tour="counties"><h2 id="where" className="mb-5 text-xl font-extrabold">Browse by county</h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {data.counties.map((c) => <li key={c.code}><Link to="/" search={{ county: String(c.code) }} className="glass-lux block rounded-2xl p-4"><span className="block font-bold">{c.name}</span><span className="text-sm text-muted-foreground">{c.count.toLocaleString("en-KE")} {c.count === 1 ? "property" : "properties"}</span></Link></li>)}
              </ul></section>
          )}
          <section className="glass-lux flex flex-col items-start gap-4 rounded-3xl p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4"><ShieldCheck className="mt-1 h-8 w-8 shrink-0 text-primary" aria-hidden /><div><h2 className="text-xl font-extrabold">Are you an agent, developer or landlord?</h2><p className="mt-1 text-muted-foreground">Create an agency account, add your team and reach buyers and tenants across Kenya.</p></div></div>
            <Link to="/list-property" className="shrink-0 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">List a property</Link>
          </section>
        </div>
      ))}
      <ViewPill map={false} onChange={(v) => navigate({ to: "/", search: v === "map" ? { view: "map" } : {} })} />
    </main>
  );
}
