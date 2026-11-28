import { createFileRoute, redirect } from "@tanstack/react-router";
import type { SearchUrl } from "@/lib/search-url";

const KEYS = ["q", "for", "cat", "type", "county", "area", "min", "max", "beds", "baths", "sqmMin", "sqmMax", "features", "furnishing", "cond", "verified", "sort", "page", "lat", "lng", "r", "poly", "view"] as const;

/** Search now lives on the homepage; old links and bookmarks to /properties land there with the same filters. */
export const Route = createFileRoute("/properties/")({
  validateSearch: (s): SearchUrl => Object.fromEntries(KEYS.flatMap((k) => (typeof s[k] === "string" || typeof s[k] === "number" ? [[k, String(s[k])]] : []))),
  beforeLoad: ({ search }) => { throw redirect({ to: "/", search, statusCode: 308 }); },
});
