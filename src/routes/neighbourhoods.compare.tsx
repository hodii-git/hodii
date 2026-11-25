import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Stars } from "@/components/agency/stars";
import { ASPECTS } from "@/lib/neighbourhood";
import { compareAreas } from "@/lib/neighbourhoods.functions";

type Search = { a?: string | undefined };
export const Route = createFileRoute("/neighbourhoods/compare")({
  validateSearch: (s): Search => ({ ...(typeof s["a"] === "string" ? { a: s["a"].slice(0, 400) } : {}) }),
  head: () => ({ meta: [{ title: "Compare neighbourhoods — Hodii" }, { name: "robots", content: "noindex" }] }),
  component: Compare,
});
const kes = (n: number | null) => (n ? `KES ${n.toLocaleString("en-KE")}` : "—");

function Compare() {
  const { a } = Route.useSearch();
  const keys = (a ?? "").split(",").filter((k) => /^[a-z0-9-]{2,60}\/[a-z0-9-]{2,80}$/.test(k)).slice(0, 3);
  const { data, isPending, isError } = useQuery({ queryKey: ["nb-compare", keys], queryFn: () => compareAreas({ data: { keys } }), enabled: keys.length > 0 });
  return (
    <main className="mx-auto max-w-6xl px-4 pt-28 pb-24">
      <Link to="/neighbourhoods" className="text-sm font-bold text-primary hover:underline">← All neighbourhoods</Link>
      <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Compare neighbourhoods</h1>
      {keys.length === 0 ? <p className="mt-6 text-muted-foreground">Pick two or three neighbourhoods on the list first.</p> : isPending ? <div className="mt-6 h-64 animate-pulse rounded-2xl bg-muted" /> : isError || !data ? <p role="alert" className="mt-6 text-destructive">Could not load the comparison. Please try again.</p> : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-muted"><tr><th className="p-3" scope="col"><span className="sr-only">Measure</span></th>{data.map((n) => <th key={n.key} scope="col" className="p-3 text-base"><Link to="/neighbourhoods/$county/$area" params={{ county: n.countySlug, area: n.areaSlug }} className="font-extrabold hover:underline">{n.name}</Link><span className="block text-xs font-normal text-muted-foreground">{n.county}</span></th>)}</tr></thead>
            <tbody>
              <Row label="Overall">{data.map((n) => <td key={n.key} className="p-3">{n.summary.overall ? <span className="inline-flex items-center gap-2"><Stars value={n.summary.overall} size={14} /><b>{n.summary.overall.toFixed(1)}</b><span className="text-muted-foreground">({n.summary.count})</span></span> : "No reviews yet"}</td>)}</Row>
              {ASPECTS.map((x) => { const best = Math.max(...data.map((n) => n.summary.aspects[x.key]?.avg ?? 0)); return (
                <Row key={x.key} label={x.label}>{data.map((n) => { const v = n.summary.aspects[x.key]; return <td key={n.key} className={`p-3 tabular-nums ${v && v.avg === best && data.length > 1 ? "font-extrabold" : ""}`}>{v ? <>{v.avg.toFixed(1)}{v.avg === best && data.length > 1 ? <span className="ml-1 text-xs font-normal text-primary">best</span> : null}</> : "—"}</td>; })}</Row>
              ); })}
              <Row label="Live listings">{data.map((n) => <td key={n.key} className="p-3">{n.listings}</td>)}</Row>
              <Row label="Average rent">{data.map((n) => <td key={n.key} className="p-3">{kes(n.rent)}</td>)}</Row>
              <Row label="Average sale price">{data.map((n) => <td key={n.key} className="p-3">{kes(n.sale)}</td>)}</Row>
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Ratings are opinions from Hodii members. Prices are averages of current listings, not valuations.</p>
    </main>
  );
}
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <tr className="border-t border-border"><th scope="row" className="p-3 font-semibold">{label}</th>{children}</tr>;
