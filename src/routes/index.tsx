import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Building2, Home, KeyRound, Search, ShieldCheck, Trees } from "lucide-react";
import { useState } from "react";
import { ViewPill } from "@/components/property/view-pill";
import { PropertyGrid } from "@/components/property/property-card";
import { useSavedSet } from "@/components/property/results";
import { DataUnavailable } from "@/components/data-unavailable";
import { LISTING_TYPES } from "@/lib/mongodb/taxonomy";
import { LocationBar, scopeText, useNearbyHome } from "@/components/property/near-you";
import { homeQuery } from "@/lib/properties.functions";
import { absUrl } from "@/lib/site";

export const Route = createFileRoute("/")({
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

const SHORTCUTS = [
  { label: "Houses for sale", icon: Home, search: { for: "sale", type: "house,maisonette,bungalow,townhouse" } },
  { label: "Apartments to rent", icon: Building2, search: { for: "rent", type: "apartment" } },
  { label: "Land for sale", icon: Trees, search: { for: "sale", cat: "land" } },
  { label: "Commercial", icon: KeyRound, search: { cat: "commercial" } },
] as const;

function HomePage() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const [type, setType] = useState<string>("rent");
  const [q, setQ] = useState("");
  const { setPlace, nearby } = useNearbyHome();
  const featured = nearby && nearby.featured.length > 0 ? nearby.featured : data.featured;
  const latest = nearby && nearby.latest.length > 0 ? nearby.latest : data.latest;
  const featuredNote = nearby && nearby.featured.length > 0 ? scopeText(nearby.featuredScopes) : "";
  const latestNote = nearby && nearby.latest.length > 0 ? scopeText(nearby.latestScopes) : "";
  const saved = useSavedSet([...featured, ...latest]);
  const go = (e: React.FormEvent) => { e.preventDefault(); navigate({ to: "/properties", search: { for: type, ...(q.trim() ? { q: q.trim() } : {}) } }); };

  return (
    <main>
      <section className="mx-auto max-w-[112rem] px-4 pt-32 pb-12 text-center md:pt-40">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">Find your next place in Kenya</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">Houses, apartments, land and commercial property from verified agencies and owners.</p>
        <form onSubmit={go} role="search" aria-label="Search properties" className="glass mx-auto mt-8 max-w-3xl rounded-3xl p-4 text-left">
          <div className="mb-3 inline-flex rounded-full bg-muted p-1" role="tablist" aria-label="Listing type">
            {LISTING_TYPES.map((t) => <button key={t.key} type="button" role="tab" aria-selected={type === t.key} onClick={() => setType(t.key)} className={`rounded-full px-5 py-1.5 text-sm font-semibold ${type === t.key ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"}`}>{t.short}</button>)}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1" data-tour="hero-search"><label htmlFor="home-q" className="sr-only">Area, estate or keyword</label><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><input id="home-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try Kilimani, Nyali or Kitengela" maxLength={100} className="h-12 w-full rounded-xl border border-input bg-background pl-9 pr-3 outline-hidden focus-visible:ring-2 focus-visible:ring-ring" /></div>
            <button className="h-12 rounded-xl bg-primary px-7 font-bold text-primary-foreground">Search</button>
          </div>
        </form>
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {SHORTCUTS.map((s) => <li key={s.label}><Link to="/properties" search={s.search} className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold hover:bg-muted"><s.icon className="h-4 w-4" aria-hidden />{s.label}</Link></li>)}
        </ul>
      </section>

      {data.unavailable ? <div className="mx-auto max-w-[112rem] px-4 pb-24"><DataUnavailable /></div> : (
        <div className="mx-auto max-w-[112rem] space-y-16 px-4 pb-24">
          <LocationBar label={nearby?.place?.label ?? null} onChange={setPlace} />
          {([["premium", "Premium properties", "From Premium agencies"], ["boost", "Boosted properties", "Promoted by their agencies"]] as const).map(([tier, title, sub]) => {
            const items = featured.filter((c) => c.tier === tier);
            return items.length > 0 && (
              <section key={tier} aria-labelledby={`tier-${tier}`}>
                <h2 id={`tier-${tier}`} className="text-2xl font-extrabold">{title}</h2>
                <p className="mb-5 mt-1 text-sm text-muted-foreground">{sub}{featuredNote ? `, in ${featuredNote}` : ""}</p>
                <PropertyGrid items={items} saved={saved} />
              </section>
            );
          })}
          <section aria-labelledby="latest">
            <div className="mb-5 flex items-end justify-between gap-3"><div><h2 id="latest" className="text-2xl font-extrabold">{latestNote ? "Latest near you" : "Latest listings"}</h2>{latestNote && <p className="mt-1 text-sm text-muted-foreground">In {latestNote}</p>}</div><Link to="/properties" className="inline-flex items-center gap-1 text-sm font-bold text-primary">See all<ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
            <PropertyGrid items={latest} saved={saved} empty={<div className="empty-card"><p className="text-sm font-semibold text-muted-foreground">New listings will appear here soon.</p></div>} />
          </section>
          {data.counties.length > 0 && (
            <section aria-labelledby="where"><h2 id="where" className="mb-5 text-2xl font-extrabold">Browse by county</h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {data.counties.map((c) => <li key={c.code}><Link to="/properties" search={{ county: String(c.code) }} className="glass block rounded-2xl p-4 hover:bg-muted/50"><span className="block font-bold">{c.name}</span><span className="text-sm text-muted-foreground">{c.count.toLocaleString("en-KE")} {c.count === 1 ? "property" : "properties"}</span></Link></li>)}
              </ul></section>
          )}
          <section className="glass flex flex-col items-start gap-4 rounded-3xl p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4"><ShieldCheck className="mt-1 h-8 w-8 shrink-0 text-primary" aria-hidden /><div><h2 className="text-xl font-extrabold">Are you an agent, developer or landlord?</h2><p className="mt-1 text-muted-foreground">Create an agency account, add your team and reach buyers and tenants across Kenya.</p></div></div>
            <Link to="/list-property" className="shrink-0 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">List a property</Link>
          </section>
        </div>
      )}
    <ViewPill map={false} onChange={(v) => { if (v === "map") navigate({ to: "/properties", search: { view: "map" } }); else navigate({ to: "/properties" }); }} />
    </main>
  );
}
