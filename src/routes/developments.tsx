import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { VoiceButton } from "@/components/property/voice-button";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { COUNTY_OPTIONS } from "@/lib/pick-options";
import { Pick } from "@/components/ui/pick";
import { Pager } from "@/components/property/results";
import { DevelopmentCard } from "@/components/development/development-card";
import { developmentsQuery } from "@/lib/developments.functions";

type Search = { q?: string | undefined; status?: "upcoming" | "completed" | "off_plan" | "under_construction" | "planning" | undefined; county?: number | undefined; page?: number | undefined };
const STATUSES = [["upcoming", "Upcoming (not finished)"], ["planning", "Planning"], ["off_plan", "Off-plan"], ["under_construction", "Under construction"], ["completed", "Completed"]] as const;
const toParams = (s: Search) => ({ ...(s.q ? { q: s.q } : {}), ...(s.status ? { status: s.status } : {}), ...(s.county ? { countyCode: s.county } : {}), page: s.page ?? 1 });

export const Route = createFileRoute("/developments")({
  validateSearch: (s): Search => {
    const n = (v: unknown) => { const x = Number(v); return Number.isInteger(x) && x > 0 ? x : undefined; };
    return {
      ...(typeof s["q"] === "string" && s["q"].trim() ? { q: s["q"].trim().slice(0, 80) } : {}),
      ...(STATUSES.some(([k]) => k === s["status"]) ? { status: s["status"] as NonNullable<Search["status"]> } : {}),
      ...(n(s["county"]) && n(s["county"])! <= 47 ? { county: n(s["county"])! } : {}), ...(n(s["page"]) && n(s["page"])! > 1 ? { page: n(s["page"])! } : {}),
    };
  },
  head: () => ({ meta: [{ title: "New developments and upcoming projects in Kenya — Hodii" }, { name: "description", content: "Browse new developments, off-plan projects and estates being built across Kenya, with unit types, starting prices and completion dates." }] }),
  component: Developments,
});

const field = "h-11 rounded-xl border border-input bg-background px-3 text-sm";

function Developments() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/developments" });
  const set = (next: Partial<Search>) => navigate({ search: { ...search, ...next, page: next.page } as Search });
  const { data, isPending, isError } = useQuery({ ...developmentsQuery(toParams(search)), placeholderData: keepPreviousData });
  return (
    <main className="mx-auto max-w-[82rem] px-4 pt-36 pb-24">
      <h1 className="text-2xl font-extrabold md:text-3xl">New developments</h1>
      <p className="mt-2 text-muted-foreground">Projects being planned, sold off-plan, built or just finished.</p>
      <form role="search" aria-label="Search developments" onSubmit={(e) => { e.preventDefault(); set({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() || undefined }); }} className="mt-6 flex flex-wrap gap-3">
        <div className="relative min-w-48 flex-1"><input name="q" type="search" defaultValue={search.q ?? ""} key={search.q ?? ""} placeholder="Project or area" aria-label="Project or area" className={`${field} w-full pr-12`} /><VoiceButton onText={(t) => set({ q: t.trim() || undefined })} /></div>
        <Pick label="County" clearLabel="All counties" value={search.county ? String(search.county) : ""} onChange={(v) => set({ county: v ? Number(v) : undefined })} options={COUNTY_OPTIONS} searchable />
        <Pick label="Stage" clearLabel="Any stage" value={search.status ?? ""} onChange={(v) => set({ status: (v || undefined) as Search["status"] })} options={STATUSES.map(([k, l]) => ({ value: k, label: l }))} />
        <button className="h-11 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">Search</button>
      </form>
      {isPending ? <div className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}</div>
        : isError || !data ? <p role="alert" className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">Could not load developments. Please try again.</p>
        : <>
          <p className="mt-6 text-sm font-semibold text-muted-foreground" aria-live="polite">{data.total.toLocaleString("en-KE")} {data.total === 1 ? "development" : "developments"}</p>
          {data.items.length === 0 ? <div className="empty-card"><p className="text-sm font-semibold text-muted-foreground">No developments match yet. Try another county or stage.</p></div> : (
            <ul className="mt-4 grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]">{data.items.map((d) => <li key={d.id}><DevelopmentCard d={d} /></li>)}</ul>
          )}
          <Pager page={search.page ?? 1} pageSize={24} total={data.total} onPage={(page) => { set({ page: page > 1 ? page : undefined }); window.scrollTo({ top: 0 }); }} />
        </>}
      <p className="mt-10 text-sm text-muted-foreground">Developing or selling a project? Agencies add developments from their dashboard.</p>
    </main>
  );
}
