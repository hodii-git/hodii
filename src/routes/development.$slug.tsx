import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BadgeCheck, CalendarClock, Check, FileText, Home, Layers, MapPin, Tag } from "lucide-react";
import { Gallery } from "@/components/property/gallery";
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

const STEPS = ["planning", "off_plan", "under_construction", "completed"] as const;

function Detail() {
  const d = Route.useLoaderData();
  const from = money(d.priceFrom, d.currency), to = money(d.priceTo, d.currency), done = when(d.completionDate);
  const step = Math.max(0, STEPS.indexOf(d.status as (typeof STEPS)[number]));
  const available = d.unitTypeRows.reduce((a, u) => a + (u.unitsAvailable ?? 0), 0);
  const card = "rounded-3xl border border-border bg-card p-6 shadow-sm";
  return (
    <main className="mx-auto max-w-[82rem] px-4 pt-28 pb-24">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground"><Link to="/developments" className="hover:underline">New developments</Link> / <span>{d.name}</span></nav>
      <header className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span className="rounded-full bg-foreground px-3 py-1 text-background">{STATUS_LABEL[d.status] ?? d.status}</span>{d.agency?.verified && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-primary"><BadgeCheck className="size-3.5" aria-hidden />Verified agency</span>}</div>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight md:text-4xl">{d.name}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-muted-foreground"><MapPin className="size-4" aria-hidden />{[d.areaName, d.county].filter(Boolean).join(", ")}</p>
        </div>
        <ShareButton title={d.name} />
      </header>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-6">
          <Gallery images={d.images.map((i) => ({ ...i, caption: null }))} title={d.name} />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([[Tag, from ? `From ${from}` : "On request", "Starting price"], [CalendarClock, done ?? "To be announced", d.status === "completed" ? "Completed" : "Completion"], [Layers, String(d.unitTypes), d.unitTypes === 1 ? "Unit type" : "Unit types"], [Home, available ? String(available) : "—", "Units available"]] as const).map(([Icon, v, l]) => (
              <li key={l} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted" aria-hidden><Icon className="size-5" /></span><span className="min-w-0"><span className="block truncate font-extrabold leading-tight">{v}</span><span className="text-xs text-muted-foreground">{l}</span></span></li>
            ))}
          </ul>
          <section aria-labelledby="progress" className={card}>
            <h2 id="progress" className="mb-5 text-xl font-extrabold">Project progress</h2>
            <ol className="grid grid-cols-4 gap-2" aria-label="Stages of the project">
              {STEPS.map((k, n) => (
                <li key={k} className="min-w-0" aria-current={n === step ? "step" : undefined}>
                  <span className={`block h-1.5 rounded-full ${n <= step ? "bg-primary" : "bg-muted"}`} />
                  <span className={`mt-2 block truncate text-xs ${n === step ? "font-extrabold" : "text-muted-foreground"}`}>{STATUS_LABEL[k]}</span>
                </li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="about" className={card}><h2 id="about" className="mb-3 text-xl font-extrabold">About this project</h2><div className="space-y-3 leading-relaxed text-foreground/90">{d.description.split(/\n{2,}/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}</div></section>
          {d.unitTypeRows.length > 0 && (
            <section aria-labelledby="units" className={card}><h2 id="units" className="mb-4 text-xl font-extrabold">Unit types and prices</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {d.unitTypeRows.map((u, i) => (
                  <li key={i} className="rounded-2xl border border-border p-4">
                    <p className="flex items-start justify-between gap-2"><span className="font-extrabold">{u.label}</span>{u.unitsAvailable !== null && <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${u.unitsAvailable > 0 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>{u.unitsAvailable > 0 ? `${u.unitsAvailable} left` : "Sold out"}</span>}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{typeLabel(u.propertyType)}{u.bedrooms !== null ? ` · ${u.bedrooms === 0 ? "Studio" : `${u.bedrooms} bedrooms`}` : ""}</p>
                    <p className="mt-3 text-xl font-extrabold">{money(u.priceFrom, d.currency) ? `From ${money(u.priceFrom, d.currency)}` : "Price on request"}</p>
                  </li>
                ))}
              </ul></section>
          )}
          {d.features.length > 0 && <section aria-labelledby="feat" className={card}><h2 id="feat" className="mb-4 text-xl font-extrabold">Features</h2><ul className="flex flex-wrap gap-2">{d.features.map((f) => <li key={f} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-semibold"><Check className="size-3.5 text-primary" aria-hidden />{FEATURES.find((x) => x.key === f)?.label ?? f}</li>)}</ul></section>}
        </div>
        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-lg">
            <div><p className="text-sm text-muted-foreground">Prices from</p><p className="text-3xl font-extrabold tracking-tight">{from ?? "On request"}</p>{to && <p className="text-sm text-muted-foreground">up to {to}</p>}</div>
            {done && <p className="flex items-center gap-2 text-sm"><CalendarClock className="size-4" aria-hidden />{d.status === "completed" ? "Completed" : "Expected"} {done}</p>}
            {d.brochureUrl && <a href={d.brochureUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-input text-sm font-bold hover:bg-muted"><FileText className="size-4" aria-hidden />Download the brochure</a>}
            {d.agency && <div className="border-t border-border pt-4"><p className="text-xs text-muted-foreground">Sold by</p><Link to="/agency/$slug" params={{ slug: d.agency.slug }} className="flex items-center gap-1 font-extrabold hover:underline"><span className="truncate">{d.agency.name}</span>{d.agency.verified && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified" />}</Link>
              <Link to="/agency/$slug" params={{ slug: d.agency.slug }} className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">Contact the agency</Link></div>}
          </div>
          <p className="px-2 text-xs text-muted-foreground">Prices and availability are set by the seller and can change. Visit the site and check the title before you pay a deposit.</p>
        </aside>
      </div>
    </main>
  );
}
