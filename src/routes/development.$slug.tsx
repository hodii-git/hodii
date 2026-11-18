import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BadgeCheck, CalendarClock, FileText, MapPin } from "lucide-react";
import { getPublicDevelopment } from "@/lib/developments.functions";
import { STATUS_LABEL, money, when } from "@/components/development/development-card";
import { ShareButton } from "@/components/share-button";
import { FEATURES, PROPERTY_TYPES } from "@/lib/mongodb/taxonomy";
import { absUrl } from "@/lib/site";

export const Route = createFileRoute("/development/$slug")({
  loader: async ({ params }) => { const d = await getPublicDevelopment({ data: { slug: params.slug } }); if (!d) throw notFound(); return d; },
  head: ({ loaderData: d }) => ({
    meta: [{ title: d ? `${d.name} — new development in ${d.areaName}, ${d.county ?? "Kenya"} | Hodii` : "Development | Hodii" }, { name: "description", content: d ? `${d.name}: ${STATUS_LABEL[d.status] ?? d.status} development in ${d.areaName}. ${d.description.slice(0, 120)}` : "" },
      ...(d?.image ? [{ property: "og:image", content: d.image.url }] : [])],
    links: d ? [{ rel: "canonical", href: absUrl(`/development/${d.slug}`) }] : [],
  }),
  notFoundComponent: () => <main className="mx-auto max-w-xl px-4 pt-32 pb-24 text-center"><h1 className="text-2xl font-extrabold">Development not found</h1><p className="mt-2 text-muted-foreground">It may have been removed or is not published yet.</p><Link to="/developments" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">See all developments</Link></main>,
  component: Detail,
});

const typeLabel = (k: string) => PROPERTY_TYPES.find((t) => t.key === k)?.label ?? k;

function Detail() {
  const d = Route.useLoaderData();
  const from = money(d.priceFrom, d.currency), to = money(d.priceTo, d.currency), done = when(d.completionDate);
  return (
    <main className="mx-auto max-w-6xl px-4 pt-28 pb-24">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground"><Link to="/developments" className="hover:underline">New developments</Link> / <span>{d.name}</span></nav>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{STATUS_LABEL[d.status] ?? d.status}</span>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">{d.name}</h1>
          <p className="mt-1 flex items-center gap-1 text-muted-foreground"><MapPin className="size-4" aria-hidden />{[d.areaName, d.county].filter(Boolean).join(", ")}</p>
        </div>
        <ShareButton title={d.name} />
      </div>
      {d.images.length > 0 && (
        <div className="mt-6 grid gap-2 sm:grid-cols-4 sm:grid-rows-2">
          {d.images.slice(0, 5).map((i, n) => <img key={i.url} src={n === 0 ? i.url : i.thumbUrl ?? i.url} alt={i.alt || `${d.name} photo ${n + 1}`} width={i.width} height={i.height} loading={n === 0 ? "eager" : "lazy"} className={`w-full rounded-2xl bg-muted object-cover ${n === 0 ? "aspect-[4/3] sm:col-span-2 sm:row-span-2 sm:aspect-auto sm:h-full" : "aspect-[4/3]"}`} />)}
        </div>
      )}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-8">
          <section><h2 className="text-xl font-extrabold">About this project</h2><p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{d.description}</p></section>
          {d.unitTypeRows.length > 0 && (
            <section><h2 className="text-xl font-extrabold">Unit types</h2>
              <div className="mt-3 overflow-x-auto rounded-2xl border border-border"><table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr><th className="p-3">Unit</th><th className="p-3">Type</th><th className="p-3">Bedrooms</th><th className="p-3">From</th><th className="p-3">Available</th></tr></thead>
                <tbody>{d.unitTypeRows.map((u, i) => <tr key={i} className="border-t border-border"><td className="p-3 font-bold">{u.label}</td><td className="p-3">{typeLabel(u.propertyType)}</td><td className="p-3">{u.bedrooms ?? "—"}</td><td className="p-3">{money(u.priceFrom, d.currency) ?? "On request"}</td><td className="p-3">{u.unitsAvailable ?? "—"}</td></tr>)}</tbody>
              </table></div></section>
          )}
          {d.features.length > 0 && <section><h2 className="text-xl font-extrabold">Features</h2><ul className="mt-3 flex flex-wrap gap-2">{d.features.map((f) => <li key={f} className="rounded-full border border-border px-3 py-1 text-sm">{FEATURES.find((x) => x.key === f)?.label ?? f}</li>)}</ul></section>}
        </div>
        <aside className="h-fit space-y-4 rounded-3xl border border-border p-5 lg:sticky lg:top-28">
          <p className="text-sm text-muted-foreground">Prices from</p>
          <p className="text-2xl font-extrabold">{from ?? "On request"}</p>
          {to && <p className="text-sm text-muted-foreground">up to {to}</p>}
          {done && <p className="flex items-center gap-2 text-sm"><CalendarClock className="size-4" aria-hidden />{d.status === "completed" ? "Completed" : "Expected"} {done}</p>}
          {d.brochureUrl && <a href={d.brochureUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"><FileText className="size-4" aria-hidden />Download the brochure</a>}
          {d.agency && <div className="border-t border-border pt-4"><p className="text-xs text-muted-foreground">Sold by</p><Link to="/agency/$slug" params={{ slug: d.agency.slug }} className="flex items-center gap-1 font-extrabold hover:underline">{d.agency.name}{d.agency.verified && <BadgeCheck className="size-4 text-primary" aria-label="Verified" />}</Link>
            <Link to="/agency/$slug" params={{ slug: d.agency.slug }} className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">Contact the agency</Link></div>}
        </aside>
      </div>
    </main>
  );
}
