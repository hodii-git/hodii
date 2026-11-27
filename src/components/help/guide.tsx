import { useMemo, useState } from "react";
import { VoiceButton } from "@/components/property/voice-button";
import { Link } from "@tanstack/react-router";
import { BookOpen, Search } from "lucide-react";
import { ToneIcon } from "@/components/ui/tone-icon";
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
          {b.note && <p className="popup-note">{b.note}</p>}
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
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the guide, e.g. frozen, verified, alerts" className="h-12 w-full rounded-2xl pl-10 pr-14 text-[0.95rem]" />
        <VoiceButton onText={setQ} />
      </label>
      <div className="mt-6" aria-live="polite">
        {q.trim() ? (
          hits.length ? <ul className="grid gap-2 md:grid-cols-2">{hits.map((a) => <Item key={a.id} id={a.id} title={a.title} summary={a.summary} cat={a.category} />)}</ul>
            : <p className="text-muted-foreground">Nothing found for "{q}". Try fewer words, or <Link to="/feedback" className="underline">tell us what you were looking for</Link>.</p>
        ) : cats.map((c) => {
          const list = hits.filter((a) => a.category === c);
          return list.length ? <section key={c} className="mb-6"><h2 className="mb-2 text-sm font-bold uppercase text-muted-foreground">{c}</h2><ul className="grid gap-2 md:grid-cols-2">{list.map((a) => <Item key={a.id} id={a.id} title={a.title} summary={a.summary} />)}</ul></section> : null;
        })}
      </div>
    </div>
  );
}

const Item = ({ id, title, summary, cat }: { id: string; title: string; summary: string; cat?: string }) => (
  <li><Link to="/help/$id" params={{ id }} className="glass-menu flex items-start gap-3 rounded-2xl p-4 transition hover:-translate-y-px hover:bg-muted/50"><ToneIcon icon={BookOpen} tone="other" /><span className="min-w-0"><span className="font-semibold">{title}</span>{cat && <span className="ml-2 text-xs text-muted-foreground">{cat}</span>}<span className="block text-sm text-muted-foreground">{summary}</span></span></Link></li>
);
