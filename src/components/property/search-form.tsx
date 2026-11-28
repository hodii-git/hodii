import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Search, X } from "lucide-react";
import { FiltersIcon } from "@/components/ui/filters-icon";
import { COUNTY_LIST } from "@/lib/mongodb/kenya";
import { locateMe } from "@/components/property/use-my-location";
import { CONDITIONS, FEATURES, FURNISHINGS, LISTING_TYPES, PROPERTY_CATEGORIES, PROPERTY_TYPES, featuresFor } from "@/lib/mongodb/taxonomy";
import { Pick } from "@/components/ui/pick";
import { MultiPick } from "@/components/ui/multi-pick";
import { CATEGORY_TYPE_OPTIONS, COUNTY_OPTIONS, toOptions } from "@/lib/pick-options";
import type { SearchParams } from "@/lib/listing-search";
import { understand } from "@/lib/query-intent";
import { VoiceButton } from "./voice-button";
import { pickCriteria, replaceCriteria, useAiSearch, type AiResult } from "./ai-search-panel";
import { PlaceSuggest, placeWords } from "./place-suggest";
import { CLEAR_ALL, hasFilters } from "@/lib/criteria-chips";
import { Sparkles } from "lucide-react";
import { Loader } from "@/components/loader";
import { SearchSheet } from "@/components/search-sheet";
import { setSheet } from "@/lib/search-sheet";

type Props = { value: SearchParams; onChange: (next: Partial<SearchParams>) => void; /** From large screens the form becomes a sticky sidebar with every filter always open. */ side?: boolean };

const field = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-[0.8125rem] outline-hidden focus-visible:ring-2 focus-visible:ring-ring";
const label = "mb-1.5 block text-xs font-bold uppercase text-muted-foreground";
const num = (s: string) => { const n = Number(s.replace(/[, ]/g, "")); return s.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined; };

/** Price steps differ a lot between renting and buying, so the quick picks follow the listing type. */
const BEDS = [{ value: "1", label: "1+ bedroom" }, { value: "2", label: "2+ bedrooms" }, { value: "3", label: "3+ bedrooms" }, { value: "4", label: "4+ bedrooms" }, { value: "5", label: "5+ bedrooms" }];
const BATHS = [{ value: "1", label: "1+ bathroom" }, { value: "2", label: "2+ bathrooms" }, { value: "3", label: "3+ bathrooms" }, { value: "4", label: "4+ bathrooms" }];
const RENT_STEPS = [10_000, 20_000, 30_000, 50_000, 80_000, 120_000, 200_000, 400_000];
const SALE_STEPS = [2_000_000, 5_000_000, 8_000_000, 12_000_000, 20_000_000, 40_000_000, 80_000_000, 200_000_000];

/** On the results page the card becomes the phone search sheet; elsewhere it is the plain card. */
export function SearchForm(props: Props & { result?: AiResult }) {
  return props.side ? <SearchSheet><SearchFormInner {...props} /></SearchSheet> : <SearchFormInner {...props} />;
}
function SearchFormInner({ value, onChange, side = false, result }: Props & { result?: AiResult }) {
  const [q, setQ] = useState(value.q ?? "");
  const [open, setOpen] = useState(false);
  const [understood, setUnderstood] = useState<string[]>([]);
  const ai = useAiSearch({ value, result, onApply: (n) => { setUnderstood([]); fromText.current = []; onChange(n); } });
  // What the person typed stays as typed. The box only follows the page when something else changed the keyword (a reset, a saved search).
  const latest = useRef(value); latest.current = value;
  const applied = useRef(value.q ?? "");
  const fromText = useRef<string[]>([]);
  const chatOpen = useRef(false); chatOpen.current = ai.open;
  useEffect(() => { if (!chatOpen.current && (value.q ?? "") !== applied.current) { applied.current = value.q ?? ""; setQ(value.q ?? ""); } }, [value.q]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** Applies a change shortly after the last keystroke, so typing never needs a button press. */
  const later = (key: string, fn: () => void, ms = 800) => { clearTimeout(timers.current.get(key)); timers.current.set(key, setTimeout(fn, ms)); };
  useEffect(() => { const m = timers.current; return () => { for (const x of m.values()) clearTimeout(x); }; }, []);
  const steps = value.listingType === "sale" ? SALE_STEPS : RENT_STEPS;
  const priceOptions = useMemo(() => steps.map((n) => ({ value: String(n), label: `KES ${n.toLocaleString("en-KE")}` })), [steps]);
  const types = useMemo(() => PROPERTY_TYPES.filter((t) => !value.category || t.category === value.category), [value.category]);
  const features = useMemo(() => (value.category ? featuresFor(value.category) : FEATURES.filter((f) => f.for.includes("residential"))), [value.category]);
  const typeOptions = useMemo(() => types.map((t) => ({ value: t.key, label: t.label, group: PROPERTY_CATEGORIES.find((c) => c.key === t.category)?.label ?? "" })), [types]);
  const featureOptions = useMemo(() => features.map((f) => ({ value: f.key, label: f.label })), [features]);
  const toggle = <T extends string>(list: readonly T[] | undefined, v: T) => { const l = list ?? []; return l.includes(v) ? l.filter((x) => x !== v) : [...l, v]; };
  const set = (p: Partial<SearchParams>) => onChange({ ...p, page: 1 });
  const county = value.countyCodes?.[0] ?? "";
  /** One word or place: plain keyword search. A sentence: the parts we are sure of become filters the person can change. Runs as the person types. */
  const search = (openFilters: boolean, raw = q) => {
    const value = latest.current, text = raw.trim();
    const { understood: u } = understand(text);
    const base = Object.fromEntries(Object.entries(pickCriteria(value)).filter(([k]) => !fromText.current.includes(k)));
    fromText.current = Object.keys(u.criteria).filter((k) => k !== "q");
    applied.current = u.criteria.q ?? "";
    setUnderstood(u.notes);
    
    onChange(replaceCriteria({ ...base, ...u.criteria, q: u.criteria.q }));
  };
  const searchText = (s: string) => search(false, s);
  const clearAll = () => { clearTimeout(timers.current.get("q")); ai.close(); ai.reset(); setQ(""); setUnderstood([]); fromText.current = []; applied.current = ""; onChange({ ...CLEAR_ALL }); };
  const clearBox = () => { clearTimeout(timers.current.get("q")); if (!ai.open) setSheet(false); if (ai.open) { clearAll(); return; } setQ(""); search(false, ""); };
  const pickPlace = (h: import("@/lib/places.server").PlaceHit) => {
    const base = Object.fromEntries(Object.entries(pickCriteria(latest.current)).filter(([k]) => k !== "q" && k !== "countyCodes"));
    const rest = understand(q.trim()).understood.criteria; delete rest.q;
    setQ(""); setUnderstood([]); fromText.current = Object.keys(rest);
    onChange(replaceCriteria({ ...base, ...rest, ...(h.kind === "county" ? { countyCodes: [h.countyCode!] } : h.kind === "area" ? { q: h.label, ...(h.countyCode ? { countyCodes: [h.countyCode] } : {}) } : {}) }) as Partial<SearchParams>);
    if (h.kind === "place" && h.lat !== undefined && h.lng !== undefined) onChange({ circle: { lat: h.lat, lng: h.lng, radiusM: 3000 }, page: 1 });
  };
  const active = [value.category, value.propertyTypes?.length, value.priceMin, value.priceMax, value.bedroomsMin, value.bathroomsMin, value.areaSqmMin, value.areaSqmMax, value.features?.length, value.furnishing, value.conditions?.length, value.verifiedOnly].filter(Boolean).length;

  return (
    <form role="search" aria-label="Search properties" data-tour="filters" onSubmit={(e) => { e.preventDefault(); clearTimeout(timers.current.get("q")); if (ai.open) { const t = q; setQ(""); ai.send(t); } else search(true); }} className={`rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8 ${side ? "lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:overscroll-contain" : ""}`}>
      <div className="mb-5 flex flex-wrap items-center gap-2"><div className={`rounded-full bg-muted p-1 ${side ? "flex w-full" : "inline-flex"}`} role="tablist" aria-label="Listing type">
        {[{ key: undefined, label: "All" }, ...LISTING_TYPES.map((t) => ({ key: t.key as string | undefined, label: t.short }))].map((t) => (
          <button key={t.label} type="button" role="tab" aria-selected={value.listingType === t.key} onClick={() => set({ listingType: t.key as SearchParams["listingType"] })} className={`whitespace-nowrap rounded-full ${side ? "flex-1 px-2" : "px-3"} py-1.5 text-sm font-semibold transition ${value.listingType === t.key ? "bg-foreground text-background shadow" : "text-muted-foreground hover:text-foreground"}`}>{t.label}</button>
        ))}
        
      </div>
        <Link to="/developments" search={value.countyCodes?.[0] ? { county: value.countyCodes[0] } : {}} className="rounded-full border border-border px-3 py-1.5 text-[0.8125rem] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground">Developments</Link>
      </div>
      <div className={`grid gap-4 ${side ? "md:grid-cols-[1fr_14rem_auto] lg:grid-cols-1" : "md:grid-cols-[1fr_14rem_auto]"}`}>
        <div className="relative">
          <label htmlFor="sf-q" className="sr-only">Area, estate or keyword</label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input id="sf-q" value={q} onChange={(e) => { const s = e.target.value; setQ(s); if (!ai.open) later("q", () => searchText(s)); }} placeholder={ai.open ? "Reply to refine, e.g. “make it Kiambu”" : "Area, estate or keyword"} className={`${field} !h-12 pl-10 pr-24 !text-[0.95rem]`} maxLength={100} />
          {(q.length > 0 || ai.open) && <button type="button" onClick={clearBox} aria-label={ai.open ? "Close chat and clear everything" : "Clear what I typed"} className="close-circle absolute right-12 top-1/2 -translate-y-1/2"><X className="size-4" /></button>}
          <VoiceButton onText={(t) => { if (ai.open) ai.send(t); else { setQ(t); searchText(t); } }} />
        </div>
        <div>
          <label htmlFor="sf-county" className="sr-only">County</label>
          <Pick id="sf-county" label="County" clearLabel="All counties" className={`!h-12 !text-[0.95rem]`} leading={{ label: "Use my location", icon: <LocateFixed className="h-4 w-4" aria-hidden />, onClick: () => locateMe(5000, (circle) => set({ circle, polygon: undefined, countyCodes: undefined })) }} value={value.circle ? "geo:circle" : value.polygon ? "geo:poly" : county ? String(county) : ""} onChange={(v) => { if (v.startsWith("geo:")) return; set({ countyCodes: v ? [Number(v)] : undefined, circle: undefined, polygon: undefined }); }} options={[...(value.circle ? [{ value: "geo:circle", label: `Within ${Math.round(value.circle.radiusM / 100) / 10} km of the map pin` }] : []), ...(value.polygon ? [{ value: "geo:poly", label: "Area drawn on the map" }] : []), ...COUNTY_OPTIONS]} searchable />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={`h-12 flex-1 rounded-xl bg-primary px-5 text-[0.95rem] font-bold text-primary-foreground md:flex-none`}>Search</button>
          <button type="button" disabled={ai.pending} onClick={() => { const t = q; setQ(""); ai.send(t); }} title={ai.open ? "Send your message to the AI" : "Describe what you want in your own words"}
            className="inline-flex h-12 items-center gap-2 whitespace-nowrap ask-ai-btn rounded-xl border border-foreground/20 bg-foreground/10 px-5 text-[0.95rem] font-bold text-foreground disabled:opacity-50">
            {ai.pending ? <Loader size="xs" /> : <Sparkles className="h-4 w-4" aria-hidden />}{ai.open ? "Refine" : "Ask AI"}
          </button>
          {(hasFilters(value) || q.length > 0 || ai.open) && <button type="button" onClick={clearAll} className="inline-flex h-12 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-[0.95rem] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4" aria-hidden />Clear all</button>}
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`inline-flex h-12 items-center gap-2 rounded-xl border border-input bg-background px-5 text-[0.95rem] font-semibold ${side ? "lg:hidden" : ""}`}>
            <FiltersIcon className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.4} />Filters{active ? <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{active}</span> : null}
          </button>
        </div>
      </div>

      {!ai.open && placeWords(q).length >= 3 && <PlaceSuggest text={q} onPick={pickPlace} />}
      {ai.panel}
      {ai.dialog}
      {understood.length > 0 && (
        <p className="mt-4 mb-4 text-sm" role="status"><span className="font-semibold">Filters set from your words:</span> {understood.join(" · ")}. <span className="text-muted-foreground">Open Filters to change any of them.</span></p>
      )}

      {(open || side) && (
        <div className={`mt-5 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-border pt-4 ${side ? `${open ? "" : "max-lg:hidden"} max-lg:max-h-[min(60dvh,30rem)] max-lg:overflow-y-auto lg:grid-cols-1` : "max-h-[min(60dvh,30rem)] overflow-y-auto overscroll-contain pr-1 lg:grid-cols-4"}`}>
          <div>
            <span className={label}>Category</span>
            <Pick label="Category or type" clearLabel="Any" value={value.propertyTypes?.length === 1 ? `type:${value.propertyTypes[0]}` : value.category ? `cat:${value.category}` : ""} options={CATEGORY_TYPE_OPTIONS}
              onChange={(v) => set(v.startsWith("type:") ? { category: PROPERTY_TYPES.find((t) => t.key === v.slice(5))?.category as SearchParams["category"], propertyTypes: [v.slice(5) as never], features: undefined } : { category: (v.slice(4) || undefined) as SearchParams["category"], propertyTypes: undefined, features: undefined })} />
          </div>
          <div>
            <span className={label}>Price (KES)</span>
            <div className="grid grid-cols-2 gap-2">
              <Pick label="Minimum price" clearLabel="No min" value={value.priceMin ? String(value.priceMin) : ""} onChange={(v) => set({ priceMin: v ? Number(v) : undefined })} options={priceOptions} />
              <Pick label="Maximum price" clearLabel="No max" value={value.priceMax ? String(value.priceMax) : ""} onChange={(v) => set({ priceMax: v ? Number(v) : undefined })} options={priceOptions} />
            </div>
          </div>
          <div>
            <span className={label}>Bedrooms (at least)</span>
            <Pick label="Bedrooms" clearLabel="Any" value={value.bedroomsMin === undefined ? "" : String(value.bedroomsMin)} onChange={(v) => set({ bedroomsMin: v === "" ? undefined : Number(v) })} options={BEDS} />
          </div>
          <div>
            <span className={label}>Bathrooms (at least)</span>
            <Pick label="Bathrooms" clearLabel="Any" value={value.bathroomsMin === undefined ? "" : String(value.bathroomsMin)} onChange={(v) => set({ bathroomsMin: v === "" ? undefined : Number(v) })} options={BATHS} />
          </div>
          <div>
            <span className={label}>Property type</span>
            <MultiPick label="Property type" allLabel="Any type" values={value.propertyTypes ?? []} onChange={(v) => set({ propertyTypes: v.length ? (v as never) : undefined })} options={typeOptions} />
          </div>
          <div>
            <span className={label}>Furnishing</span>
            <Pick label="Furnishing" clearLabel="Any" value={value.furnishing ?? ""} onChange={(v) => set({ furnishing: (v || undefined) as SearchParams["furnishing"] })} options={toOptions(FURNISHINGS)} />
          </div>
          <div>
            <span className={label}>Condition</span>
            <Pick label="Condition" clearLabel="Any" value={value.conditions?.[0] ?? ""} onChange={(v) => set({ conditions: v ? [v as never] : undefined })} options={toOptions(CONDITIONS)} />
          </div>
          <div>
            <span className={label}>Size (m²)</span>
            <div className="flex items-center gap-2">
              <input inputMode="numeric" aria-label="Minimum size" placeholder="Min" defaultValue={value.areaSqmMin ?? ""} key={`smin-${value.areaSqmMin ?? ""}`} onChange={(e) => { const v = e.target.value; later("areaSqmMin", () => set({ areaSqmMin: num(v) })); }} onBlur={(e) => set({ areaSqmMin: num(e.target.value) })} className={field} />
              <span aria-hidden>–</span>
              <input inputMode="numeric" aria-label="Maximum size" placeholder="Max" defaultValue={value.areaSqmMax ?? ""} key={`smax-${value.areaSqmMax ?? ""}`} onChange={(e) => { const v = e.target.value; later("areaSqmMax", () => set({ areaSqmMax: num(v) })); }} onBlur={(e) => set({ areaSqmMax: num(e.target.value) })} className={field} />
            </div>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
            <input type="checkbox" checked={value.verifiedOnly ?? false} onChange={(e) => set({ verifiedOnly: e.target.checked || undefined })} className="h-4 w-4" />Verified agencies only
          </label>
          <div>
            <span className={label}>Must have (up to 10)</span>
            <MultiPick label="Must have" allLabel="Nothing specific" max={10} values={value.features ?? []} onChange={(v) => set({ features: v.length ? (v as never) : undefined })} options={featureOptions} />
          </div>
          {active > 0 && (
            <button type="button" onClick={() => onChange({ category: undefined, propertyTypes: undefined, priceMin: undefined, priceMax: undefined, bedroomsMin: undefined, bathroomsMin: undefined, areaSqmMin: undefined, areaSqmMax: undefined, features: undefined, furnishing: undefined, conditions: undefined, verifiedOnly: undefined, page: 1 })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline"><X className="h-3.5 w-3.5" aria-hidden />Clear filters</button>
          )}
        </div>
      )}
    </form>
  );
}
