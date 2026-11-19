import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { COUNTY_OPTIONS, toOptions } from "@/lib/pick-options";
import { Pick } from "@/components/ui/pick";
import { BadgeCheck, MapPin } from "lucide-react";
import { Stars } from "@/components/agency/stars";
import { Pager } from "@/components/property/results";
import { agencyDirectoryQuery } from "@/lib/properties.functions";
import { COUNTY_LIST } from "@/lib/mongodb/kenya";
import { AGENCY_KINDS } from "@/lib/mongodb/taxonomy";
import { absUrl } from "@/lib/site";

type Search = { q?: string | undefined; county?: number | undefined; kind?: string | undefined; verified?: boolean | undefined; sort?: "rating" | "listings" | "newest" | "name" | undefined; page?: number | undefined };
const SORTS = [["rating", "Best rated"], ["listings", "Most listings"], ["newest", "Newest"], ["name", "A to Z"]] as const;
const toParams = (s: Search) => ({ ...(s.q ? { q: s.q } : {}), ...(s.county ? { countyCode: s.county } : {}), ...(s.kind ? { kind: s.kind } : {}), ...(s.verified ? { verifiedOnly: true } : {}), sort: s.sort ?? "rating", page: s.page ?? 1 });

export const Route = createFileRoute("/agencies")({
  validateSearch: (s): Search => {
    const n = (v: unknown) => { const x = Number(v); return Number.isInteger(x) && x > 0 ? x : undefined; };
    return {
      ...(typeof s["q"] === "string" && s["q"].trim() ? { q: s["q"].trim().slice(0, 80) } : {}), ...(n(s["county"]) && n(s["county"])! <= 47 ? { county: n(s["county"])! } : {}),
      ...(typeof s["kind"] === "string" && AGENCY_KINDS.some((k) => k.key === s["kind"]) ? { kind: s["kind"] } : {}), ...(s["verified"] === true || s["verified"] === "true" || s["verified"] === "1" ? { verified: true } : {}),
      ...(SORTS.some(([k]) => k === s["sort"]) ? { sort: s["sort"] as NonNullable<Search["sort"]> } : {}), ...(n(s["page"]) && n(s["page"])! > 1 ? { page: n(s["page"])! } : {}),
    };
  },
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps, context }) => context.queryClient.ensureQueryData(agencyDirectoryQuery(toParams(deps.search))),
  head: () => ({ meta: [{ title: "Estate agents and property developers in Kenya — Hodii" }, { name: "description", content: "Find verified estate agencies, developers and property managers in Kenya. Read reviews and browse their listings." }], links: [{ rel: "canonical", href: absUrl("/agencies") }] }),
  component: Directory,
});

const field = "h-11 rounded-xl border border-input bg-background px-3 text-sm";

function Directory() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/agencies" });
  const set = (next: Partial<Search>) => navigate({ search: { ...search, ...next, page: next.page } as Search });
  return (
    <main className="mx-auto max-w-[82rem] px-4 pt-28 pb-24">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Agents and developers</h1>
      <p className="mt-2 text-muted-foreground">Find who you are dealing with before you get in touch.</p>
      <form role="search" aria-label="Search agencies" onSubmit={(e) => { e.preventDefault(); set({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() || undefined }); }} className="mt-6 flex flex-wrap gap-3">
        <input name="q" type="search" defaultValue={search.q ?? ""} key={search.q ?? ""} placeholder="Search by name" aria-label="Agency name" className={`${field} min-w-48 flex-1`} />
        <Pick label="County" clearLabel="All counties" value={search.county ? String(search.county) : ""} onChange={(v) => set({ county: v ? Number(v) : undefined })} options={COUNTY_OPTIONS} searchable />
        <Pick label="Type" clearLabel="All types" value={search.kind ?? ""} onChange={(v) => set({ kind: v || undefined })} options={toOptions(AGENCY_KINDS)} />
        <Pick label="Sort by" value={search.sort ?? "rating"} onChange={(v) => set({ sort: v as Search["sort"] })} options={SORTS.map(([k, l]) => ({ value: k, label: l }))} />
        <label className="flex h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!search.verified} onChange={(e) => set({ verified: e.target.checked || undefined })} className="size-4" />Verified only</label>
        <button className="h-11 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">Search</button>
      </form>
      <p className="mt-6 text-sm font-semibold text-muted-foreground" aria-live="polite">{data.total.toLocaleString("en-KE")} {data.total === 1 ? "agency" : "agencies"}</p>
      {data.items.length === 0 ? <p className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">No agencies match. Try a different county or clear the filters.</p> : (
        <ul className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]">
          {data.items.map((a) => (
            <li key={a.slug}>
              <Link to="/agency/$slug" params={{ slug: a.slug }} className="flex h-full gap-4 rounded-2xl border border-border p-4 transition hover:border-primary hover:shadow-sm">
                {a.logo ? <img src={a.logo} alt="" width={64} height={64} loading="lazy" className="h-16 w-16 shrink-0 rounded-xl bg-white object-contain p-1" /> : <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl font-extrabold">{a.name[0]}</span>}
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-extrabold"><span className="truncate">{a.name}</span>{a.verified && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified" />}</span>
                  {a.tagline && <span className="line-clamp-1 block text-xs text-muted-foreground">{a.tagline}</span>}
                  <span className="mt-1 flex items-center gap-2 text-xs">{a.rating ? <><Stars value={a.rating.avg} size={14} /><span className="font-bold">{a.rating.avg.toFixed(1)}</span><span className="text-muted-foreground">({a.rating.count})</span></> : <span className="text-muted-foreground">No reviews yet</span>}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">{(a.area || a.countyCode) && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{a.area ?? COUNTY_LIST.find((c) => c.code === a.countyCode)?.name}</span>}<span>{a.listings} {a.listings === 1 ? "listing" : "listings"}</span></span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => { set({ page: page > 1 ? page : undefined }); window.scrollTo({ top: 0 }); }} />
    </main>
  );
}
