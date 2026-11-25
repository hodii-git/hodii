import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { FloatingPanel } from "./floating-panel";

export type MultiOption = { value: string; label: string; group?: string };

/** A dropdown button for choosing several things (property types, must-have features). Same look and behaviour as Pick; the list stays open while you tick. */
export function MultiPick({ values, onChange, options, label, allLabel, max, className = "" }: { values: readonly string[]; onChange: (v: string[]) => void; options: MultiOption[]; label: string; allLabel?: string; max?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const uid = useId();
  // Only one filter list open at a time: opening this one closes any other.
  useEffect(() => { const h = (e: Event) => { if ((e as CustomEvent<string>).detail !== uid) setOpen(false); }; window.addEventListener("pick-open", h); return () => window.removeEventListener("pick-open", h); }, [uid]);
  useEffect(() => { if (open) window.dispatchEvent(new CustomEvent("pick-open", { detail: uid })); }, [open, uid]);
  const query = q.trim().toLowerCase();
  const shown = useMemo(() => options.filter((o) => !query || o.label.toLowerCase().includes(query)), [options, query]);
  const groups = useMemo(() => { const m = new Map<string, MultiOption[]>(); for (const o of shown) { const g = o.group ?? ""; m.set(g, [...(m.get(g) ?? []), o]); } return [...m]; }, [shown]);
  const chosen = options.filter((o) => values.includes(o.value));
  const text = chosen.length === 0 ? (allLabel ?? label) : chosen.length <= 2 ? chosen.map((c) => c.label).join(", ") : `${chosen.length} selected`;
  const toggle = (v: string) => {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else if (max === undefined || values.length < max) onChange([...values, v]);
  };
  const row = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-hidden";
  return (
    <div ref={root} className="relative min-w-0">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${uid}-list`} aria-label={`${label}: ${chosen.length ? chosen.map((c) => c.label).join(", ") : allLabel ?? "none chosen"}`}
        onClick={() => setOpen((o) => !o)} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        className={`flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-background px-2.5 text-left text-[0.8125rem] outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${className}`}>
        <span className={`truncate ${chosen.length ? "" : "text-muted-foreground"}`}>{text}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <FloatingPanel anchor={root} open={open} onClose={() => setOpen(false)}>
        <>
          {options.length > 10 && (
            <div className="relative p-1.5">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${label}`} placeholder="Type to find…" className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          )}
          <ul id={`${uid}-list`} role="listbox" aria-multiselectable aria-label={label} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {groups.map(([g, list]) => (
              <li key={g || "all"} role="presentation">
                {g && <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase text-muted-foreground">{g}</p>}
                <ul role="presentation">
                  {list.map((o) => {
                    const on = values.includes(o.value);
                    return (
                      <li key={o.value} role="presentation">
                        <button type="button" role="option" aria-selected={on} onClick={() => toggle(o.value)} className={row}>
                          <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>{on && <Check className="h-3 w-3" aria-hidden />}</span>
                          <span className={on ? "font-semibold" : ""}>{o.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
            {!shown.length && <li className="px-3 py-2 text-sm text-muted-foreground">Nothing matches “{q}”.</li>}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-border px-2 pt-1.5">
            <button type="button" disabled={!values.length} onClick={() => onChange([])} className="rounded-lg px-2 py-1.5 text-sm font-semibold underline disabled:no-underline disabled:opacity-40">Clear</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground">Done</button>
          </div>
        </>
      </FloatingPanel>
    </div>
  );
}
