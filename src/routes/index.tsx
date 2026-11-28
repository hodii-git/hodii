import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SearchPage } from "@/components/property/search-page";
import { searchQuery } from "@/lib/properties.functions";
import { absUrl } from "@/lib/site";
import { paramsFromUrl, type SearchUrl } from "@/lib/search-url";

const KEYS = ["q", "for", "cat", "type", "county", "area", "min", "max", "beds", "baths", "sqmMin", "sqmMax", "features", "furnishing", "cond", "verified", "sort", "page", "lat", "lng", "r", "poly", "view"] as const;

/** The homepage is the search page: filters, results and the map all live here, so nobody leaves it to search. */
export const Route = createFileRoute("/")({
  validateSearch: (s): SearchUrl => Object.fromEntries(KEYS.flatMap((k) => (typeof s[k] === "string" || typeof s[k] === "number" ? [[k, String(s[k])]] : []))),
  loaderDeps: ({ search }) => ({ search }),
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
  loader: ({ deps, context }) => {
    // The first page of results is ready before the page is sent (server) or fetched in the background (browser).
    const q = searchQuery(paramsFromUrl(deps.search));
    if (typeof window === "undefined") return context.queryClient.ensureQueryData(q).then(() => null);
    void context.queryClient.prefetchQuery(q);
    return null;
  },
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate({ from: "/" });
  const search = Route.useSearch();
  return <SearchPage search={search} go={(s, o) => void navigate({ to: "/", search: s, ...(o?.resetScroll === false ? { resetScroll: false } : {}) })} />;
}
