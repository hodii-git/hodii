import { ChevronLeft, ChevronRight, Camera, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageDto } from "@/lib/property-dto";

/** Large photo with thumbnails; opens full screen. Arrow keys and swipe-friendly buttons; Escape closes. */
export function Gallery({ images: photos, plans = [], title }: { images: ImageDto[]; plans?: ImageDto[]; title: string }) {
  // Floor plans are part of the same gallery, after the photos, marked so people know what they are looking at.
  const images = [...photos, ...plans];
  const isPlan = (k: number) => k >= photos.length;
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const n = images.length;
  const go = useCallback((d: number) => setI((v) => (v + d + n) % n), [n]);

  useEffect(() => {
    if (!full) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); };
    window.addEventListener("keydown", key);
    closeRef.current?.focus();
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [full, go]);

  if (!n) return <div className="flex aspect-[16/10] items-center justify-center rounded-3xl bg-muted text-muted-foreground"><Camera className="h-10 w-10" aria-hidden /></div>;
  const cur = images[i]!;
  return (
    <section aria-label="Photos">
      <div className="relative overflow-hidden rounded-3xl bg-muted">
        <button type="button" onClick={() => setFull(true)} className="block w-full cursor-zoom-in" aria-label="View photo full screen">
          <img src={cur.url} alt={cur.alt || (isPlan(i) ? `${title}, floor plan` : `${title}, photo ${i + 1}`)} width={cur.width || 1200} height={cur.height || 800} className={`aspect-[16/10] w-full ${isPlan(i) ? "bg-white object-contain" : "object-cover"}`} fetchPriority={i === 0 ? "high" : "auto"} />
        </button>
        {n > 1 && (<>
          <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow"><ChevronRight className="h-5 w-5" /></button>
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
      {full && (
        <div role="dialog" aria-modal="true" aria-label={`${title} photos`} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95">
          <button ref={closeRef} type="button" onClick={() => setFull(false)} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white"><X className="h-5 w-5" /></button>
          {n > 1 && <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-4 rounded-full bg-white/10 p-3 text-white"><ChevronLeft className="h-6 w-6" /></button>}
          <img src={cur.url} alt={cur.alt || title} className="max-h-[92vh] max-w-[92vw] object-contain" />
          {n > 1 && <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-4 rounded-full bg-white/10 p-3 text-white"><ChevronRight className="h-6 w-6" /></button>}
        </div>
      )}
    </section>
  );
}
