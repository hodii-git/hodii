import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { ARTICLES, AGENCY_CATEGORIES, USER_CATEGORIES } from "@/data/guide";
import { searchArticles, type Block } from "@/lib/guide-search";

export function GuideBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => (
        <div key={i} className="space-y-2">
          {b.h && <h2 className="text-lg font-bold">{b.h}</h2>}
          {b.p && <p className="leading-relaxed">{b.p}</p>}
          {b.steps && <ol className="list-decimal space-y-1 pl-5">{b.steps.map((s) => <li key={s}>{s}</li>)}</ol>}
          {b.bullets && <ul className="list-disc space-y-1 pl-5">{b.bullets.map((s) => <li key={s}>{s}</li>)}</ul>}
          {b.note && <p className="rounded-xl bg-muted/60 p-3 text-sm">{b.note}</p>}
        </div>
      ))}
    </div>
  );
}

export function GuideIndex({ initial = "user" }: { initial?: "user" | "agency" }) {
  const [aud, setAud] = useState<"user" | "agency">(initial);
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchArticles(ARTICLES, q, aud), [q, aud]);
  const cats = aud === "user" ? USER_CATEGORIES : AGENCY_CATEGORIES;
  return (
    <div>
      <div role="tablist" aria-label="Guide for" className="inline-flex rounded-full bg-muted p-1">
        {(["user", "agency"] as const).map((a) => (
          <button key={a} role="tab" aria-selected={aud === a} onClick={() => setAud(a)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${aud === a ? "bg-background shadow" : "text-muted-foreground"}`}>{a === "user" ? "Finding a property" : "Agencies"}</button>
        ))}
      </div>
      <label className="relative mt-4 block">
        <span className="sr-only">Search the guide</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the guide, e.g. frozen, verified, alerts" className="h-12 w-full rounded-2xl border bg-background pl-10 pr-4" />
      </label>
      <div className="mt-6" aria-live="polite">
        {q.trim() ? (
          hits.length ? <ul className="space-y-2">{hits.map((a) => <Item key={a.id} id={a.id} title={a.title} summary={a.summary} cat={a.category} />)}</ul>
            : <p className="text-muted-foreground">Nothing found for "{q}". Try fewer words, or <Link to="/feedback" className="underline">tell us what you were looking for</Link>.</p>
        ) : cats.map((c) => {
          const list = hits.filter((a) => a.category === c);
          return list.length ? <section key={c} className="mb-6"><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{c}</h2><ul className="space-y-2">{list.map((a) => <Item key={a.id} id={a.id} title={a.title} summary={a.summary} />)}</ul></section> : null;
        })}
      </div>
    </div>
  );
}

const Item = ({ id, title, summary, cat }: { id: string; title: string; summary: string; cat?: string }) => (
  <li><Link to="/help/$id" params={{ id }} className="glass block rounded-2xl p-4 hover:bg-muted/50"><span className="font-semibold">{title}</span>{cat && <span className="ml-2 text-xs text-muted-foreground">{cat}</span>}<span className="block text-sm text-muted-foreground">{summary}</span></Link></li>
);
