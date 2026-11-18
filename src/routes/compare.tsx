import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { perSqm, toggleCompare, useCompare } from "@/lib/compare";
import { formatArea, formatPrice, listingTypeLabel, propertyTypeLabel } from "@/lib/format";
import { getCompare } from "@/lib/properties.functions";

const idsOf = (s: unknown) => (typeof s === "string" ? [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 4) : []);
const q = (ids: string[]) => queryOptions({ queryKey: ["compare", ids], queryFn: () => getCompare({ data: { ids } }), staleTime: 60_000, enabled: ids.length > 0 });

export const Route = createFileRoute("/compare")({
  validateSearch: (s): { ids?: string | undefined } => (typeof s["ids"] === "string" ? { ids: s["ids"] } : {}),
  head: () => ({ meta: [{ title: `Compare properties — ${BRAND.name}` }, { name: "robots", content: "noindex, follow" }] }),
  component: Compare,
});

function Compare() {
  const { ids: raw } = Route.useSearch();
  const picked = useCompare();
  // A shared link carries its own list; otherwise the browser's own picks are used.
  const ids = raw ? idsOf(raw) : picked;
  const { data, isPending } = useQuery(q(ids));
  const rows: { label: string; value: (p: NonNullable<typeof data>[number]) => React.ReactNode }[] = [
    { label: "Price", value: (p) => <strong>{formatPrice(p.price)}</strong> },
    { label: "For", value: (p) => listingTypeLabel(p.listingType) },
    { label: "Type", value: (p) => propertyTypeLabel(p.propertyType) },
    { label: "Location", value: (p) => [p.areaName, p.county].filter(Boolean).join(", ") || "—" },
    { label: "Bedrooms", value: (p) => (p.bedrooms === null ? "—" : p.bedrooms === 0 ? "Studio" : p.bedrooms) },
    { label: "Bathrooms", value: (p) => p.bathrooms ?? "—" },
    { label: "Parking", value: (p) => p.parking ?? "—" },
    { label: "Size", value: (p) => (p.sizeSqm ? formatArea(p.sizeSqm) : "—") },
    { label: "Price per m²", value: (p) => { const v = p.price && p.listingType === "sale" ? perSqm(p.price.amount, p.sizeSqm) : null; return v ? `${p.price!.currency} ${v.toLocaleString("en-KE")}` : "—"; } },
    { label: "Verified", value: (p) => (p.verified ? "Yes" : "No") },
    { label: "Listed by", value: (p) => p.agency ? <Link to="/agency/$slug" params={{ slug: p.agency.slug }} className="font-semibold text-primary">{p.agency.name}{p.agency.rating ? ` (${p.agency.rating.avg.toFixed(1)}★)` : ""}</Link> : "Private seller" },
  ];
  return (
    <main className="mx-auto max-w-[112rem] px-4 pt-28 pb-24">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Compare properties</h1>
      <p className="mt-2 text-muted-foreground">Up to four listings side by side. Copy the address of this page to share your comparison.</p>
      {ids.length === 0 ? (
        <div className="empty-card mt-8"><p className="font-semibold">Nothing to compare yet.</p><p className="mt-1 text-sm text-muted-foreground">Use the Compare button on a listing, then come back here.</p><Link to="/properties" className="mt-4 inline-block rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">Browse properties</Link></div>
      ) : isPending ? <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading comparison">{Array.from({ length: Math.max(2, ids.length) }, (_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div> : !data?.length ? <p className="mt-8">These listings are no longer available.</p> : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-sm">
            <thead>
              <tr><th className="w-32 p-2" />{data.map((p) => (
                <th key={p.id} scope="col" className="p-2 text-left align-top">
                  <div className="glass overflow-hidden rounded-2xl">
                    {p.image ? <img src={p.image.thumbUrl ?? p.image.url} alt={p.image.alt || p.title} loading="lazy" className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] bg-muted" />}
                    <div className="p-3"><Link to="/property/$slug" params={{ slug: p.slug }} className="line-clamp-2 font-bold hover:underline">{p.title}</Link>
                      {!raw && <button type="button" onClick={() => toggleCompare(p.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"><X className="h-3 w-3" aria-hidden />Remove</button>}
                    </div>
                  </div>
                </th>))}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="odd:bg-muted/40">
                  <th scope="row" className="p-3 text-left font-semibold text-muted-foreground">{r.label}</th>
                  {data.map((p) => <td key={p.id} className="p-3">{r.value(p)}</td>)}
                </tr>))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
