import { createFileRoute, notFound } from "@tanstack/react-router";
import { LocationView, locationBlurb } from "@/components/property/location-page";
import { NotFoundPage } from "@/components/states";
import { BRAND } from "@/lib/brand";
import { locationQuery } from "@/lib/properties.functions";
import { absUrl } from "@/lib/site";

export const Route = createFileRoute("/locations/$county/")({
  loader: async ({ params, context }) => {
    const l = await context.queryClient.ensureQueryData(locationQuery(params.county, null));
    if (!l) throw notFound();
    return l;
  },
  head: ({ loaderData: l }) => {
    if (!l) return { meta: [{ title: `Not found — ${BRAND.name}` }, { name: "robots", content: "noindex" }] };
    const path = l.areaSlug ? `/locations/${l.countySlug}/${l.areaSlug}` : `/locations/${l.countySlug}`;
    const title = `Property in ${l.name}${l.areaSlug ? `, ${l.countyName}` : ""} — houses, apartments and land — ${BRAND.name}`;
    return { meta: [{ title }, { name: "description", content: locationBlurb(l) }, { property: "og:title", content: title }, { property: "og:description", content: locationBlurb(l) }, { property: "og:type", content: "website" }], links: [{ rel: "canonical", href: absUrl(path) }] };
  },
  notFoundComponent: NotFoundPage,
  component: Page,
});

function Page() { return <LocationView l={Route.useLoaderData()} />; }
