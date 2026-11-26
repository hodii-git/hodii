import { useCardLayout } from "@/lib/card-layout";
import { Link, useNavigate } from "@tanstack/react-router";
import { Camera, ChevronLeft, ChevronRight, TrendingDown } from "lucide-react";
import { useRef, useState } from "react";
import { CompareButton } from "./compare-button";
import { setHoverPin } from "@/lib/hover-pin";
import { SaveButton } from "./save-button";
import { describeListing, formatPrice, listingTypeLabel } from "@/lib/format";
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
          <img key={im.url} src={im.thumbUrl ?? im.url} alt={n === 0 ? im.alt || p.title : im.alt || `${p.title}, photo ${n + 1}`} width={640} height={480} loading={(priority && n === 0) || n < 3 ? "eager" : "lazy"} decoding="async" className="h-full w-full shrink-0 snap-center object-cover" />
        ))}
      </div>
      {photos.length > 1 && (["prev", "next"] as const).map((d) => {
        const go = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); const el = ref.current; if (el) el.scrollTo({ left: (i + (d === "next" ? 1 : -1)) * el.clientWidth, behavior: "smooth" }); };
        const off = d === "prev" ? i === 0 : i === photos.length - 1;
        return off ? null : (
          <button key={d} type="button" onClick={go} aria-label={d === "next" ? "Next photo" : "Previous photo"} className={`absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 place-items-center rounded-full glass-chevron opacity-0 transition hover:scale-105 group-hover/ph:opacity-100 focus-visible:opacity-100 [@media(hover:hover)]:grid ${d === "next" ? "right-2" : "left-2"}`}>
            {d === "next" ? <ChevronRight className="size-4" aria-hidden /> : <ChevronLeft className="size-4" aria-hidden />}
          </button>
        );
      })}
      {photos.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-center gap-1" aria-hidden>
          {photos.map((im, n) => {
            const size = n === i ? 0 : Math.max(3, 7 - Math.abs(n - i) - (n > i ? 1 : 0));
            return <span key={im.url} style={n === i ? { width: 14, height: 6 } : { width: size, height: size }} className={`rounded-full transition-all duration-200 ${n === i ? "bg-card" : "bg-card/55"}`} />;
          })}
        </div>
      )}
    </>
  );
}

/** One listing in a grid. The whole card is a link; the save button sits above it. */
export function PropertyCard({ p, saved, priority = false }: { p: Card; saved?: boolean | undefined; priority?: boolean }) {
  const navigate = useNavigate();
  return (
    <article onPointerEnter={() => setHoverPin(p.id)} onPointerLeave={() => setHoverPin(null)} onFocusCapture={() => setHoverPin(p.id)} onBlurCapture={() => setHoverPin(null)} className="surface group relative flex min-w-0 flex-col overflow-hidden rounded-2xl">
      <div onClick={() => navigate({ to: "/property/$slug", params: { slug: p.slug } })} className="card-ph group/ph relative z-[1] aspect-[4/3] cursor-pointer bg-skeleton">
        <CardPhotos p={p} priority={priority} />
        <div className="ph-tags absolute left-2 top-2 flex flex-wrap gap-1 sm:left-3 sm:top-3 sm:gap-1.5">
          <span className={`ph-pill rounded-full px-2 py-0.5 text-[0.7rem] font-medium shadow-sm sm:px-2.5 sm:py-1 sm:text-xs ${PILL[p.tier]}`}>{listingTypeLabel(p.listingType)}</span>
          {p.priceDrop && <span className="ph-pill inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white"><TrendingDown className="h-3 w-3" aria-hidden />Price drop</span>}
        </div>
        <div className="ph-actions absolute right-2 top-2 flex items-center gap-0.5 sm:right-3 sm:top-3 sm:gap-1"><CompareButton propertyId={p.id} /><SaveButton propertyId={p.id} saved={saved} /></div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:gap-1.5 sm:p-3.5">
        {(() => { const [amt, per] = formatPrice(p.price).split(" / "); return (
          <p className="text-[0.8rem] font-bold leading-tight sm:text-base lg:text-[0.9rem] lg:font-semibold">{amt}{per && <span className="ml-0.5 text-[0.62rem] font-medium text-muted-foreground sm:text-xs lg:text-[0.7rem] lg:font-normal"> / {per}</span>}</p>
        ); })()}
        <h3 className="line-clamp-2 text-[0.8125rem] font-normal leading-snug text-muted-foreground sm:text-sm lg:text-[0.8rem]">
          <Link to="/property/$slug" params={{ slug: p.slug }} className="after:absolute after:inset-0 after:content-['']">{describeListing(p)}</Link>
        </h3>
      </div>
    </article>
  );
}

export function PropertyGrid({ items, saved, empty }: { items: Card[]; saved?: ReadonlySet<string> | undefined; empty?: React.ReactNode }) {
  const layout = useCardLayout();
  if (!items.length) return <>{empty}</>;
  return (
    <div className="card-cq">
      <div data-layout={layout} className="card-grid gap-x-3 gap-y-4 sm:gap-5">
        {items.map((p, i) => <PropertyCard key={p.id} p={p} saved={saved?.has(p.id)} priority={i < 3} />)}
      </div>
    </div>
  );
}

/** Grey placeholder cards shown while listings are being fetched; same grid and same chosen layout as PropertyGrid. */
export function PropertyGridSkeleton({ count = 6 }: { count?: number }) {
  const layout = useCardLayout();
  return (
    <div className="card-cq">
      <div aria-label="Loading properties" aria-busy data-layout={layout} className="card-grid mt-4 gap-x-3 gap-y-4 sm:gap-5">
        {Array.from({ length: count }, (_, i) => (
          <article key={i} className="card-skeleton flex min-w-0 flex-col gap-3">
            <div className="skeleton aspect-[4/3] !rounded-2xl" />
            <div className="space-y-2 py-1"><span className="skeleton block h-4 w-1/3" /><span className="skeleton block h-3.5 w-4/5" /><span className="skeleton block h-3 w-1/2" /></div>
          </article>
        ))}
      </div>
    </div>
  );
}
