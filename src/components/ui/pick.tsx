import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { FloatingPanel } from "./floating-panel";

/**
 * A dropdown made of buttons, used for every filter. The list opens on the page under the button (not in the operating system's
 * pop-up), can nest (a group opens its own list inside), can be searched when long, and works with keyboard and screen readers.
 * A group without its own `value` only holds its children (e.g. a region holding counties).
 */
export type PickOption = { value?: string; label: string; hint?: string; children?: PickOption[] };

const flat = (opts: PickOption[]): PickOption[] => opts.flatMap((o) => [o, ...(o.children ? flat(o.children) : [])]);
const matches = (o: PickOption, q: string): boolean => o.label.toLowerCase().includes(q) || (o.children?.some((c) => matches(c, q)) ?? false);

type Props = {
  value: string; onChange: (value: string) => void; options: PickOption[];
  /** Name read by screen readers, also shown on the button when nothing is chosen. */
  label: string; /** First entry that clears the choice, e.g. "All counties". Omit when a choice is required. */ clearLabel?: string;
  searchable?: boolean | undefined; className?: string; id?: string; disabled?: boolean;
  /** A first button above the list, such as "Use my location". */ leading?: { label: string; onClick: () => void; icon?: React.ReactNode };
  /** Extra classes for the open list. */ panelClassName?: string;
  /** Lets people type their own number; the label shows how a typed value reads. */ custom?: { placeholder: string; label: (v: string) => string };
};

export function Pick({ value, onChange, options, label, clearLabel, searchable, className = "", id, disabled, panelClassName = "", custom, leading, pillText }: Props & { pillText?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const root = useRef<HTMLDivElement>(null);
  const uid = useId();
  // Only one filter list open at a time: opening this one closes any other.
  useEffect(() => { const h = (e: Event) => { if ((e as CustomEvent<string>).detail !== uid) setOpen(false); }; window.addEventListener("pick-open", h); return () => window.removeEventListener("pick-open", h); }, [uid]);
  useEffect(() => { if (open) window.dispatchEvent(new CustomEvent("pick-open", { detail: uid })); }, [open, uid]);
  const all = useMemo(() => flat(options), [options]);
  const chosen = all.find((o) => o.value === value && value !== "") ?? (custom && value ? { value, label: custom.label(value) } : undefined);
  const [typed, setTyped] = useState("");
  const showSearch = searchable ?? all.length > 14;
  const query = q.trim().toLowerCase();

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); root.current?.querySelector("button")?.focus(); } };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); };
  }, [open]);

  // Show the group that holds the current choice when opening.
  useEffect(() => {
    if (!open) { setQ(""); return; }
    const holder = options.filter((o) => o.children && flat(o.children).some((c) => c.value === value && value !== "")).map((o) => o.label);
    setOpenGroups(new Set(holder));
  }, [open, options, value]);

  const pick = (v: string) => { onChange(v); setOpen(false); root.current?.querySelector("button")?.focus(); };
  const row = "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-hidden";

  const render = (o: PickOption, depth: number): React.ReactNode => {
    if (query && !matches(o, query)) return null;
    const indent = { paddingLeft: `${0.75 + depth * 1}rem` };
    if (o.children) {
      const expanded = !!query || openGroups.has(o.label);
      return (
        <li key={o.label}>
          <button type="button" aria-expanded={expanded} onClick={() => setOpenGroups((s) => { const n = new Set(s); if (n.has(o.label)) n.delete(o.label); else n.add(o.label); return n; })} className={`${row} font-semibold`} style={indent}>
            <span className="min-w-0 flex-1 break-words">{o.label}</span><ChevronDown className={`h-4 w-4 shrink-0 transition ${expanded ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {expanded && (
            <ul className="mt-0.5">
              {o.value !== undefined && !query && <li><button type="button" role="option" aria-selected={value === o.value} onClick={() => pick(o.value!)} className={row} style={{ paddingLeft: `${0.75 + (depth + 1) * 1}rem` }}><span>All {o.label.toLowerCase()}</span>{value === o.value && <Check className="h-4 w-4" aria-hidden />}</button></li>}
              {o.children.map((c) => render(c, depth + 1))}
            </ul>
          )}
        </li>
      );
    }
    return (
      <li key={o.value ?? o.label}>
        <button type="button" role="option" aria-selected={value === o.value} onClick={() => pick(o.value ?? "")} className={`${row} ${value === o.value ? "font-bold text-primary" : ""}`} style={indent}>
          <span className="min-w-0 flex-1 break-words">{o.label}{o.hint && <span className="ml-2 text-xs text-muted-foreground">{o.hint}</span>}</span>{value === o.value && <Check className="h-4 w-4 shrink-0" aria-hidden />}
        </button>
      </li>
    );
  };

  const shown = options.map((o) => render(o, 0)).filter(Boolean);
  return (
    <div ref={root} className="relative min-w-0">
      <button type="button" id={id} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${uid}-list`} aria-label={`${label}: ${chosen?.label ?? clearLabel ?? "none chosen"}`} onClick={() => setOpen((o) => !o)}
        className={`flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-background px-2.5 text-left text-[0.8125rem] outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${className}`}>
        <span className={`truncate ${chosen ? "" : "text-muted-foreground"}`}>{pillText ?? chosen?.label ?? clearLabel ?? label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <FloatingPanel anchor={root} open={open} onClose={() => setOpen(false)} className={panelClassName}>
        <>
          {leading && (
            <div className="p-1.5 pb-0"><button type="button" onClick={() => { setOpen(false); leading.onClick(); }} className="flex h-10 w-full items-center gap-2 rounded-xl bg-primary/10 px-3 text-sm font-bold text-primary hover:bg-primary/15">{leading.icon}{leading.label}</button></div>
          )}
          {custom && (
            <form className="flex gap-1.5 p-1.5" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); const n = typed.replace(/[^0-9]/g, ""); if (n) { pick(n); setTyped(""); } }}>
              <input autoFocus inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value.replace(/[^0-9,]/g, ""))} aria-label={custom.placeholder} placeholder={custom.placeholder} className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background/70 px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring" />
              <button type="submit" className="cta h-10 shrink-0 rounded-xl px-3 text-sm font-semibold">Set</button>
            </form>
          )}
          {showSearch && (
            <div className="relative p-1.5">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${label}`} placeholder="Type to find…" className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          )}
          <ul id={`${uid}-list`} role="listbox" aria-label={label} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
            {clearLabel && !query && <li><button type="button" role="option" aria-selected={value === ""} onClick={() => pick("")} className={`${row} ${value === "" ? "font-bold text-primary" : ""}`}><span className="min-w-0 flex-1 break-words">{clearLabel}</span>{value === "" && <Check className="h-4 w-4" aria-hidden />}</button></li>}
            {shown.length ? shown : <li className="px-3 py-2 text-sm text-muted-foreground">Nothing matches “{q}”.</li>}
          </ul>
        </>
      </FloatingPanel>
    </div>
  );
}
