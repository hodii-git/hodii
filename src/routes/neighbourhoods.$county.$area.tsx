import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { Stars } from "@/components/agency/stars";
import { Chat, RatingBars, ReviewForm, Reviews } from "@/components/neighbourhood/parts";
import { ShareButton } from "@/components/share-button";
import { NotFoundPage } from "@/components/states";
import { makeKey } from "@/lib/neighbourhood";
import { neighbourhoodQuery } from "@/lib/neighbourhoods.functions";
import { absUrl } from "@/lib/site";

type Search = { tab?: "reviews" | "chat" | undefined };
export const Route = createFileRoute("/neighbourhoods/$county/$area")({
  validateSearch: (s): Search => ({ ...(s["tab"] === "chat" || s["tab"] === "reviews" ? { tab: s["tab"] } : {}) }),
  loader: async ({ params, context }) => { const d = await context.queryClient.ensureQueryData(neighbourhoodQuery(makeKey(params.county, params.area))); if (!d) throw notFound(); return d; },
  head: ({ loaderData: d, params }) => {
    const title = d ? `${d.area.name}, ${d.area.county}: ratings, reviews and chat — Hodii` : "Neighbourhood — Hodii";
    const s = d?.area.summary;
    return { meta: [{ title }, { name: "description", content: d ? `${d.area.name} in ${d.area.county}${s?.overall ? `, rated ${s.overall.toFixed(1)}/5 by ${s.count} ${s.count === 1 ? "person" : "people"}` : ""}. Security, amenities, transport and what residents say.` : "" }], links: [{ rel: "canonical", href: absUrl(`/neighbourhoods/${params.county}/${params.area}`) }] };
  },
  notFoundComponent: NotFoundPage,
  component: Page,
});

function Page() {
  const { county, area } = Route.useParams();
  const { tab = "reviews" } = Route.useSearch();
  const key = makeKey(county, area);
  const { data: d } = useQuery({ ...neighbourhoodQuery(key), initialData: Route.useLoaderData() });
  if (!d) return null;
  const a = d.area, s = a.summary, path = `/neighbourhoods/${county}/${area}`;
  const tabCls = (on: boolean) => `inline-flex h-11 items-center rounded-full px-5 text-sm font-bold ${on ? "bg-foreground text-background" : "border border-input"}`;
  return (
    <main className="mx-auto max-w-5xl px-4 pt-28 pb-24">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground"><Link to="/neighbourhoods" className="hover:underline">Neighbourhoods</Link> / <span>{a.name}</span></nav>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h1 className="text-3xl font-extrabold md:text-4xl">{a.name}</h1><p className="mt-1 flex items-center gap-1 text-muted-foreground"><MapPin className="size-4" aria-hidden />{a.county}</p></div>
        <ShareButton title={`${a.name}, ${a.county}`} />
      </div>
      <section aria-label="Summary" className="mt-6 grid gap-6 rounded-3xl border border-border p-5 md:grid-cols-[14rem_1fr]">
        <div>
          {s.overall ? <><p className="text-5xl font-extrabold tabular-nums">{s.overall.toFixed(1)}</p><Stars value={s.overall} size={18} /><p className="mt-1 text-sm text-muted-foreground">{s.count} {s.count === 1 ? "review" : "reviews"}</p></> : <p className="text-muted-foreground">No ratings yet. Be the first.</p>}
          <dl className="mt-4 space-y-1 text-sm"><div className="flex justify-between gap-2"><dt className="text-muted-foreground">Live listings</dt><dd className="font-bold">{a.listings}</dd></div>
            {d.averages.rent && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Average rent</dt><dd className="font-bold">KES {d.averages.rent.toLocaleString("en-KE")}</dd></div>}
            {d.averages.sale && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Average sale</dt><dd className="font-bold">KES {d.averages.sale.toLocaleString("en-KE")}</dd></div>}</dl>
        </div>
        <RatingBars s={s} />
      </section>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/properties" search={{ county: a.countyCode ? String(a.countyCode) : undefined, area: a.areaSlug } as never} className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">See {a.listings} {a.listings === 1 ? "listing" : "listings"} here</Link>
        <Link to="/neighbourhoods/compare" search={{ a: key }} className="inline-flex h-11 items-center rounded-full border border-input px-5 text-sm font-bold">Compare with others</Link>
      </div>
      <div role="tablist" aria-label="Neighbourhood sections" className="mt-8 flex gap-2">
        <Link to="." search={{ tab: "reviews" }} replace resetScroll={false} role="tab" aria-selected={tab === "reviews"} className={tabCls(tab === "reviews")}>Reviews</Link>
        <Link to="." search={{ tab: "chat" }} replace resetScroll={false} role="tab" aria-selected={tab === "chat"} className={tabCls(tab === "chat")}>Neighbourhood chat</Link>
      </div>
      <div role="tabpanel" className="mt-4 grid gap-6">
        {tab === "chat" ? <Chat areaKey={key} path={`${path}?tab=chat`} name={a.name} /> : <><ReviewForm areaKey={key} path={path} /><Reviews areaKey={key} /></>}
      </div>
    </main>
  );
}
