import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { COUNTY_OPTIONS, toOptions } from "@/lib/pick-options";
import { Pick } from "@/components/ui/pick";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, BadgeCheck, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceButton } from "@/components/property/voice-button";
import { POPUP_CARD, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

/** The homepage search card, copied: type to search (it updates by itself), mic and send inside the bar, filters beneath with the rest in a pop-up. */
function AgencySearch({ q, onQ, children, more, onClear, active }: { q: string; onQ: (q: string) => void; children: ReactNode; more: ReactNode; onClear: () => void; active: number }) {
  const [text, setText] = useState(q);
  const [moreOpen, setMoreOpen] = useState(false);
  const applied = useRef(q);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { if (q !== applied.current) { applied.current = q; setText(q); } }, [q]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const run = (v: string, wait = 800) => { setText(v); clearTimeout(timer.current); const t = v.trim(); const go = () => { if (t !== applied.current) { applied.current = t; onQ(t); } }; if (t === "") go(); else timer.current = setTimeout(go, wait); };
  const clearAll = () => { clearTimeout(timer.current); setText(""); applied.current = ""; onClear(); };
  return (
    <form role="search" aria-label="Search agencies" onSubmit={(e) => { e.preventDefault(); run(text, 0); }} className="home-search glass-solid mt-6 flex flex-col gap-3 rounded-[2rem] p-3 sm:p-4">
      <div className="input-glass relative flex min-w-0 items-center gap-3 rounded-[1.5rem] px-5 py-3">
        <Search className="size-5 shrink-0" strokeWidth={1.7} aria-hidden />
        <label htmlFor="agency-q" className="sr-only">Search agents and developers</label>
        <input id="agency-q" data-bare type="text" inputMode="search" maxLength={120} value={text} onChange={(e) => run(e.target.value)} placeholder="Search agents and developers by name" className="min-h-6 min-w-0 flex-1 bg-transparent pr-[5.4rem] text-base leading-6 outline-hidden placeholder:text-muted-foreground md:text-[1.05rem]" />
        <span className="ai-mic inline-flex"><VoiceButton onText={(t) => run(t, 0)} /></span>
        <button type="submit" aria-label="Search" className="cta-ink absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full"><ArrowUp className="size-4" /></button>
      </div>
      <div className="flex min-w-0 flex-row flex-nowrap items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="input-glass flex w-auto shrink-0 items-center rounded-xl px-3">
          <Button variant="ghost" type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)} className="flex h-10 items-center gap-2 bg-transparent p-0 text-sm hover:bg-transparent">
            <SlidersHorizontal className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            <span className="relative whitespace-nowrap pr-2 font-semibold">More filters{active > 0 && <span className="cta absolute -right-0.5 -top-3 grid h-[1.1rem] min-w-[1.1rem] place-items-center rounded-full px-1 text-[0.65rem] font-bold leading-none">{active}</span>}</span>
          </Button>
        </div>
        {children}
        {(active > 0 || text) && <button type="button" data-tour="clear-all" onClick={clearAll} className="ml-auto inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-3 text-sm font-semibold"><X className="size-4" aria-hidden />Clear all</button>}
      </div>
      {moreOpen && typeof document !== "undefined" && createPortal(<div aria-hidden className="popup-scrim fixed inset-0 z-[55]" onClick={() => setMoreOpen(false)} />, document.body)}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen} modal={false}>
        <DialogContent className={`${POPUP_CARD} z-[81] sm:max-w-md`}>
          <DialogHeader className="text-left"><DialogTitle>More filters</DialogTitle><DialogDescription className="sr-only">Sort and narrow the list of agents and developers</DialogDescription></DialogHeader>
          <div className="mt-2 flex flex-col gap-3">{more}</div>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function Directory() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/agencies" });
  const set = (next: Partial<Search>) => navigate({ search: { ...search, ...next, page: next.page } as Search });
  return (
    <main className="mx-auto max-w-[112rem] px-4 pt-36 pb-24">
      <h1 className="text-2xl font-extrabold md:text-3xl">Agents and developers</h1>
      <p className="mt-2 text-muted-foreground">Find who you are dealing with before you get in touch.</p>
      <AgencySearch q={search.q ?? ""} onQ={(q) => set({ q: q || undefined })} active={[search.county, search.kind, search.verified, search.sort && search.sort !== "rating"].filter(Boolean).length} onClear={() => navigate({ search: {} as never })} more={<>
        <Pick label="Sort by" value={search.sort ?? "rating"} onChange={(v) => set({ sort: v as Search["sort"] })} options={SORTS.map(([k, l]) => ({ value: k, label: l }))} />
        <button type="button" aria-pressed={!!search.verified} onClick={() => set({ verified: search.verified ? undefined : true })} className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold ${search.verified ? "bg-foreground text-background" : "bg-card shadow-[var(--btn-shadow)]"}`}><BadgeCheck className="size-4" aria-hidden />Verified only</button>
      </>}>
        <Pick label="County" clearLabel="All counties" value={search.county ? String(search.county) : ""} onChange={(v) => set({ county: v ? Number(v) : undefined })} options={COUNTY_OPTIONS} searchable />
        <Pick label="Type" clearLabel="All types" value={search.kind ?? ""} onChange={(v) => set({ kind: v || undefined })} options={toOptions(AGENCY_KINDS)} />
      </AgencySearch>
      <p className="mt-6 text-sm font-semibold text-muted-foreground" aria-live="polite">{data.total.toLocaleString("en-KE")} {data.total === 1 ? "agency" : "agencies"}</p>
      {data.items.length === 0 ? <p className="mt-6 rounded-2xl bg-[var(--surface)] p-10 text-center text-muted-foreground">No agencies match. Try a different county or clear the filters.</p> : (
        <ul className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]">
          {data.items.map((a) => (
            <li key={a.slug}>
              <Link to="/agency/$slug" params={{ slug: a.slug }} className="agent-card flex h-full gap-4 rounded-2xl bg-card p-4">
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
