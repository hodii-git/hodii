import { Link } from "@tanstack/react-router";
import { BadgeCheck, Bath, BedDouble, Camera, ChevronLeft, ChevronRight, MapPin, Ruler, TrendingDown } from "lucide-react";
import { useRef, useState } from "react";
import { CompareButton } from "./compare-button";
import { setHoverPin } from "@/lib/hover-pin";
import { SaveButton } from "./save-button";
import { formatArea, formatPrice, listingTypeLabel, propertyTypeLabel, timeAgo } from "@/lib/format";
import type { PropertyCard as Card } from "@/lib/property-dto";

/** The pill on the photo carries the listing's rank in its colour, with no wording: Premium gold, boosted silver, everything else frosted white. */
const PILL: Record<Card["tier"], string> = {
  premium: "bg-gradient-to-r from-amber-400 to-orange-500 text-black",
  boost: "bg-gradient-to-r from-zinc-100 via-zinc-300 to-zinc-400 text-zinc-900",
  none: "bg-background/90 backdrop-blur",
};

/** Photos in a swipe strip with Instagram-style dots: the active dot is wide, the rest shrink toward the right. */
function CardPhotos({ p, priority }: { p: Card; priority: boolean }) {
  const photos = [p.image, ...p.more].filter((x): x is NonNullable<typeof x> => Boolean(x));
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  if (!photos.length) return <div className="flex h-full items-center justify-center text-muted-foreground"><Camera className="h-8 w-8" aria-hidden /></div>;
  const onScroll = () => { const el = ref.current; if (el) setI(Math.round(el.scrollLeft / el.clientWidth)); };
  return (
    <>
      <div ref={ref} onScroll={onScroll} className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {photos.map((im, n) => (
          <img key={im.url} src={im.thumbUrl ?? im.url} alt={n === 0 ? im.alt || p.title : im.alt || `${p.title}, photo ${n + 1}`} width={640} height={480} loading={priority && n === 0 ? "eager" : "lazy"} decoding="async" className="h-full w-full shrink-0 snap-center object-cover" />
        ))}
      </div>
      {photos.length > 1 && (["prev", "next"] as const).map((d) => {
        const go = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); const el = ref.current; if (el) el.scrollTo({ left: (i + (d === "next" ? 1 : -1)) * el.clientWidth, behavior: "smooth" }); };
        const off = d === "prev" ? i === 0 : i === photos.length - 1;
        return off ? null : (
          <button key={d} type="button" onClick={go} aria-label={d === "next" ? "Next photo" : "Previous photo"} className={`absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-zinc-900 opacity-0 shadow-md transition hover:scale-105 group-hover/ph:opacity-100 focus-visible:opacity-100 [@media(hover:hover)]:grid ${d === "next" ? "right-2" : "left-2"}`}>
            {d === "next" ? <ChevronRight className="size-4" aria-hidden /> : <ChevronLeft className="size-4" aria-hidden />}
          </button>
        );
      })}
      {photos.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-center gap-1" aria-hidden>
          {photos.map((im, n) => {
            const size = n === i ? 0 : Math.max(3, 7 - Math.abs(n - i) - (n > i ? 1 : 0));
            return <span key={im.url} style={n === i ? { width: 14, height: 6 } : { width: size, height: size }} className={`rounded-full transition-all duration-200 ${n === i ? "bg-white" : "bg-white/55"}`} />;
          })}
        </div>
      )}
    </>
  );
}

/** One listing in a grid. The whole card is a link; the save button sits above it. */
export function PropertyCard({ p, saved, priority = false }: { p: Card; saved?: boolean | undefined; priority?: boolean }) {
  const where = [p.areaName, p.county].filter(Boolean).join(", ");
  return (
    <article onPointerEnter={() => setHoverPin(p.id)} onPointerLeave={() => setHoverPin(null)} onFocusCapture={() => setHoverPin(p.id)} onBlurCapture={() => setHoverPin(null)} className="glass group relative flex min-w-0 flex-col overflow-hidden rounded-2xl">
      <div className="group/ph relative aspect-[4/3] bg-muted">
        <CardPhotos p={p} priority={priority} />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${PILL[p.tier]}`}>{listingTypeLabel(p.listingType)}</span>
          {p.priceDrop && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white"><TrendingDown className="h-3 w-3" aria-hidden />Price drop</span>}
        </div>
        <div className="absolute right-3 top-3 flex items-center gap-1"><CompareButton propertyId={p.id} /><SaveButton propertyId={p.id} saved={saved} /></div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-lg font-bold tracking-tight">{formatPrice(p.price)}</p>
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">
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
