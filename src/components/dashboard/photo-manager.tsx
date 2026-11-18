import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadPhoto, type Uploaded } from "./upload";
import { LISTING_LIMITS } from "@/lib/mongodb/limits";

/** A photo that is not in our own storage, e.g. a link carried over from an import. It can stay, move or be removed; new photos are uploads only. */
const isLinked = (url: string) => !(url.includes("res.cloudinary.com/") && /\/hodii\/(listings|logos)\//.test(url));

/** Upload, reorder and describe photos. The first photo is the cover shown on cards. */
export function PhotoManager({ slug, images, onChange, max = LISTING_LIMITS.imagesMax }: { slug: string; images: Uploaded[]; onChange: (next: Uploaded[]) => void; max?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const latest = useRef(images);
  latest.current = images;

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = max - latest.current.length;
    const picked = [...files].slice(0, Math.max(0, room));
    if (files.length > picked.length) toast.error(`You can add up to ${max} photos`);
    setBusy((n) => n + picked.length);
    // Uploads run a few at a time; each finished photo is appended to the newest list so none are lost.
    let next = 0;
    const worker = async () => {
      while (next < picked.length) {
        const f = picked[next++]!;
        try { const up = await uploadPhoto(slug, "listing", f); latest.current = [...latest.current, up]; onChange(latest.current); }
        catch (e) { toast.error(e instanceof Error ? e.message : `Could not upload ${f.name}`); }
        finally { setBusy((n) => n - 1); }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (input.current) input.current.value = "";
  };
  const move = (i: number, d: number) => { const n = [...images]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j]!, n[i]!]; onChange(n); };
  const patch = (i: number, p: Partial<Uploaded>) => onChange(images.map((im, k) => (k === i ? { ...im, ...p } : im)));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => input.current?.click()} disabled={images.length >= max} className="inline-flex h-11 items-center gap-2 rounded-xl border border-dashed border-primary px-5 text-sm font-bold text-primary disabled:opacity-50"><ImagePlus className="h-4 w-4" aria-hidden />Add photos</button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => add(e.target.files)} aria-label="Choose photos" />
        <p className="text-sm text-muted-foreground" aria-live="polite">{busy > 0 ? `Uploading ${busy}…` : `${images.length} of ${max} photos. At least ${LISTING_LIMITS.imagesMin} is needed to publish; the first is the cover.`}</p>
      </div>
      {images.some((i) => isLinked(i.url)) && <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">Photos marked <strong>Linked</strong> come from another website. You can keep, reorder or remove them, and replace them with photos you upload. New photos can only be added by uploading.</p>}
      {images.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((im, i) => (
            <li key={im.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="relative aspect-[4/3] bg-muted">
                <img src={im.thumbUrl ?? im.url} alt={im.alt || `Photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                {isLinked(im.url) && <span className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-bold">Linked</span>}
                {i === 0 && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground"><Star className="h-3 w-3" aria-hidden />Cover</span>}
              </div>
              <div className="space-y-2 p-2">
                <label className="sr-only" htmlFor={`alt-${im.id}`}>Describe photo {i + 1}</label>
                <input id={`alt-${im.id}`} value={im.alt} maxLength={LISTING_LIMITS.imageAltMax} onChange={(e) => patch(i, { alt: e.target.value })} placeholder="Describe it, e.g. Living room" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" />
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`} className="rounded-lg border border-input p-1.5 disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label={`Move photo ${i + 1} later`} className="rounded-lg border border-input p-1.5 disabled:opacity-30"><ArrowRight className="h-3.5 w-3.5" /></button>
                    {i > 0 && <button type="button" onClick={() => { const n = [...images]; const [x] = n.splice(i, 1); onChange([x!, ...n]); }} className="rounded-lg border border-input px-2 text-xs font-semibold">Make cover</button>}
                  </div>
                  <button type="button" onClick={() => onChange(images.filter((_, k) => k !== i))} aria-label={`Remove photo ${i + 1}`} className="rounded-lg p-1.5 text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
