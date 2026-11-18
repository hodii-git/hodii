import { Star } from "lucide-react";

/** Read-only stars. The number is always given in text too, so the rating never depends on colour alone. */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} width={size} height={size} aria-hidden className={value >= i - 0.25 ? "fill-amber-400 text-amber-400" : value >= i - 0.75 ? "fill-amber-400/50 text-amber-400" : "text-muted-foreground/40"} />)}
    </span>
  );
}

export function StarPicker({ value, onChange, id }: { value: number; onChange: (n: number) => void; id: string }) {
  return (
    <div role="radiogroup" aria-labelledby={id} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} ${i === 1 ? "star" : "stars"}`} onClick={() => onChange(i)} className="rounded p-1 focus-visible:outline focus-visible:outline-2">
          <Star width={28} height={28} aria-hidden className={value >= i ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50"} />
        </button>
      ))}
    </div>
  );
}
