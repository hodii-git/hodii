import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";
import { COUNTY_LIST , COUNTY_LIST_NAIROBI_FIRST } from "@/lib/mongodb/kenya";
import { absUrl } from "@/lib/site";

export const Route = createFileRoute("/locations/")({
  head: () => {
    const title = `Property by county — ${BRAND.name}`;
    const desc = "Find houses, apartments, land and commercial property for sale and to rent in all 47 counties of Kenya.";
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }], links: [{ rel: "canonical", href: absUrl("/locations") }] };
  },
  component: () => (
    <main className="mx-auto max-w-5xl px-4 pt-28 pb-24">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Property by county</h1>
      <p className="mt-2 text-muted-foreground">Pick a county to see what is for sale and to rent, and which areas have the most listings.</p>
      <ul className="mt-8 grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,11rem),1fr))]">
        {COUNTY_LIST_NAIROBI_FIRST.map((c) => <li key={c.code}><Link to="/locations/$county" params={{ county: c.slug }} className="block rounded-xl border border-input px-4 py-3 text-sm font-semibold hover:bg-muted">{c.name}</Link></li>)}
      </ul>
    </main>
  ),
});
