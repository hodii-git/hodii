import { MapPin as PinIcon, Navigation } from "lucide-react";
import { ListingMap } from "@/components/property/listing-map";
import { ListingSearch } from "@/components/property/listing-search";
import { StickySide } from "@/components/sticky-side";
import { directionsUrl, osmDirectionsUrl } from "@/lib/geo";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Bath, BedDouble, Car, Check, MapPin, Ruler, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ContactPanel } from "@/components/property/contact-panel";
import { Gallery } from "@/components/property/gallery";
import { IconHint, ScrollFade } from "@/components/property/icon-hint";
import { MobileListingHeroBody, MobileListingTopBar } from "@/components/property/mobile-listing-hero";
import { PropertyGrid } from "@/components/property/property-card";
import { FeatureIcon, NEARBY_ICON } from "@/components/property/feature-icon";
import { formatDistance } from "@/components/dashboard/nearby-editor";
import { NEARBY_CATEGORIES } from "@/lib/mongodb/taxonomy";
import { CompareButton } from "@/components/property/compare-button";
import { SaveButton } from "@/components/property/save-button";
import { useSavedSet } from "@/components/property/results";
import { formatArea, formatPrice, propertyTypeLabel, timeAgo } from "@/lib/format";
import { FEATURES, FEATURE_GROUPS } from "@/lib/mongodb/taxonomy";
import { propertyQuery, revealListingContact, trackListingEvent } from "@/lib/properties.functions";
import { absUrl } from "@/lib/site";
import { useCoverWash } from "@/lib/cover-wash";
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
const waContactLink = (num: string, ref: string, listingTitle: string) =>
  `https://wa.me/${num.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello, I am interested in ${listingTitle} (ref ${ref}) on Hodii.`)}`;

function PropertyPage() {
  const { property: p, similar, moreFromAgency } = Route.useLoaderData();
  const saved = useSavedSet([p, ...similar, ...moreFromAgency]);
  const [isSaved, setIsSaved] = useState(saved.has(p.id));
  const [photoIdx, setPhotoIdx] = useState(0);
  const [isLg, setIsLg] = useState(false);
  useEffect(() => { const m = window.matchMedia("(min-width: 1024px)"); const f = () => setIsLg(m.matches); f(); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  const [shownContact, setShownContact] = useState<{ phone: string; whatsapp: string } | null>(null);
  const [busyContact, setBusyContact] = useState<"phone" | "whatsapp" | null>(null);
  useEffect(() => setIsSaved(saved.has(p.id)), [saved, p.id]);
  useEffect(() => {
    setPhotoIdx(0);
    setShownContact(null);
  }, [p.id]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset["listingDark"] = "1";
    const onScroll = () => {
      if (window.scrollY > 140) root.dataset["listingScrolled"] = "1";
      else delete root.dataset["listingScrolled"];
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      delete root.dataset["listingDark"];
      delete root.dataset["listingScrolled"];
    };
  }, []);
  useCoverWash(p.images[0]?.url);
  useEffect(() => { trackListingEvent({ data: { propertyId: p.id, kind: "view", visitorId: visitorId() } }).catch(() => {}); }, [p.id]);

  const revealContact = async (via: "phone" | "whatsapp") => {
    setBusyContact(via);
    try {
      const r = await revealListingContact({ data: { propertyId: p.id, via, visitorId: visitorId() } });
      setShownContact({ phone: r.phone, whatsapp: r.whatsapp });
      if (via === "whatsapp") window.open(waContactLink(r.whatsapp, p.referenceCode, p.title), "_blank", "noopener,noreferrer");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load the contact details"); }
    finally { setBusyContact(null); }
  };

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
  const allMedia = [...p.images, ...p.floorPlans];
  const mobileShortcuts = [
    { id: "facts", label: "Details" },
    grouped.length > 0 || p.customFeatures.length > 0 ? { id: "feat", label: "Features" } : { id: "desc", label: "About" },
    mapUrl ? { id: "map", label: "Location" } : p.nearby.length > 0 ? { id: "near", label: "Nearby" } : { id: "comments", label: "Comments" },
    { id: "contact", label: "Contact" },
  ];

  return (
    <main className="listing-page mx-auto max-w-[82rem] px-0 pt-0 pb-48 md:pb-24 lg:pt-28">
      <MobileListingTopBar p={p} />
      <ListingSearch />
      <header className="hidden">
        <h1 className="text-xl font-extrabold leading-tight md:text-3xl">{p.title}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-4 w-4" aria-hidden />{[p.location.address, p.areaName, p.county].filter(Boolean).join(", ")}{p.location.approximate && <span className="text-xs">(exact location shared on request)</span>}</p>
        </div>
      </header>
      <div className="grid gap-5 md:gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:px-4">
        <div className="min-w-0 space-y-0 md:space-y-6">
          <div className="px-1.5 md:px-0">
            <Gallery mobileHero activeIndex={photoIdx} onIndexChange={setPhotoIdx} images={p.images} plans={p.floorPlans} title={p.title} actions={<ScrollFade className="flex items-center gap-1">
              <IconHint label="Compare"><CompareButton bare propertyId={p.id} /></IconHint>
              <IconHint label={isSaved ? "Saved" : "Save"}><span className="ld-heart grid size-8 place-items-center"><SaveButton propertyId={p.id} saved={isSaved} onChange={setIsSaved} /></span></IconHint>
              <IconHint label="Share"><button type="button" data-tour="share" onClick={share} aria-label="Share" className="hero-icon inline-flex size-8 items-center justify-center transition hover:scale-105"><Share2 className="h-[17px] w-5" preserveAspectRatio="none" strokeWidth={2.2} aria-hidden /></button></IconHint>
            </ScrollFade>} />
          </div>
          <MobileListingHeroBody p={p} isSaved={isSaved} onSavedChange={setIsSaved} shown={shownContact} busy={busyContact} onReveal={revealContact} shortcuts={mobileShortcuts} />
          <div className="space-y-4 px-3 pt-2 md:space-y-6 md:px-6 md:pt-4 lg:px-0">
          {allMedia.length > 1 && (
            <section aria-label="Photo thumbnails" className="rounded-2xl bg-card/85 p-3.5 lg:hidden">
              <ul className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {allMedia.map((im, k) => (
                  <li key={im.url} className="shrink-0">
                    <button type="button" onClick={() => { setPhotoIdx(k); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={k >= p.images.length ? `Show floor plan ${k - p.images.length + 1}` : `Show photo ${k + 1}`} aria-current={k === photoIdx} className={`block overflow-hidden rounded-xl border-2 transition ${k === photoIdx ? "border-zinc-500" : "border-transparent opacity-70"}`}>
                      <img src={im.thumbUrl ?? im.url} alt="" width={88} height={64} loading="lazy" className={`h-16 w-[5.5rem] ${k >= p.images.length ? "bg-white object-contain" : "object-cover"}`} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(p.location.address || p.location.approximate) && (
            <div className="flex items-start gap-2 rounded-2xl bg-card/85 px-4 py-3 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0 text-white" aria-hidden />
              <p>{[p.location.address, p.areaName, p.county].filter(Boolean).join(", ")}{p.location.approximate && <span className="ml-1.5 text-xs opacity-80">(exact location shared on request)</span>}</p>
            </div>
          )}
          <div className="grid gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-3xl bg-card/85 backdrop-blur-md p-6 shadow-sm">
              <div>
                <p className="text-sm text-muted-foreground">{p.listingType === "rent" ? "Rent" : p.listingType === "short_stay" ? "Price" : "Asking price"}</p>
                <p className="text-3xl font-extrabold md:text-4xl">{formatPrice(p.price)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                {p.price?.negotiable && <span className="rounded-full bg-[var(--ld-price)]/15 px-3 py-1 text-[var(--ld-price)]">Negotiable</span>}
                {p.publishedAt && <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">Listed {timeAgo(p.publishedAt)}</span>}
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([[BedDouble, p.bedrooms === null ? null : p.bedrooms === 0 ? "Studio" : String(p.bedrooms), "Bedrooms"], [Bath, p.bathrooms === null ? null : String(p.bathrooms), "Bathrooms"], [Ruler, p.sizeSqm ? formatArea(p.sizeSqm) : null, "Size"], [Car, p.parking === null ? null : String(p.parking), "Parking"]] as const).map(([Icon, v, l]) => v === null ? null : (
                <li key={l} className="flex items-center gap-3 rounded-2xl bg-card/85 backdrop-blur-md p-4 shadow-sm"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted" aria-hidden><Icon className="size-5" /></span><span className="min-w-0"><span className="block truncate text-lg font-extrabold leading-tight">{v}</span><span className="text-xs text-muted-foreground">{l}</span></span></li>
              ))}
            </ul>
          </div>
          {p.highlights.length > 0 && <ul className="grid gap-3 rounded-3xl bg-card/80 p-6 shadow-[var(--lift-shadow)] backdrop-blur-md sm:grid-cols-2">{p.highlights.map((h) => <li key={h} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{h}</li>)}</ul>}
          <section aria-labelledby="desc" className="scroll-mt-16 rounded-3xl bg-card/85 backdrop-blur-md p-6 shadow-sm"><h2 id="desc" className="mb-4 text-xl font-extrabold">Description</h2><div className="space-y-3 leading-relaxed text-foreground/90">{p.description.split(/\n{2,}/).map((t, i) => <p key={i} className="whitespace-pre-line">{t}</p>)}</div></section>
          <section aria-labelledby="facts" className="scroll-mt-16 rounded-3xl bg-card/85 backdrop-blur-md p-6 shadow-sm"><h2 id="facts" className="mb-4 text-xl font-extrabold">Property details</h2>
            <dl className="grid gap-x-8 sm:grid-cols-2">{facts.map((f) => <div key={f.k} className="flex justify-between gap-4 border-b border-border py-2 text-sm"><dt className="text-muted-foreground">{f.k}</dt><dd className="text-right font-semibold">{f.v}</dd></div>)}</dl></section>
          {(grouped.length > 0 || p.customFeatures.length > 0) && (
            <section aria-labelledby="feat" className="scroll-mt-16 rounded-2xl bg-card/85 backdrop-blur-md p-5 shadow-sm"><h2 id="feat" className="mb-4 text-lg font-extrabold">Features</h2>
              <div className="space-y-5">
                {grouped.map(({ g, items }) => <div key={g.key}><h3 className="mb-2 text-xs font-bold uppercase text-muted-foreground">{g.label}</h3>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{items.map((k) => <li key={k} className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-sm"><span className={`grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-foreground`}><FeatureIcon k={k} group={g.key} className="size-4" /></span><span className="min-w-0 truncate">{featureLabels.get(k) ?? k}</span></li>)}</ul></div>)}
                {p.customFeatures.length > 0 && <div><h3 className="mb-2 text-xs font-bold uppercase text-muted-foreground">Also</h3><ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{p.customFeatures.map((k) => <li key={k} className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-sm"><span className={`grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-foreground`}><Check className="size-4" aria-hidden /></span><span className="min-w-0 truncate">{k}</span></li>)}</ul></div>}
              </div></section>
          )}
          {p.nearby.length > 0 && (
            <section aria-labelledby="near" className="scroll-mt-16 rounded-2xl bg-card/85 backdrop-blur-md p-5 shadow-sm"><h2 id="near" className="mb-4 text-lg font-extrabold">What is nearby</h2>
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
          {mapUrl && <section aria-labelledby="map" className="scroll-mt-16 rounded-3xl bg-card/85 backdrop-blur-md p-6 shadow-sm"><h2 id="map" className="mb-4 text-xl font-extrabold text-center">Location</h2>
            <ListingMap lat={p.location.point!.lat} lng={p.location.point!.lng} label={p.areaName || p.title} />
            <div className="mt-3 flex flex-wrap items-center gap-3 flex-col items-center text-center"><a href={directionsUrl(p.location.point!.lat, p.location.point!.lng)} target="_blank" rel="noopener noreferrer" className="take-btn inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"><Navigation className="h-4 w-4" aria-hidden />Take me there</a><a href={osmDirectionsUrl(p.location.point!.lat, p.location.point!.lng)} target="_blank" rel="noopener noreferrer" className="text-sm font-bold underline">Open in OpenStreetMap</a>{p.location.approximate && <span className="text-xs text-muted-foreground">Exact location is shared by the agent. Directions lead to the area.</span>}</div>{p.location.landmark && <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted-foreground"><PinIcon className="size-4 shrink-0 text-zinc-500" aria-hidden />Near {p.location.landmark}</p>}</section>}
          {isLg && <ListingComments propertyId={p.id} slug={p.slug} />}
          </div>
        </div>
        <div className="px-3 md:px-6 lg:px-0"><StickySide offset={96}><ContactPanel p={p} shown={shownContact} busy={busyContact} onReveal={revealContact} /></StickySide></div>
        {!isLg && <div className="px-1.5 md:px-6"><ListingComments propertyId={p.id} slug={p.slug} /></div>}
      </div>
      {similar.length > 0 && <section className="plain-sec mt-10 px-3 md:mt-14 md:px-6 lg:px-4" aria-labelledby="sim"><h2 id="sim" className="text-lg font-bold md:text-2xl md:font-extrabold">You might also like</h2><p className="mb-5 mt-1 text-sm text-muted-foreground">Properties like this one, starting with the closest in kind, place and price.</p><PropertyGrid items={similar} saved={saved} /></section>}
      {moreFromAgency.length > 0 && <section className="plain-sec mt-10 px-3 md:mt-14 md:px-6 lg:px-4" aria-labelledby="more"><h2 id="more" className="mb-5 text-lg font-bold md:text-2xl md:font-extrabold">More from {p.agencyProfile?.name ?? "this agency"}</h2><PropertyGrid items={moreFromAgency} saved={saved} /></section>}
    </main>
  );
}
