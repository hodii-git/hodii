import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { TypePills } from "@/components/property/type-pills";
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
    <form role="search" className="mx-auto flex h-[3.75rem] w-full max-w-[52rem] items-center gap-2 rounded-full bg-muted pl-7 pr-2 shadow-[0_10px_30px_-14px_rgb(0_0_0/0.8)] ring-1 ring-border focus-within:ring-2 focus-within:ring-primary/40" onSubmit={(e) => { e.preventDefault(); clearTimeout(timer.current); run(text); }}>
      <input data-bare type="search" value={text} aria-label="Search properties" placeholder="Try “2 bedroom in Kilimani under 80k” or a place"
        onChange={(e) => { const v = e.target.value; setText(v); clearTimeout(timer.current); timer.current = v.trim() === "" ? undefined : setTimeout(() => run(v), 800); if (v.trim() === "") run(""); }}
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden" />
      {text && <button type="button" aria-label="Clear search" onClick={() => { setText(""); run(""); }} className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-foreground/5"><X className="size-4" aria-hidden /></button>}
      <button type="submit" aria-label="Search" className="grid size-12 shrink-0 place-items-center rounded-full text-white transition hover:brightness-110" style={{ background: "var(--brand-gradient)" }}><Search className="size-5" strokeWidth={2.4} aria-hidden /></button>
    </form>
  );
}

/** The property-type pills under the header on the explore page; they read and change the address themselves. */
export function HeaderPills() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search }) as SearchUrl;
  const params = paramsFromUrl(search);
  return <TypePills selected={params.propertyTypes} onChange={(v) => void navigate({ to: "/properties", search: { ...urlFromParams({ ...params, propertyTypes: v as typeof params.propertyTypes, page: 1 }), ...keepView(search) }, replace: true, resetScroll: false })} />;
}
