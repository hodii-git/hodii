import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Send, Bath, BedDouble, Building2, Coins, LayoutGrid, LocateFixed, MapPin, Ruler, Search, ShieldCheck, SlidersHorizontal, Sofa, Sparkles, Star, Wallet, Wrench, X, type LucideIcon } from "lucide-react";
import { ToneIcon, type Tone } from "@/components/ui/tone-icon";
import { Pick, type PickOption } from "@/components/ui/pick";
import { MultiPick } from "@/components/ui/multi-pick";
import { POPUP_CARD, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CATEGORY_TYPE_OPTIONS, COUNTY_OPTIONS, toOptions } from "@/lib/pick-options";
import { CONDITIONS, FEATURES, FURNISHINGS, LISTING_TYPES, PROPERTY_CATEGORIES, PROPERTY_TYPES, featuresFor } from "@/lib/mongodb/taxonomy";
import type { SearchParams } from "@/lib/listing-search";
import { pickCriteria, replaceCriteria, useAiSearch, type AiResult } from "@/components/property/ai-search-panel";
import { PlaceSuggest, placeWords } from "@/components/property/place-suggest";
import { CLEAR_ALL, hasFilters } from "@/lib/criteria-chips";
import { VoiceButton } from "@/components/property/voice-button";
import { locateMe } from "@/components/property/use-my-location";
import { understand } from "@/lib/query-intent";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/loader";
import { filterSelection } from "@/lib/filter-selection";
import { SearchSheet } from "@/components/search-sheet";
import { setSheet, useSheetOpen } from "@/lib/search-sheet";

const seg = "!h-14 !rounded-none !border-0 !bg-transparent !px-0 !text-[1.05rem] !text-foreground";
const field = "h-10 w-full rounded-xl border border-[#aab3c4] bg-white px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring";
const HINTS: Record<string, string> = { Location: "A county, or your spot on the map", "Max price": "The most you want to pay", Category: "Homes, land or commercial", "Property type": "Pick one or several", "Min price": "Skip anything cheaper", Bedrooms: "At least this many", Bathrooms: "At least this many", Furnishing: "Furnished or not", Condition: "New, good, needs work", "Size (m²)": "Floor or plot area", "Must have (up to 10)": "Features it has to have" };
/** One filter, in its own card like the feedback options. */
const L = ({ icon, tone, children }: { icon: LucideIcon; tone: Tone; children: ReactNode }) => (
  <span className="mb-3 flex items-start gap-3"><ToneIcon icon={icon} tone={tone} /><span className="min-w-0"><span className="block text-sm font-bold text-foreground">{children}</span><span className="block text-xs text-muted-foreground">{HINTS[String(children)] ?? ""}</span></span></span>
);
const fcard = "min-w-0 rounded-2xl border border-[#d4d4d8] bg-[#f4f4f5] p-3 transition focus-within:border-black/40";
const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;
const RENT = [10_000, 20_000, 30_000, 50_000, 80_000, 120_000, 200_000, 400_000];
const SALE = [2_000_000, 5_000_000, 8_000_000, 12_000_000, 20_000_000, 40_000_000, 80_000_000, 200_000_000];
const BEDS: PickOption[] = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}+ beds` }));
const BATHS: PickOption[] = [1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n}+ baths` }));
const num = (s: string) => { const n = Number(s.replace(/[, ]/g, "")); return s.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined; };

/** The homepage search bar: location, price, a "More filters" panel and an AI button. Filters apply on the page, without leaving it. */
export function HomeSearch({ value, onChange, result, deferred = false, pinned = false }: { pinned?: boolean; value: SearchParams; onChange: (next: Partial<SearchParams>) => void; result?: AiResult; /** Homepage: nothing searches while typing; Enter, a filter or Ask AI sends the person to the search page. */ deferred?: boolean }) {
  const set = (p: Partial<SearchParams>) => onChange({ ...p, page: 1 });
  const [moreOpen, setMoreOpen] = useState(false);
  const [phone, setPhone] = useState(false);
  const sheetOpen = useSheetOpen();
  // Closing the sheet puts it back on the plain search next time; the filters stay applied.
  useEffect(() => { if (phone && !sheetOpen) setMoreOpen(false); }, [phone, sheetOpen]);
  useEffect(() => { const m = window.matchMedia("(max-width: 767px)"); const f = () => setPhone(m.matches); f(); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  const [text, setText] = useState(value.q ?? "");
  const [notes, setNotes] = useState<string[]>([]);
  const moreRef = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(value); latest.current = value;
  const applied = useRef(value.q ?? "");
  const fromText = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { if (!chatOpen.current && (value.q ?? "") !== applied.current) { applied.current = value.q ?? ""; setText(value.q ?? ""); } }, [value.q]);
  useEffect(() => () => clearTimeout(timer.current), []);
  // The box grows with what is typed, up to a share of the screen height, then scrolls.
  const typing = text.length > 0;
  useEffect(() => { const el = box.current; if (!el) return; if (!typing) { el.style.height = ""; return; } el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, Math.max(120, window.innerHeight * 0.3))}px`; }, [text, typing]);
  const chatOpen = useRef(false);
  const ai = useAiSearch({ value, result, onApply: (n) => { setNotes([]); fromText.current = []; onChange(n); } });
  /** Everything back to nothing: the words, the filters, the map area and any chat. */
  chatOpen.current = ai.open;
  // Ask AI is always the bottom sheet, whatever the screen size.
  useEffect(() => { if (!phone && !pinned) setSheet(ai.open); }, [ai.open, phone, pinned]);
  // Pinned (map page on wide screens): the chat is open from the start.
  useEffect(() => { if (pinned && !phone) ai.show(); }, [pinned, phone]); // eslint-disable-line react-hooks/exhaustive-deps
  const clearAll = () => { clearTimeout(timer.current); ai.close(); setText(""); setNotes([]); fromText.current = []; applied.current = ""; onChange({ ...CLEAR_ALL }); };
  /** The X: closes the chat and clears the box. Words typed without chat only lose what they set. */
  const clearBox = () => { clearTimeout(timer.current); if (ai.open) { clearAll(); return; } setText(""); search(""); };
  const submitAi = () => { clearTimeout(timer.current); const t = text; setText(""); ai.send(t); };
  const submit = () => { clearTimeout(timer.current); if (ai.open) { const t = text; setText(""); ai.send(t); } else { search(text); setSheet(false); } };
  const pickPlace = (h: import("@/lib/places.server").PlaceHit) => {
    const base = Object.fromEntries(Object.entries(pickCriteria(latest.current)).filter(([k]) => k !== "q" && k !== "countyCodes"));
    const rest = understand(text.trim()).understood.criteria;
    delete rest.q;
    setText(""); setNotes([]); fromText.current = Object.keys(rest);
    onChange(replaceCriteria({ ...base, ...rest, ...(h.kind === "county" ? { countyCodes: [h.countyCode!] } : h.kind === "area" ? { q: h.label, ...(h.countyCode ? { countyCodes: [h.countyCode] } : {}) } : {}) }) as Partial<SearchParams>);
    if (h.kind === "place" && h.lat !== undefined && h.lng !== undefined) onChange({ circle: { lat: h.lat, lng: h.lng, radiusM: 3000 }, page: 1 });
  };
  /** Same as the search page: a word is a keyword search, a sentence becomes filters, all as the person types. AI is only for the Ask AI button. */
  const search = (raw: string) => {
    const cur = latest.current;
    const { understood: u } = understand(raw.trim());
    const base = Object.fromEntries(Object.entries(pickCriteria(cur)).filter(([k]) => !fromText.current.includes(k)));
    fromText.current = Object.keys(u.criteria).filter((k) => k !== "q");
    applied.current = u.criteria.q ?? "";
    setNotes(u.notes);
    onChange(replaceCriteria({ ...base, ...u.criteria, q: u.criteria.q }));
  };
  const steps = value.listingType === "sale" ? SALE : value.listingType ? RENT : [...RENT.slice(0, 5), ...SALE];
  const priceOptions = useMemo(() => steps.map((n) => ({ value: String(n), label: `Up to ${kes(n)}` })), [steps]);
  const minOptions = useMemo(() => steps.map((n) => ({ value: String(n), label: kes(n) })), [steps]);
  const types = useMemo(() => PROPERTY_TYPES.filter((t) => !value.category || t.category === value.category).map((t) => ({ value: t.key, label: t.label, group: PROPERTY_CATEGORIES.find((c) => c.key === t.category)?.label ?? "" })), [value.category]);
  const feats = useMemo(() => (value.category ? featuresFor(value.category) : FEATURES.filter((f) => f.for.includes("residential"))).map((f) => ({ value: f.key, label: f.label })), [value.category]);
  const county = value.countyCodes?.[0];
  const locOptions = useMemo<PickOption[]>(() => [...(value.circle ? [{ value: "geo:circle", label: `Within ${value.circle.radiusM >= 1000 ? `${Math.round(value.circle.radiusM / 100) / 10} km` : `${value.circle.radiusM} m`} of the map pin` }] : []), ...(value.polygon ? [{ value: "geo:poly", label: "Area drawn on the map" }] : []), ...COUNTY_OPTIONS], [value.circle, value.polygon]);
  const active = [value.listingType, value.countyCodes?.length || value.circle || value.polygon, value.priceMax, value.category, value.propertyTypes?.length, value.priceMin, value.bedroomsMin, value.bathroomsMin, value.areaSqmMin, value.areaSqmMax, value.features?.length, value.furnishing, value.conditions?.length, value.verifiedOnly].filter(Boolean).length;

  const filtersBody = (
            <div>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className={fcard}><L icon={MapPin} tone="other">Location</L><Pick label="Location" clearLabel="Anywhere in Kenya" leading={{ label: "Use my location", icon: <LocateFixed className="h-4 w-4" aria-hidden />, onClick: () => locateMe(5000, (circle) => set({ circle, polygon: undefined, countyCodes: undefined })) }} panelClassName="glass-menu" className={field} value={value.circle ? "geo:circle" : value.polygon ? "geo:poly" : county ? String(county) : ""} onChange={(v) => { if (v.startsWith("geo:")) return; set({ countyCodes: v ? [Number(v)] : undefined, circle: undefined, polygon: undefined }); }} options={locOptions} searchable /></div>
                <div className={fcard}><L icon={Wallet} tone="idea">Max price</L><Pick label="Max price" clearLabel="Any price" panelClassName="glass-menu" className={field} value={value.priceMax ? String(value.priceMax) : ""} onChange={(v) => set({ priceMax: v ? Number(v) : undefined })} options={priceOptions} custom={{ placeholder: "Type a max price (KES)", label: (v) => `Up to ${kes(Number(v))}` }} /></div>
              </div>
              <p className="mb-2 mt-5 text-sm font-bold">Buy, rent or stay</p><div className="mb-5 inline-flex max-w-full overflow-x-auto rounded-full border border-[#d4d4d8] bg-[#f4f4f5] p-1 [scrollbar-width:none]" role="tablist" aria-label="Listing type">
                {[{ key: undefined as string | undefined, label: "All" }, ...LISTING_TYPES.map((t) => ({ key: t.key as string | undefined, label: t.short }))].map((t) => (
                  <Button variant="ghost" key={t.label} type="button" role="tab" aria-selected={value.listingType === t.key} onClick={() => set({ listingType: (filterSelection(value.listingType ?? "", t.key ?? "", true) || undefined) as SearchParams["listingType"], priceMin: undefined, priceMax: undefined })} className={`h-auto rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${value.listingType === t.key ? "cta" : "text-muted-foreground hover:text-foreground"}`}>{t.label}</Button>
                ))}
                <Link to="/developments" search={county ? { county } : {}} className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground">Developments</Link>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className={fcard}><L icon={LayoutGrid} tone="bug">Category</L>
                  <Pick label="Category or type" clearLabel="Any" panelClassName="glass-menu" className={field} value={value.propertyTypes?.length === 1 ? `type:${value.propertyTypes[0]}` : value.category ? `cat:${value.category}` : ""} options={CATEGORY_TYPE_OPTIONS}
                    onChange={(v) => set(v.startsWith("type:") ? { category: PROPERTY_TYPES.find((t) => t.key === v.slice(5))?.category as SearchParams["category"], propertyTypes: [v.slice(5) as never], features: undefined } : { category: (v.slice(4) || undefined) as SearchParams["category"], propertyTypes: undefined, features: undefined })} /></div>
                <div className={fcard}><L icon={Building2} tone="other">Property type</L><MultiPick label="Property type" allLabel="Any type" className={field} values={value.propertyTypes ?? []} onChange={(v) => set({ propertyTypes: v.length ? (v as never) : undefined })} options={types} /></div>
                <div className={fcard}><L icon={Coins} tone="idea">Min price</L><Pick label="Minimum price" clearLabel="No min" panelClassName="glass-menu" className={field} value={value.priceMin ? String(value.priceMin) : ""} onChange={(v) => set({ priceMin: v ? Number(v) : undefined })} options={minOptions} custom={{ placeholder: "Type a min price (KES)", label: (v) => kes(Number(v)) }} /></div>
                <div className={fcard}><L icon={BedDouble} tone="confusing">Bedrooms</L><Pick label="Bedrooms" clearLabel="Any" panelClassName="glass-menu" className={field} value={value.bedroomsMin === undefined ? "" : String(value.bedroomsMin)} onChange={(v) => set({ bedroomsMin: v === "" ? undefined : Number(v) })} options={BEDS} /></div>
                <div className={fcard}><L icon={Bath} tone="other">Bathrooms</L><Pick label="Bathrooms" clearLabel="Any" panelClassName="glass-menu" className={field} value={value.bathroomsMin === undefined ? "" : String(value.bathroomsMin)} onChange={(v) => set({ bathroomsMin: v === "" ? undefined : Number(v) })} options={BATHS} /></div>
                <div className={fcard}><L icon={Sofa} tone="bug">Furnishing</L><Pick label="Furnishing" clearLabel="Any" panelClassName="glass-menu" className={field} value={value.furnishing ?? ""} onChange={(v) => set({ furnishing: (v || undefined) as SearchParams["furnishing"] })} options={toOptions(FURNISHINGS)} /></div>
                <div className={fcard}><L icon={Wrench} tone="down">Condition</L><Pick label="Condition" clearLabel="Any" panelClassName="glass-menu" className={field} value={value.conditions?.[0] ?? ""} onChange={(v) => set({ conditions: v ? [v as never] : undefined })} options={toOptions(CONDITIONS)} /></div>
                <div className={fcard}><L icon={Ruler} tone="down">Size (m²)</L>
                  <div className="flex items-center gap-2">
                    <input inputMode="numeric" aria-label="Minimum size" placeholder="Min" defaultValue={value.areaSqmMin ?? ""} key={`a${value.areaSqmMin ?? ""}`} onBlur={(e) => set({ areaSqmMin: num(e.target.value) })} className={field} />
                    <input inputMode="numeric" aria-label="Maximum size" placeholder="Max" defaultValue={value.areaSqmMax ?? ""} key={`b${value.areaSqmMax ?? ""}`} onBlur={(e) => set({ areaSqmMax: num(e.target.value) })} className={field} />
                  </div></div>
                <div className={`${fcard} sm:col-span-2`}><L icon={Star} tone="confusing">Must have (up to 10)</L><MultiPick label="Must have" allLabel="Nothing specific" className={field} max={10} values={value.features ?? []} onChange={(v) => set({ features: v.length ? (v as never) : undefined })} options={feats} /></div>
                <label className={`${fcard} flex cursor-pointer items-center gap-3 ${value.verifiedOnly ? "border-primary bg-primary/10" : ""}`}><ToneIcon icon={ShieldCheck} tone="bug" /><span className="min-w-0 flex-1"><span className="block text-sm font-bold">Verified agencies only</span><span className="block text-xs text-muted-foreground">Checked by the Hodii team</span></span><input type="checkbox" checked={value.verifiedOnly ?? false} onChange={(e) => set({ verifiedOnly: e.target.checked || undefined })} className="h-4 w-4 accent-primary" /></label>
                {active > 0 && <button type="button" onClick={() => set({ listingType: undefined, countyCodes: undefined, circle: undefined, polygon: undefined, priceMax: undefined, category: undefined, propertyTypes: undefined, priceMin: undefined, bedroomsMin: undefined, bathroomsMin: undefined, areaSqmMin: undefined, areaSqmMax: undefined, features: undefined, furnishing: undefined, conditions: undefined, verifiedOnly: undefined })} className="inline-flex items-center justify-center gap-1.5 justify-self-end rounded-full border border-input px-4 py-2 text-sm font-semibold transition hover:bg-muted"><X className="h-3.5 w-3.5" aria-hidden />Clear filters</button>}
              </div>
            </div>
  );
  return (
    <SearchSheet ai={ai.open} pinned={pinned && !phone}>
      <form role="search" aria-label="Search properties" data-tour="hero-search" onSubmit={(e) => { e.preventDefault(); submit(); }} className={`home-search ${phone && moreOpen ? "hidden" : ""} glass-solid ${ai.open ? "mt-4 lg:mt-5" : "mt-8 lg:mt-12"} flex w-full min-w-0 flex-col gap-3 rounded-[2rem] p-3 sm:p-4 ${typing ? "" : "2xl:flex-row 2xl:items-center"}`}>
        <div className={`input-glass relative flex min-w-0 items-start gap-3 rounded-[1.5rem] px-5 py-4 ${typing ? "w-full" : "flex-1"}`}>
          <Search className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.7} aria-hidden />
          <label htmlFor="home-q" className="sr-only">Describe the place you want</label>
          <textarea id="home-q" ref={box} rows={1} maxLength={300} value={text}
            onChange={(e) => { const v = e.target.value; setText(v); clearTimeout(timer.current); if (!ai.open && !deferred) { if (v.trim() === "") search(""); else timer.current = setTimeout(() => search(v), 800); } }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={ai.open ? "Reply to refine: “make it Kiambu”…" : "Try “2 bedroom in Kilimani under 80k”"}
            className={`min-h-6 min-w-0 flex-1 resize-none bg-transparent ${text.length > 0 && !ai.open ? "pr-[7.4rem]" : "pr-[5.4rem]"} text-base leading-6 md:text-[1.05rem] outline-hidden placeholder:text-muted-foreground ${typing ? "max-h-[30dvh] overflow-y-auto overscroll-contain" : "h-6 overflow-hidden whitespace-nowrap placeholder:truncate"}`} />
          {text.length > 0 && !ai.open && <button type="button" onClick={clearBox} aria-label={ai.open ? "Close chat and clear everything" : "Clear what I typed"} title={ai.open ? "Close chat and clear" : "Clear"} className="close-circle absolute right-[5.25rem] top-1/2 -translate-y-1/2"><X className="size-4" /></button>}
          <span data-tour="voice" className="ai-mic inline-flex"><VoiceButton onText={(t) => { if (ai.open) ai.send(t); else { setText(t); search(t); } }} /></span>
          <button type="submit" aria-label={ai.open ? "Send message" : "Search"} disabled={ai.pending} className="cta-ink absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full disabled:opacity-60">{ai.pending ? <Loader size="xs" /> : <Send className="size-5" aria-hidden />}</button>
        </div>
        {!ai.open && placeWords(text).length >= 3 && <PlaceSuggest text={text} onPick={pickPlace} />}
        <div className={`flex min-w-0 flex-row flex-nowrap items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-between sm:gap-3 ${typing ? "w-full" : "2xl:shrink-0"}`}>
        <div ref={moreRef} className={`input-glass flex w-auto shrink-0 items-center rounded-xl px-3 ${typing ? "" : "2xl:h-14 2xl:rounded-2xl 2xl:px-4"}`}>
          <Button variant="ghost" type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)} className="flex h-10 w-full justify-start gap-2 2xl:h-full bg-transparent p-0 text-left text-sm hover:bg-transparent">
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-foreground" strokeWidth={2} aria-hidden />
            <span className="relative shrink-0 whitespace-nowrap pr-2 font-semibold text-foreground">More filters
              {active > 0 && <span className="cta absolute -right-0.5 -top-3 grid h-[1.1rem] min-w-[1.1rem] place-items-center rounded-full px-1 text-[0.65rem] font-bold leading-none">{active}</span>}</span>
          </Button>
          {moreOpen && !phone && typeof document !== "undefined" && createPortal(<div aria-hidden className="popup-scrim fixed inset-0 z-[55]" onClick={() => setMoreOpen(false)} />, document.body)}
          <Dialog open={moreOpen && !phone} onOpenChange={setMoreOpen} modal={false}>
          <DialogContent onInteractOutside={(e) => { if ((e.target as Element | null)?.closest?.("[data-floating-panel]")) e.preventDefault(); }} className={`${POPUP_CARD} z-[81] sm:max-w-xl md:max-w-2xl [&>*]:min-w-0`}>
            <DialogHeader className="mb-1 text-left"><DialogTitle className="flex items-center gap-3"><ToneIcon icon={SlidersHorizontal} tone="other" />More filters</DialogTitle><DialogDescription className="popup-note mt-3 text-left">Results update as you choose. Pick only what matters to you.</DialogDescription></DialogHeader>
            {filtersBody}
          </DialogContent>
          </Dialog>
        </div>
        <div className="ml-auto flex shrink-0 items-center justify-end gap-1">
          {(hasFilters(value) || text.length > 0 || ai.open) && <button type="button" data-tour="clear-all" onClick={clearAll} className="inline-flex h-10 items-center gap-1 whitespace-nowrap rounded-xl 2xl:h-14 2xl:rounded-2xl border border-black/20 bg-white px-2.5 text-sm font-bold text-foreground shadow-sm transition hover:bg-muted"><X className="size-3.5" aria-hidden />Clear all</button>}
          <Button type="button" data-tour="ask-ai" disabled={ai.pending} onClick={submitAi} title={ai.open ? "Send your message to the AI" : "Let AI read what you typed"} className={`cta-ink inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 2xl:h-14 2xl:rounded-2xl 2xl:px-5 text-sm font-bold ${ai.open ? "max-md:hidden" : ""} transition hover:opacity-90 disabled:opacity-85`}>
            {ai.pending ? <Loader size="xs" /> : <Sparkles className="h-4 w-4" aria-hidden />}{ai.open ? "Refine" : "Ask AI"}
          </Button>
        </div>
        </div>
      </form>
      {phone && moreOpen && (
        <div className="filters-plain pb-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-base font-extrabold"><ToneIcon icon={SlidersHorizontal} tone="other" />More filters</p>
            <button type="button" onClick={() => setMoreOpen(false)} className="cta-ink h-9 rounded-xl px-4 text-sm font-bold">Done</button>
          </div>
          {filtersBody}
        </div>
      )}
      {notes.length > 0 && <p className="mt-3 px-2 text-sm text-muted-foreground">Understood: {notes.join(" · ")}</p>}
      {ai.panel}
      {ai.dialog}
    </SearchSheet>
  );
}
