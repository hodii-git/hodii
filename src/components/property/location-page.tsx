import { Link } from "@tanstack/react-router";
import { PropertyGrid } from "./property-card";
import type { LocationPage } from "@/lib/properties.server";
import { absUrl } from "@/lib/site";

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

/** SEO text for a place. Plain statements from our own listings, never invented claims. */
export const locationBlurb = (l: LocationPage) => {
  const total = l.counts.sale + l.counts.rent;
  const where = l.areaSlug ? `${l.name}, ${l.countyName}` : l.name;
  if (!total) return `Browse property in ${where} on Hodii. New listings appear here as agents add them.`;
  const parts = [l.counts.sale ? `${l.counts.sale} for sale` : null, l.counts.rent ? `${l.counts.rent} to rent` : null].filter(Boolean).join(" and ");
  return `${total} ${total === 1 ? "property" : "properties"} in ${where} on Hodii right now: ${parts}.`;
};

export function LocationView({ l }: { l: LocationPage }) {
  const base = { county: String(l.countyCode), ...(l.areaSlug ? { area: l.areaSlug } : {}) };
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: `Property in ${l.name}`, description: locationBlurb(l), url: absUrl(l.areaSlug ? `/locations/${l.countySlug}/${l.areaSlug}` : `/locations/${l.countySlug}`) };
  return (
    <main className="mx-auto max-w-[82rem] px-4 pt-28 pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground"><Link to="/locations" className="hover:underline">Locations</Link>{l.areaSlug && <> / <Link to="/locations/$county" params={{ county: l.countySlug }} className="hover:underline">{l.countyName}</Link></>}</nav>
      <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Property in {l.name}{l.areaSlug ? `, ${l.countyName}` : ""}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{locationBlurb(l)}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/properties" search={{ ...base, for: "sale" }} className="rounded-full bg-primary px-5 py-2.5 font-bold text-primary-foreground">For sale{l.counts.sale ? ` (${l.counts.sale})` : ""}</Link>
        <Link to="/properties" search={{ ...base, for: "rent" }} className="rounded-full border border-input px-5 py-2.5 font-bold">To rent{l.counts.rent ? ` (${l.counts.rent})` : ""}</Link>
      </div>
      {(l.avgSale || l.avgRent) && (
        <dl className="mt-8 grid max-w-xl grid-cols-2 gap-4">
          {l.avgSale && <div className="glass-strong rounded-2xl px-4 py-3"><dt className="text-xs font-bold uppercase text-muted-foreground">Average asking price</dt><dd className="mt-1 font-extrabold">{kes(l.avgSale)}</dd></div>}
          {l.avgRent && <div className="glass-strong rounded-2xl px-4 py-3"><dt className="text-xs font-bold uppercase text-muted-foreground">Average monthly rent</dt><dd className="mt-1 font-extrabold">{kes(l.avgRent)}</dd></div>}
        </dl>
      )}
      <h2 className="mt-12 text-2xl font-extrabold">Listings</h2>
      <div className="mt-4"><PropertyGrid items={l.latest} empty={<div className="empty-card"><p className="text-sm font-semibold text-muted-foreground">No listings here yet.</p></div>} /></div>
      {!l.areaSlug && l.areas.length > 0 && (
        <section aria-labelledby="areas" className="mt-12">
          <h2 id="areas" className="text-2xl font-extrabold">Areas in {l.name}</h2>
          <ul className="mt-4 flex flex-wrap gap-2">{l.areas.map((a) => <li key={a.slug}><Link to="/locations/$county/$area" params={{ county: l.countySlug, area: a.slug }} className="inline-block rounded-full border border-input px-4 py-1.5 text-sm font-semibold hover:bg-muted">{a.name} <span className="text-muted-foreground">({a.count})</span></Link></li>)}</ul>
        </section>
      )}
    </main>
  );
}
