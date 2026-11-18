import { Link } from "@tanstack/react-router";
import { BadgeCheck, Bath, BedDouble, Camera, MapPin, Ruler, TrendingDown } from "lucide-react";
import { TierBadge } from "./tier-badge";
import { CompareButton } from "./compare-button";
import { setHoverPin } from "@/lib/hover-pin";
import { SaveButton } from "./save-button";
import { formatArea, formatPrice, listingTypeLabel, propertyTypeLabel, timeAgo } from "@/lib/format";
import type { PropertyCard as Card } from "@/lib/property-dto";

/** One listing in a grid. The whole card is a link; the save button sits above it. */
export function PropertyCard({ p, saved, priority = false }: { p: Card; saved?: boolean | undefined; priority?: boolean }) {
  const where = [p.areaName, p.county].filter(Boolean).join(", ");
  return (
    <article onPointerEnter={() => setHoverPin(p.id)} onPointerLeave={() => setHoverPin(null)} onFocusCapture={() => setHoverPin(p.id)} onBlurCapture={() => setHoverPin(null)} className="glass group relative flex min-w-0 flex-col overflow-hidden rounded-2xl">
      <div className="relative aspect-[4/3] bg-muted">
        {p.image ? (
          <img src={p.image.thumbUrl ?? p.image.url} alt={p.image.alt || p.title} width={640} height={480} loading={priority ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground"><Camera className="h-8 w-8" aria-hidden /></div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-background/90 px-2.5 py-1 text-xs font-bold backdrop-blur">{listingTypeLabel(p.listingType)}</span>
          {p.tier !== "none" && <TierBadge tier={p.tier} />}
          {p.priceDrop && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white"><TrendingDown className="h-3 w-3" aria-hidden />Price drop</span>}
        </div>
        {p.imageCount > 1 && <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white"><Camera className="h-3 w-3" aria-hidden />{p.imageCount}</span>}
        <div className="absolute right-3 top-3 flex flex-col gap-1.5"><SaveButton propertyId={p.id} saved={saved} /><CompareButton propertyId={p.id} /></div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xl font-extrabold tracking-tight">{formatPrice(p.price)}</p>
        <h3 className="line-clamp-2 text-base font-semibold leading-snug">
          <Link to="/property/$slug" params={{ slug: p.slug }} className="after:absolute after:inset-0 after:content-['']">{p.title}</Link>
        </h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate">{where}</span></p>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Property facts">
          <li className="font-medium text-foreground">{propertyTypeLabel(p.propertyType)}</li>
          {p.bedrooms !== null && <li className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" aria-hidden />{p.bedrooms === 0 ? "Studio" : p.bedrooms}</li>}
          {p.bathrooms !== null && <li className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" aria-hidden />{p.bathrooms}</li>}
          {p.sizeSqm ? <li className="inline-flex items-center gap-1"><Ruler className="h-3.5 w-3.5" aria-hidden />{formatArea(p.sizeSqm)}</li> : null}
        </ul>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1 truncate">
            {p.agency?.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Verified agency" />}
            <span className="truncate">{p.agency?.name ?? "Private seller"}</span>
          </span>
          <span className="shrink-0">{timeAgo(p.publishedAt)}</span>
        </div>
      </div>
    </article>
  );
}

export function PropertyGrid({ items, saved, empty }: { items: Card[]; saved?: ReadonlySet<string> | undefined; empty?: React.ReactNode }) {
  if (!items.length) return <>{empty}</>;
  return (
    <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
      {items.map((p, i) => <PropertyCard key={p.id} p={p} saved={saved?.has(p.id)} priority={i < 3} />)}
    </div>
  );
}
