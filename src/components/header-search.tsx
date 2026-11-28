import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { TypePills } from "@/components/property/type-pills";
import { PROPERTY_TYPES } from "@/lib/mongodb/taxonomy";
import { VoiceButton } from "@/components/property/voice-button";
import { pickCriteria, replaceCriteria } from "@/components/property/ai-search-panel";
import { understand } from "@/lib/query-intent";
import { paramsFromUrl, urlFromParams, type SearchUrl } from "@/lib/search-url";

/** Keep a person on the map when they search or filter from the header. */
const keepView = (s: SearchUrl) => ((s as Record<string, unknown>)["view"] === "map" ? { view: "map" } : {});

/** The search box that sits in the centre of the header on large screens. A word or a sentence both work, as on the home search. */
export function HeaderSearch() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search }) as SearchUrl;
  const params = paramsFromUrl(search);
  const [text, setText] = useState(params.q ?? "");
  const applied = useRef(params.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { if ((params.q ?? "") !== applied.current) { applied.current = params.q ?? ""; setText(params.q ?? ""); } }, [params.q]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const run = (raw: string) => {
    const { understood: u } = understand(raw.trim());
    applied.current = u.criteria.q ?? "";
    const next = replaceCriteria({ ...pickCriteria(params), ...u.criteria, q: u.criteria.q });
    void navigate({ to: "/properties", search: { ...urlFromParams({ ...params, ...next, page: 1 }), ...keepView(search) }, replace: true, resetScroll: false });
  };
  return (
    <form role="search" className="hdr-search mx-auto flex w-full items-center gap-1.5 rounded-full bg-muted pl-6 pr-1.5 shadow-[0_10px_30px_-14px_rgb(0_0_0/0.8)] ring-1 ring-border transition-shadow" onSubmit={(e) => { e.preventDefault(); clearTimeout(timer.current); run(text); }}>
      <input data-bare type="search" value={text} aria-label="Search properties" placeholder="Try “2 bedroom in Kilimani under 80k” or a place"
        onChange={(e) => { const v = e.target.value; setText(v); clearTimeout(timer.current); timer.current = v.trim() === "" ? undefined : setTimeout(() => run(v), 800); if (v.trim() === "") run(""); }}
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:placeholder:text-[0.875rem] [&::-webkit-search-cancel-button]:hidden" />
      {text && <button type="button" aria-label="Clear search" onClick={() => { setText(""); run(""); }} className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-foreground/5"><X className="size-4" aria-hidden /></button>}
      <VoiceButton inline onText={(t) => { setText(t); clearTimeout(timer.current); run(t); }} />
      <button type="submit" aria-label="Search" className="hdr-search-go grid shrink-0 place-items-center rounded-full text-white transition hover:brightness-110" style={{ background: "var(--brand-gradient)" }}><Search className="size-5" strokeWidth={2.4} aria-hidden /></button>
    </form>
  );
}

/** The property types as one row of pills (the same look as on the phone) that scrolls sideways; used under the header on tablets and beside Filters on large screens. */
export function HeaderPills({ fade = "card" }: { fade?: "card" | "page" }) {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search }) as SearchUrl;
  const params = paramsFromUrl(search);
  const none = !params.propertyTypes?.length;
  const pill = "ld-pill shrink-0 whitespace-nowrap !h-10 !text-[0.9rem]";
  const edge = fade === "page" ? "var(--background)" : "var(--card)";
  return (
    <div role="group" aria-label="Property types" data-tour="type-pills" className="flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ "--fade-bg": edge, WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 10px, #000 calc(100% - 28px), transparent 100%)", maskImage: "linear-gradient(to right, transparent 0, #000 10px, #000 calc(100% - 28px), transparent 100%)" } as React.CSSProperties}>
      <button type="button" aria-pressed={none} onClick={() => void navigate({ to: "/properties", search: { ...urlFromParams({ ...params, propertyTypes: undefined, page: 1 }), ...keepView(search) }, replace: true, resetScroll: false })} className={`${pill} ${none ? "ld-pill-on" : ""}`}>All</button>
      <MobileTypePills pill={pill} />
    </div>
  );
}

/** The same property types as the chips, as small pills for the phone header's scrolling row (they read and change the address themselves). */
export function MobileTypePills({ pill }: { pill: string }) {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search }) as SearchUrl;
  const params = paramsFromUrl(search);
  const sel = params.propertyTypes;
  const set = (v: string[] | undefined) => void navigate({ to: "/properties", search: { ...urlFromParams({ ...params, propertyTypes: v as typeof params.propertyTypes, page: 1 }), ...keepView(search) }, resetScroll: false });
  return (
    <>
      {PROPERTY_TYPES.map((t) => {
        const a = !!sel?.includes(t.key);
        return <button key={t.key} type="button" aria-pressed={a} onClick={() => set(a ? (sel!.length > 1 ? sel!.filter((x) => x !== t.key) : undefined) : [...(sel ?? []), t.key])} className={`${pill} ${a ? "ld-pill-on" : ""}`}>{t.label.split(" or ")[0]}</button>;
      })}
    </>
  );
}
