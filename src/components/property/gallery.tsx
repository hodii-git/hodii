import { ChevronLeft, ChevronRight, Camera, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageDto } from "@/lib/property-dto";

/** Large photo with thumbnails; opens full screen. Arrow keys and swipe-friendly buttons; Escape closes. */
export function Gallery({
  images: photos,
  plans = [],
  title,
  actions,
  mobileHero = false,
  activeIndex,
  onIndexChange,
}: {
  images: ImageDto[];
  plans?: ImageDto[];
  title: string;
  /** Small round buttons (save, compare, share) that sit on the photo, like on the cards. */
  actions?: React.ReactNode;
  /** Full-bleed rounded dark hero card on small screens (< 768px) with top-left actions, top-right 1/N pill, and bottom-right expand button. */
  mobileHero?: boolean;
  activeIndex?: number;
  onIndexChange?: (index: number) => void;
}) {
  // Floor plans are part of the same gallery, after the photos, marked so people know what they are looking at.
  const images = [...photos, ...plans];
  const isPlan = (k: number) => k >= photos.length;
  const [localI, setLocalI] = useState(0);
  const i = activeIndex !== undefined ? Math.min(Math.max(activeIndex, 0), Math.max(images.length - 1, 0)) : localI;
  const setI = useCallback((v: number | ((prev: number) => number)) => {
    setLocalI((prev) => {
      const base = activeIndex !== undefined ? activeIndex : prev;
      const next = typeof v === "function" ? v(base) : v;
      onIndexChange?.(next);
      return next;
    });
  }, [activeIndex, onIndexChange]);
  const [full, setFull] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const n = images.length;
  const go = useCallback((d: number) => setI((v) => (v + d + n) % n), [n]);
  const touchX = useRef<number | null>(null);
  const swipe = { onTouchStart: (e: React.TouchEvent) => { touchX.current = e.touches[0]?.clientX ?? null; }, onTouchEnd: (e: React.TouchEvent) => { const x0 = touchX.current; touchX.current = null; const x1 = e.changedTouches[0]?.clientX; if (x0 == null || x1 == null || Math.abs(x1 - x0) < 40) return; go(x1 < x0 ? 1 : -1); } };

  const strip = useRef<HTMLDivElement>(null);
  /** Moves the full-screen strip to a photo; the strip itself scrolls with a finger, wheel, trackpad or the arrows. */
  const slideTo = useCallback((k: number, smooth = true) => { const el = strip.current; if (el) el.scrollTo({ left: k * el.clientWidth, behavior: smooth ? "smooth" : "auto" }); }, []);
  const slide = (d: number) => slideTo((i + d + n) % n);
  const onStripScroll = () => { const el = strip.current; if (!el || !el.clientWidth) return; const k = Math.round(el.scrollLeft / el.clientWidth); if (k !== i && k >= 0 && k < n) setI(k); };
  useEffect(() => { if (full) slideTo(i, false); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);
  // Mobile hero: the photos sit in a horizontal scroll-snap strip, so a finger scrolls them right on the page without opening the viewer.
  const hero = useRef<HTMLDivElement>(null);
  const heroBusy = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHeroScroll = () => {
    const el = hero.current;
    if (!el || !el.clientWidth || heroBusy.current) return;
    const k = Math.round(el.scrollLeft / el.clientWidth);
    if (k !== i && k >= 0 && k < n) setI(k);
  };
  // When the photo changes from outside (a thumbnail tap), glide the strip to it and ignore the scroll events that glide causes.
  useEffect(() => {
    const el = hero.current;
    if (!el || !el.clientWidth) return;
    if (Math.round(el.scrollLeft / el.clientWidth) === i) return;
    if (heroBusy.current) clearTimeout(heroBusy.current);
    heroBusy.current = setTimeout(() => { heroBusy.current = null; }, 600);
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, [i]);
  useEffect(() => () => { if (heroBusy.current) clearTimeout(heroBusy.current); }, []);
  // The phone's back button (or swipe-back) closes the viewer instead of leaving the listing: opening it adds a history step, back removes it.
  const closeFull = useCallback(() => {
    if (typeof window !== "undefined" && (window.history.state as { hodiiGallery?: boolean } | null)?.hodiiGallery) window.history.back();
    else setFull(false);
  }, []);
  useEffect(() => {
    if (!full) return;
    window.history.pushState({ ...(window.history.state ?? {}), hodiiGallery: true }, "");
    const onPop = () => setFull(false);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed some other way (a cleanup while the step is still ours): drop the extra step so Back still works normally.
      if ((window.history.state as { hodiiGallery?: boolean } | null)?.hodiiGallery) window.history.back();
    };
  }, [full]);
  useEffect(() => {
    if (!full) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") closeFull(); if (e.key === "ArrowLeft") slide(-1); if (e.key === "ArrowRight") slide(1); };
    window.addEventListener("keydown", key);
    closeRef.current?.focus();
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, go, i, closeFull]);

  if (!n) return <div className="flex aspect-[16/10] items-center justify-center rounded-3xl bg-muted text-muted-foreground"><Camera className="h-10 w-10" aria-hidden /></div>;
  const cur = images[i]!;
  const open = (k: number) => { setI(k); setFull(true); };
  const tiles = images.slice(0, 5);
  return (
    <section aria-label="Photos">
      {/* Wide screens: one large photo and up to four more, like a magazine spread. Tapping any opens the full-screen viewer. */}
      <div className={`relative hidden h-[26rem] gap-2 overflow-hidden rounded-3xl ${mobileHero ? "lg:grid" : "sm:grid"} lg:h-[30rem] ${tiles.length === 1 ? "" : tiles.length < 3 ? "grid-cols-2" : "grid-cols-4 grid-rows-2"}`}>
        {tiles.map((im, k) => (
          <button key={im.url} type="button" onClick={() => open(k)} aria-label={k >= photos.length ? "View floor plan full screen" : `View photo ${k + 1} full screen`}
            className={`group relative overflow-hidden bg-muted ${k === 0 ? (tiles.length >= 3 ? "col-span-2 row-span-2" : "") : ""}`}>
            <img src={k === 0 ? im.url : im.thumbUrl ?? im.url} alt={im.alt || (k >= photos.length ? `${title}, floor plan` : `${title}, photo ${k + 1}`)} width={im.width || 1200} height={im.height || 800} loading={k === 0 ? "eager" : "lazy"}
              className={`h-full w-full transition duration-500 group-hover:scale-[1.03] ${k >= photos.length ? "bg-white object-contain" : "object-cover"}`} />
            {k >= photos.length && <span className="absolute left-3 top-3 rounded-full bg-background/95 px-3 py-1 text-xs font-bold shadow">Floor plan</span>}
          </button>
        ))}
        {actions && <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">{actions}</div>}
        {n > 1 && <button type="button" onClick={() => open(0)} className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm font-bold shadow-lg"><Camera className="size-4" aria-hidden />Show all {n}</button>}
      </div>
      {mobileHero ? (
        <div className="lg:hidden">
          <div className="hero-strip group/hero relative overflow-hidden rounded-t-[1.6rem] bg-black md:rounded-t-[2rem]">
            {actions && <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">{actions}</div>}
            <span className="pointer-events-none absolute right-3 top-3 z-10 ld-font rounded-full bg-black/75 px-4 py-1 text-[12px] font-medium tabular-nums text-[#f3ead7] backdrop-blur-md">{i + 1} / {n}</span>
            <div ref={hero} onScroll={onHeroScroll} className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {images.map((im, k) => (
                <button key={im.url} type="button" onClick={() => setFull(true)} className={`block w-full shrink-0 snap-center snap-always cursor-zoom-in ${isPlan(k) ? "bg-white" : "bg-[#141416]"}`} aria-label={`View photo ${k + 1} full screen`}>
                  <img src={im.url} alt={im.alt || (isPlan(k) ? `${title}, floor plan` : `${title}, photo ${k + 1}`)} width={im.width || 1200} height={im.height || 800} draggable={false} loading={Math.abs(k - i) <= 1 ? "eager" : "lazy"} className={`h-[52svh] min-h-[360px] max-h-[500px] w-full select-none ${isPlan(k) ? "bg-white object-contain" : "object-cover"}`} fetchPriority={k === 0 ? "high" : "auto"} />
                </button>
              ))}
            </div>
            {isPlan(i) && <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[34%]" style={{ background: "linear-gradient(to top, rgb(255 255 255 / 0) 0%, rgb(255 255 255 / 0.25) 28%, rgb(255 255 255 / 0.7) 62%, rgb(255 255 255 / 0.95) 88%, #fff 100%)" }} aria-hidden />}
            {/* The photo melts into the page: black is complete at the bottom edge, which lines up with the end of the title's second line below. */}
            <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] ${isPlan(i) ? "h-[22%]" : "h-[58%]"}`} style={{ background: "linear-gradient(to bottom, rgb(0 0 0 / 0) 0%, rgb(0 0 0 / 0.18) 28%, rgb(0 0 0 / 0.62) 62%, rgb(0 0 0 / 0.92) 88%, #000 100%)" }} aria-hidden />
            {isPlan(i) && <span className="absolute bottom-[3.6rem] left-3 z-10 rounded-full bg-black/75 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">Floor plan</span>}
            {!isPlan(i) && cur.caption && <p className="absolute bottom-[3.6rem] left-3 z-10 max-w-[70%] truncate rounded-full bg-black/70 px-3 py-1 text-xs text-white backdrop-blur-sm">{cur.caption}</p>}
            {n > 1 && <>
              <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-4 top-[40%] z-10 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-[#121214]/85 text-white backdrop-blur-sm opacity-0 transition hover:bg-[#26262a] focus-visible:opacity-100 group-hover/hero:opacity-100 active:scale-95 md:grid"><ChevronLeft className="size-6" aria-hidden /></button>
              <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-4 top-[40%] z-10 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-[#121214]/85 text-white backdrop-blur-sm opacity-0 transition hover:bg-[#26262a] focus-visible:opacity-100 group-hover/hero:opacity-100 active:scale-95 md:grid"><ChevronRight className="size-6" aria-hidden /></button>
            </>}
            <button type="button" onClick={() => setFull(true)} aria-label="Open full screen gallery" className="absolute bottom-[3.6rem] right-3 z-10 grid size-11 place-items-center rounded-full bg-[#121214]/85 text-white backdrop-blur-sm transition active:scale-95">
              <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="sm:hidden">
          <div {...swipe} className="relative overflow-hidden rounded-3xl bg-muted">
            {actions && <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5">{actions}</div>}
            <button type="button" onClick={() => setFull(true)} className="block w-full cursor-zoom-in" aria-label="View photo full screen">
              <img src={cur.url} alt={cur.alt || (isPlan(i) ? `${title}, floor plan` : `${title}, photo ${i + 1}`)} width={cur.width || 1200} height={cur.height || 800} className={`aspect-[4/3] w-full ${isPlan(i) ? "bg-white object-contain" : "object-cover"}`} fetchPriority={i === 0 ? "high" : "auto"} />
            </button>
            {n > 1 && (<>
              <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full glass-chevron p-2 sm:block"><ChevronLeft className="h-5 w-5" /></button>
              <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full glass-chevron p-2 sm:block"><ChevronRight className="h-5 w-5" /></button>
              {isPlan(i) && <span className="absolute left-3 top-3 rounded-full bg-background/95 px-3 py-1 text-xs font-bold shadow">Floor plan</span>}
              <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">{i + 1} / {n}</span>
            </>)}
            {cur.caption && <p className="absolute bottom-3 left-3 max-w-[70%] rounded-full bg-black/60 px-3 py-1 text-xs text-white">{cur.caption}</p>}
          </div>
          {n > 1 && (
            <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Photo thumbnails">
              {images.map((im, k) => (
                <li key={im.url} className="shrink-0">
                  <button type="button" onClick={() => setI(k)} aria-label={isPlan(k) ? `Show floor plan ${k - photos.length + 1}` : `Show photo ${k + 1}`} aria-current={k === i} className={`block overflow-hidden rounded-xl border-2 ${k === i ? "border-primary" : "border-transparent opacity-80"}`}>
                    <img src={im.thumbUrl ?? im.url} alt="" width={96} height={72} loading="lazy" className={`h-[4.5rem] w-24 ${isPlan(k) ? "bg-white object-contain" : "object-cover"}`} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {full && (
        <div role="dialog" aria-modal="true" aria-label={`${title} photos`} className="fixed inset-0 z-[100] bg-black/95">
          <div ref={strip} onScroll={onStripScroll} className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {images.map((im, k) => (
              <div key={im.url} className="grid h-full w-full shrink-0 snap-center place-items-center px-2 sm:px-16">
                <img src={im.url} alt={im.alt || (isPlan(k) ? `${title}, floor plan` : `${title}, photo ${k + 1}`)} loading={Math.abs(k - i) <= 1 ? "eager" : "lazy"} draggable={false} className="max-h-[88vh] max-w-full select-none object-contain" />
              </div>
            ))}
          </div>
          <button ref={closeRef} type="button" onClick={closeFull} aria-label="Close" className="absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-black/60 text-white ring-1 ring-white/30 sm:right-4 sm:top-4"><X className="h-5 w-5" /></button>
          {n > 1 && <>
            <button type="button" onClick={() => slide(-1)} aria-label="Previous photo" className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full glass-chevron sm:left-4"><ChevronLeft className="h-6 w-6" /></button>
            <button type="button" onClick={() => slide(1)} aria-label="Next photo" className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full glass-chevron sm:right-4"><ChevronRight className="h-6 w-6" /></button>
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white">{i + 1} / {n}</span>
          </>}
        </div>
      )}
    </section>
  );
}
