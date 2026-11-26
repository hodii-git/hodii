import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Pick } from "@/components/ui/pick";
import { BadgeCheck, Calendar, Clock, Facebook, Globe, Instagram, Linkedin, MapPin, Users, Youtube } from "lucide-react";
import { useState } from "react";
import { ShareButton } from "@/components/share-button";
import { Stars } from "@/components/agency/stars";
import { AgencyReviews } from "@/components/agency/reviews";
import { SearchForm } from "@/components/property/search-form";
import { paramsFromUrl, urlFromParams, type SearchUrl } from "@/lib/search-url";
import { COUNTY_LIST } from "@/lib/mongodb/kenya";
import { AGENCY_KINDS } from "@/lib/mongodb/taxonomy";
import { trustLabel } from "@/lib/review-rules";
import type { SearchParams } from "@/lib/listing-search";
import { InfiniteResults } from "@/components/property/infinite-results";
import { agencyPageQuery, getAgencyPage } from "@/lib/properties.functions";
import { absUrl } from "@/lib/site";

const TABS = ["listings", "about", "team", "reviews"] as const;
type Tab = (typeof TABS)[number];
const KEYS = ["tab", "q", "for", "cat", "type", "county", "area", "min", "max", "beds", "baths", "sqmMin", "sqmMax", "features", "furnishing", "cond", "verified", "sort", "page"] as const;
const SORTS = [["relevance", "Best match"], ["newest", "Newest"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"], ["size_desc", "Largest"]] as const;
const SOCIAL_ICON = { facebook: Facebook, instagram: Instagram, linkedin: Linkedin, youtube: Youtube, x: Globe, tiktok: Globe } as const;

export const Route = createFileRoute("/agency/$slug")({
  validateSearch: (s): SearchUrl => Object.fromEntries(KEYS.flatMap((k) => (typeof s[k] === "string" || typeof s[k] === "number" ? [[k, String(s[k])]] : []))),
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ params, deps, context }) => {
    const r = await context.queryClient.ensureQueryData(agencyPageQuery(params.slug, paramsFromUrl(deps.search)));
    if (!r) throw notFound();
    return r;
  },
  head: ({ loaderData, params }) => {
    const a = loaderData?.agency;
    if (!a) return { meta: [{ title: "Agency not found — Hodii" }, { name: "robots", content: "noindex" }] };
    const title = `${a.name} — properties on Hodii`;
    const desc = (a.tagline || a.description || `Browse ${loaderData.total} listings from ${a.name} on Hodii.`).slice(0, 155);
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "profile" }], links: [{ rel: "canonical", href: absUrl(`/agency/${params.slug}`) }] };
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-xl px-4 pt-32 pb-24 text-center"><h1 className="text-3xl font-extrabold">Agency not found</h1><Link to="/properties" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">Browse properties</Link></main>
  ),
  component: AgencyPage,
});

function AgencyPage() {
  const { agency: a, team, items, total, page, pageSize } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/agency/$slug" });
  const params = paramsFromUrl(search);
  const tabNow: Tab = TABS.find((t) => t === (search as Record<string, string>)["tab"]) ?? "listings";
  const goTab = (t: Tab) => navigate({ search: (t === "listings" ? {} : { tab: t }) as never, resetScroll: false });
  const change = (next: Partial<SearchParams>) => navigate({ search: urlFromParams({ ...params, ...next }), resetScroll: false });
  const [more, setMore] = useState(false);
  const story = a.story || a.description;
  const long = story.length > 600;
  const counties = a.serviceAreas.map((c) => COUNTY_LIST.find((x) => x.code === c)?.name).filter(Boolean) as string[];
  const kind = AGENCY_KINDS.find((k) => k.key === a.kind)?.label;
  const filtered = Object.keys(search).some((k) => k !== "page" && k !== "sort");
  const nav: [Tab, string][] = [["listings", `Listings (${a.liveTotal})`], ["about", "About"], ...(team.length ? [["team", "Team"] as [Tab, string]] : []), ["reviews", "Reviews"]];

  return (
    <main className="mx-auto max-w-[82rem] px-4 pt-36 pb-24">
      <header className="overflow-hidden rounded-3xl bg-card shadow-[var(--lift-shadow)]">
        <div className="h-36 bg-muted sm:h-52">{a.cover && <img src={a.cover} alt="" className="h-full w-full object-cover" />}</div>
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-end">
          <div className="-mt-16 sm:-mt-20">
            {a.logo ? <img src={a.logo} alt="" width={112} height={112} className="h-28 w-28 rounded-2xl border-4 border-background bg-white object-contain p-2 shadow" /> : <div className="flex h-28 w-28 items-center justify-center rounded-2xl border-4 border-background bg-muted text-4xl font-extrabold shadow">{a.name[0]}</div>}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-3xl font-extrabold">{a.name}{a.verified && <span className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-3 py-1 text-sm font-bold text-primary"><BadgeCheck className="h-4 w-4" aria-hidden />Verified</span>}</h1>
            {a.tagline && <p className="mt-1 text-muted-foreground">{a.tagline}</p>}
            <div className="mt-3"><ShareButton title={a.name} /></div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <button type="button" onClick={() => goTab("reviews")} className="inline-flex items-center gap-2 hover:underline">{a.rating ? <><Stars value={a.rating.avg} /><span className="font-bold text-foreground">{a.rating.avg.toFixed(1)}</span><span>({a.rating.count})</span></> : <span>{trustLabel(0, 0)}</span>}</button>
              {kind && <span>{kind}</span>}
              {a.area && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden />{a.area}</span>}
              <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden />{a.teamSize} {a.teamSize === 1 ? "agent" : "agents"}</span>
              {a.foundedYear && <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" aria-hidden />Since {a.foundedYear}</span>}
            </div>
          </div>
        </div>
      </header>
      <nav aria-label="Agency sections" role="tablist" className="sticky top-16 z-10 mt-4 flex gap-2 overflow-x-auto py-2 [scrollbar-width:none]">
        {nav.map(([t, l]) => <button key={t} type="button" role="tab" aria-selected={tabNow === t} onClick={() => goTab(t)} className={`h-11 shrink-0 rounded-full px-5 text-sm font-bold shadow-[var(--lift-shadow)] ${tabNow === t ? "bg-foreground text-background" : "bg-card text-foreground hover:bg-[var(--surface)]"}`}>{l}</button>)}
      </nav>

      {tabNow === "listings" && <section id="listings" className="mt-8 scroll-mt-28" aria-labelledby="l-h">
        <h2 id="l-h" className="text-2xl font-extrabold">Listings from {a.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{a.listingCounts["sale"] ? `${a.listingCounts["sale"]} for sale` : ""}{a.listingCounts["sale"] && a.listingCounts["rent"] ? " · " : ""}{a.listingCounts["rent"] ? `${a.listingCounts["rent"]} to rent` : ""}{a.listingCounts["short_stay"] ? ` · ${a.listingCounts["short_stay"]} short stays` : ""}</p>
        <div className="mt-4"><SearchForm value={params} onChange={change} /></div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-muted-foreground" aria-live="polite">{total.toLocaleString("en-KE")} {total === 1 ? "property" : "properties"}{filtered ? " match" : ""}</p>
          <label className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Sort by</span>
            <div className="w-48"><Pick label="Sort by" value={params.sort} onChange={(v) => change({ sort: v as SearchParams["sort"], page: 1 })} options={SORTS.map(([k, l]) => ({ value: k, label: l }))} className="h-10" /></div></label>
        </div>
        <div className="mt-4"><InfiniteResults first={{ items, total, page, pageSize }} resetKey={JSON.stringify(urlFromParams({ ...params, page: 1 }))} fetchPage={(p) => getAgencyPage({ data: { ...params, page: p, slug } }) as never} emptyText={filtered ? "No listings from this agency match your search. Try fewer filters." : "This agency has no live listings right now."} /></div>
      </section>}

      {tabNow === "about" && <section id="about" className="mt-14 scroll-mt-28 grid gap-8 lg:grid-cols-[1fr_20rem]" aria-labelledby="a-h">
        <div>
          <h2 id="a-h" className="text-2xl font-extrabold">About {a.name}</h2>
          {story ? <>
            <div className={`mt-3 space-y-3 text-[15px] leading-relaxed ${long && !more ? "line-clamp-6" : ""}`}>{story.split(/\n{2,}/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}</div>
            {long && <button type="button" onClick={() => setMore(!more)} className="mt-2 text-sm font-bold underline">{more ? "Show less" : "Read more"}</button>}
          </> : <p className="mt-3 text-sm text-muted-foreground">This agency has not written its story yet.</p>}
          {a.services.length > 0 && <div className="mt-6"><h3 className="text-sm font-bold uppercase text-muted-foreground">Services</h3><ul className="mt-2 flex flex-wrap gap-2">{a.services.map((x) => <li key={x} className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold">{x}</li>)}</ul></div>}
          {counties.length > 0 && <div className="mt-6"><h3 className="text-sm font-bold uppercase text-muted-foreground">Areas covered</h3><p className="mt-2 text-sm">{counties.join(", ")}</p></div>}
        </div>
        <aside className="h-fit space-y-4 rounded-3xl bg-card p-5 text-sm shadow-[var(--lift-shadow)]" aria-label="Agency details">
          {a.area && <p className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{a.area}{a.countyCode ? `, ${COUNTY_LIST.find((c) => c.code === a.countyCode)?.name}` : ""}</span></p>}
          {a.hours && <p className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{a.hours}</span></p>}
          {a.website && <p><a href={a.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 font-bold hover:underline"><Globe className="h-4 w-4" aria-hidden />Website</a></p>}
          {Object.entries(a.socials).length > 0 && <ul className="flex flex-wrap gap-2">{Object.entries(a.socials).map(([k, v]) => { const Icon = SOCIAL_ICON[k as keyof typeof SOCIAL_ICON] ?? Globe; return <li key={k}><a href={v} target="_blank" rel="noopener noreferrer nofollow" aria-label={k} className="inline-flex h-10 items-center gap-2 rounded-full border border-input px-3 font-semibold capitalize"><Icon className="h-4 w-4" aria-hidden />{k}</a></li>; })}</ul>}
          <p className="text-xs text-muted-foreground">On Hodii since {new Date(a.memberSince ?? Date.now()).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}. Phone numbers are on each listing.</p>
        </aside>
      </section>}

      {tabNow === "team" && team.length > 0 && (
        <section id="team" className="mt-14 scroll-mt-28" aria-labelledby="t-h">
          <h2 id="t-h" className="text-2xl font-extrabold">Meet the team</h2>
          <ul className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,16rem),1fr))]">
            {team.map((t, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-[var(--lift-shadow)]">
                {t.photo ? <img src={t.photo} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 rounded-full object-cover" /> : <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-muted font-extrabold">{t.name[0]?.toUpperCase()}</span>}
                <div className="min-w-0"><p className="truncate font-bold">{t.name}</p>{t.title && <p className="truncate text-xs text-muted-foreground">{t.title}</p>}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tabNow === "reviews" && <AgencyReviews slug={slug} agencyName={a.name} />}
    </main>
  );
}
