import { Navigation } from "lucide-react";
import { directionsUrl, osmDirectionsUrl } from "@/lib/geo";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BadgeCheck, Bath, BedDouble, Car, Check, ChevronRight, MapPin, Ruler, Share2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { ContactPanel } from "@/components/property/contact-panel";
import { Gallery } from "@/components/property/gallery";
import { PropertyGrid } from "@/components/property/property-card";
import { FeatureIcon, GROUP_TONE, NEARBY_ICON } from "@/components/property/feature-icon";
import { formatDistance } from "@/components/dashboard/nearby-editor";
import { NEARBY_CATEGORIES } from "@/lib/mongodb/taxonomy";
import { CompareButton } from "@/components/property/compare-button";
import { SaveButton } from "@/components/property/save-button";
import { useSavedSet } from "@/components/property/results";
import { formatArea, formatPrice, listingTypeLabel, propertyTypeLabel, timeAgo } from "@/lib/format";
import { FEATURES, FEATURE_GROUPS } from "@/lib/mongodb/taxonomy";
import { propertyQuery, trackListingEvent } from "@/lib/properties.functions";
import { absUrl } from "@/lib/site";
import { shareLink } from "@/lib/share";
import { visitorId } from "@/lib/visitor";
import { ListingComments } from "@/components/property/comments";

export const Route = createFileRoute("/property/$slug")({
  loader: async ({ params, context }) => {
    const r = await context.queryClient.ensureQueryData(propertyQuery(params.slug));
    if (!r) throw notFound();
    return r;
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.property;
    if (!p) return { meta: [{ title: "Listing not found — Hodii" }, { name: "robots", content: "noindex" }] };
    const title = `${p.title} — ${formatPrice(p.price)} | Hodii`;
    const desc = p.description.replace(/\s+/g, " ").slice(0, 155);
    const url = absUrl(`/property/${params.slug}`);
    return {
      meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "website" }, { property: "og:url", content: url },
        ...(p.image ? [{ property: "og:image", content: p.image.url }, { name: "twitter:card", content: "summary_large_image" }] : [])],
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify({
        "@context": "https://schema.org", "@type": "RealEstateListing", name: p.title, description: desc, url, datePosted: p.publishedAt ?? undefined,
        image: p.images.slice(0, 5).map((i) => i.url),
        ...(p.price && { offers: { "@type": "Offer", price: p.price.amount, priceCurrency: p.price.currency } }),
        ...(p.county && { contentLocation: { "@type": "Place", name: `${p.areaName}, ${p.county}` } }),
      }) }],
    };
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-xl px-4 pt-32 pb-24 text-center">
      <h1 className="text-3xl font-extrabold">This listing is no longer available</h1>
      <p className="mt-3 text-muted-foreground">It may have been let, sold or taken down. Here are similar properties.</p>
      <Link to="/properties" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">Browse properties</Link>
    </main>
  ),
  component: PropertyPage,
});

const row = (k: string, v: unknown) => (v === null || v === undefined || v === "" ? null : { k, v: String(v) });
const date = (v: unknown) => (typeof v === "string" ? new Date(v).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : null);
const title = (s: unknown) => (typeof s === "string" ? s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : null);

function PropertyPage() {
  const { property: p, similar, moreFromAgency } = Route.useLoaderData();
  const saved = useSavedSet([p, ...similar, ...moreFromAgency]);
  useEffect(() => { trackListingEvent({ data: { propertyId: p.id, kind: "view", visitorId: visitorId() } }).catch(() => {}); }, [p.id]);

  const d = p.details as Record<string, unknown>;
  const facts = [
    row("Property type", propertyTypeLabel(p.propertyType)), row("Bedrooms", d["bedrooms"] === 0 ? "Studio" : d["bedrooms"]), row("Bathrooms", d["bathrooms"]), row("Parking spaces", d["parkingSpaces"]),
    row("Floor area", typeof d["floorAreaSqm"] === "number" ? formatArea(d["floorAreaSqm"]) : null), row("Plot size", typeof d["plotAreaSqm"] === "number" ? formatArea(d["plotAreaSqm"]) : null),
    row("Furnishing", title(d["furnishing"])), row("Condition", title(d["condition"])), row("Year built", d["yearBuilt"]),
    row("Title", title((p.legal as Record<string, unknown>)["titleType"])),
    ...(p.rental ? [row("Deposit", typeof p.rental["depositMonths"] === "number" ? `${p.rental["depositMonths"]} months` : null), row("Available from", date(p.rental["availableFrom"]))] : []),
    ...(p.shortStay ? [row("Guests", p.shortStay["maxGuests"]), row("Minimum stay", typeof p.shortStay["minNights"] === "number" ? `${p.shortStay["minNights"]} nights` : null)] : []),
    ...(p.sale ? [row("Sale type", title(p.sale["saleType"]))] : []),
    row("Reference", p.referenceCode), row("Listed", timeAgo(p.publishedAt)),
  ].filter((x): x is { k: string; v: string } => !!x);

  const featureLabels = new Map<string, string>(FEATURES.map((f) => [f.key, f.label]));
  const grouped = FEATURE_GROUPS.map((g) => ({ g, items: p.features.filter((k) => FEATURES.find((f) => f.key === k)?.group === g.key) })).filter((x) => x.items.length);
  const share = async () => {
    const r = await shareLink(p.title, window.location.href);
    if (r === "copied") toast.success("Link copied. Paste it anywhere to share.");
    else if (r === "failed") toast.error("Could not share. Copy the address from your browser instead.");
    if (r === "shared" || r === "copied") trackListingEvent({ data: { propertyId: p.id, kind: "share", visitorId: visitorId() } }).catch(() => {});
  };
  const mapUrl = p.location.point ? `https://www.openstreetmap.org/export/embed.html?bbox=${p.location.point.lng - 0.01}%2C${p.location.point.lat - 0.006}%2C${p.location.point.lng + 0.01}%2C${p.location.point.lat + 0.006}&layer=mapnik${p.location.approximate ? "" : `&marker=${p.location.point.lat}%2C${p.location.point.lng}`}` : null;

  return (
    <main className="mx-auto max-w-[82rem] px-4 pt-28 pb-24">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <Link to="/properties" search={{ for: p.listingType }} className="rounded-full bg-foreground px-3 py-1 text-background hover:opacity-85">{listingTypeLabel(p.listingType)}</Link>
          <Link to="/properties" search={{ for: p.listingType, type: p.propertyType }} className="rounded-full bg-muted px-3 py-1 hover:bg-muted/70">{propertyTypeLabel(p.propertyType)}</Link>
          {p.county && <Link to="/properties" search={{ for: p.listingType, county: String(countyCode(p.location.countySlug)) }} className="rounded-full bg-muted px-3 py-1 hover:bg-muted/70">{p.county}</Link>}
          {p.agencyProfile?.verified && <Link to="/agency/$slug" params={{ slug: p.agencyProfile.slug }} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/15"><BadgeCheck className="size-3.5" aria-hidden />Verified agency</Link>}
        </div>
        <h1 className="mt-3 text-xl font-extrabold leading-tight tracking-tight md:text-3xl">{p.title}</h1>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-4 w-4" aria-hidden />{[p.location.address, p.areaName, p.county].filter(Boolean).join(", ")}{p.location.approximate && <span className="text-xs">(exact location shared on request)</span>}</p>
          <div className="flex items-center gap-2"><SaveButton propertyId={p.id} saved={saved.has(p.id)} label /><CompareButton propertyId={p.id} label /><button type="button" data-tour="share" onClick={share} className="inline-flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm font-semibold shadow"><Share2 className="h-4 w-4" aria-hidden />Share</button><a href={`https://wa.me/?text=${encodeURIComponent(`${p.title} on Hodii: ${typeof window !== "undefined" ? window.location.href : ""}`)}`} target="_blank" rel="noopener noreferrer" onClick={() => { trackListingEvent({ data: { propertyId: p.id, kind: "share", visitorId: visitorId() } }).catch(() => {}); }} className="inline-flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm font-semibold shadow">WhatsApp</a></div>
        </div>
      </header>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-8">
          <Gallery images={p.images} plans={p.floorPlans} title={p.title} />
          <div className="grid gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div>
                <p className="text-sm text-muted-foreground">{p.listingType === "rent" ? "Rent" : p.listingType === "short_stay" ? "Price" : "Asking price"}</p>
                <p className="text-3xl font-extrabold tracking-tight md:text-4xl">{formatPrice(p.price)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                {p.price?.negotiable && <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-700 dark:text-emerald-400">Negotiable</span>}
                {p.publishedAt && <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">Listed {timeAgo(p.publishedAt)}</span>}
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([[BedDouble, p.bedrooms === null ? null : p.bedrooms === 0 ? "Studio" : String(p.bedrooms), "Bedrooms"], [Bath, p.bathrooms === null ? null : String(p.bathrooms), "Bathrooms"], [Ruler, p.sizeSqm ? formatArea(p.sizeSqm) : null, "Size"], [Car, p.parking === null ? null : String(p.parking), "Parking"]] as const).map(([Icon, v, l]) => v === null ? null : (
                <li key={l} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted" aria-hidden><Icon className="size-5" /></span><span className="min-w-0"><span className="block truncate text-lg font-extrabold leading-tight">{v}</span><span className="text-xs text-muted-foreground">{l}</span></span></li>
              ))}
            </ul>
          </div>
          {p.highlights.length > 0 && <ul className="grid gap-3 rounded-3xl bg-muted/60 p-6 sm:grid-cols-2">{p.highlights.map((h) => <li key={h} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{h}</li>)}</ul>}
          <section aria-labelledby="desc" className="rounded-3xl border border-border bg-card p-6 shadow-sm"><h2 id="desc" className="mb-4 text-xl font-extrabold">Description</h2><div className="space-y-3 leading-relaxed text-foreground/90">{p.description.split(/\n{2,}/).map((t, i) => <p key={i} className="whitespace-pre-line">{t}</p>)}</div></section>
          <section aria-labelledby="facts" className="rounded-3xl border border-border bg-card p-6 shadow-sm"><h2 id="facts" className="mb-4 text-xl font-extrabold">Property details</h2>
            <dl className="grid gap-x-8 sm:grid-cols-2">{facts.map((f) => <div key={f.k} className="flex justify-between gap-4 border-b border-border py-2 text-sm"><dt className="text-muted-foreground">{f.k}</dt><dd className="text-right font-semibold">{f.v}</dd></div>)}</dl></section>
          {(grouped.length > 0 || p.customFeatures.length > 0) && (
            <section aria-labelledby="feat" className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 id="feat" className="mb-4 text-lg font-extrabold">Features</h2>
              <div className="space-y-5">
                {grouped.map(({ g, items }) => <div key={g.key}><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{g.label}</h3>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{items.map((k) => <li key={k} className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-sm"><span className={`grid size-7 shrink-0 place-items-center rounded-lg ${GROUP_TONE[g.key] ?? GROUP_TONE["other"]}`}><FeatureIcon k={k} group={g.key} className="size-4" /></span><span className="min-w-0 truncate">{featureLabels.get(k) ?? k}</span></li>)}</ul></div>)}
                {p.customFeatures.length > 0 && <div><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Also</h3><ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{p.customFeatures.map((k) => <li key={k} className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-sm"><span className={`grid size-7 shrink-0 place-items-center rounded-lg ${GROUP_TONE["other"]}`}><Check className="size-4" aria-hidden /></span><span className="min-w-0 truncate">{k}</span></li>)}</ul></div>}
              </div></section>
          )}
          {p.nearby.length > 0 && (
            <section aria-labelledby="near" className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 id="near" className="mb-4 text-lg font-extrabold">What is nearby</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {NEARBY_CATEGORIES.map((c) => { const items = p.nearby.filter((n) => n.category === c.key); if (!items.length) return null; const ni = NEARBY_ICON[c.key] ?? NEARBY_ICON["other"]!; const NI = ni.icon; return (
                  <div key={c.key} className="rounded-xl border border-border bg-background p-3">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><span className={`grid size-7 place-items-center rounded-lg ${ni.tone}`}><NI className="size-4" aria-hidden /></span>{c.label}</h3>
                    <ul className="space-y-1.5">{items.map((n, i) => <li key={`${n.name}-${i}`} className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate">{n.name}</span>{n.distanceM !== null && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{formatDistance(n.distanceM)}</span>}</li>)}</ul></div>); })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Listed by the agent. Check distances when you visit.</p>
            </section>
          )}

          {(p.videoUrl || p.virtualTourUrl) && <section className="flex flex-wrap gap-3">{p.videoUrl && <a href={p.videoUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-input px-5 py-2.5 text-sm font-bold">Watch video</a>}{p.virtualTourUrl && <a href={p.virtualTourUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-input px-5 py-2.5 text-sm font-bold">Virtual tour</a>}</section>}
          {mapUrl && <section aria-labelledby="map" className="rounded-3xl border border-border bg-card p-6 shadow-sm"><h2 id="map" className="mb-4 text-xl font-extrabold">Location</h2><iframe title={`Map of ${p.areaName}`} src={mapUrl} loading="lazy" className="h-72 w-full rounded-2xl border border-border" /><div className="mt-3 flex flex-wrap items-center gap-3"><a href={directionsUrl(p.location.point!.lat, p.location.point!.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"><Navigation className="h-4 w-4" aria-hidden />Take me there</a><a href={osmDirectionsUrl(p.location.point!.lat, p.location.point!.lng)} target="_blank" rel="noopener noreferrer" className="text-sm font-bold underline">Open in OpenStreetMap</a>{p.location.approximate && <span className="text-xs text-muted-foreground">Exact address is shared by the agent. Directions lead to the area.</span>}</div>{p.location.landmark && <p className="mt-2 text-sm text-muted-foreground">Near {p.location.landmark}</p>}</section>}
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start"><ContactPanel p={p} /></div>
      </div>
      <ListingComments propertyId={p.id} slug={p.slug} />
      {similar.length > 0 && <section className="mt-14" aria-labelledby="sim"><h2 id="sim" className="text-2xl font-extrabold">You might also like</h2><p className="mb-5 mt-1 text-sm text-muted-foreground">Properties like this one, starting with the closest in kind, place and price.</p><PropertyGrid items={similar} saved={saved} /></section>}
      {moreFromAgency.length > 0 && <section className="mt-14" aria-labelledby="more"><h2 id="more" className="mb-5 text-2xl font-extrabold">More from {p.agencyProfile?.name ?? "this agency"}</h2><PropertyGrid items={moreFromAgency} saved={saved} /></section>}
    </main>
  );
}
import { COUNTY_LIST } from "@/lib/mongodb/kenya";
const countyCode = (slug: string | null) => COUNTY_LIST.find((c) => c.slug === slug)?.code ?? "";
