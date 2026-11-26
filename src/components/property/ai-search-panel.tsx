import { useAuthReturn } from "@/lib/auth-return";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Minus, Plus, RefreshCw, RotateCcw, SearchX, Sparkles, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { aiSearch } from "@/lib/ai-search.functions";
import { useAuth } from "@/hooks/use-auth";
import type { SearchParams } from "@/lib/listing-search";
import type { Turn } from "@/lib/ai-criteria";
import { CLEAR_ALL, criteriaChips, diffChips, type Change } from "@/lib/criteria-chips";
import { aiStatusQuery, useCountdown } from "./ai-allowance";
import { Loader } from "@/components/loader";

/** Every filter an AI answer can set. Applying an answer clears the ones it leaves out, so the filters always match what was understood. */
export const CRITERIA_KEYS = ["q", "listingType", "propertyTypes", "countyCodes", "priceMin", "priceMax", "bedroomsMin", "bathroomsMin", "features", "furnishing", "verifiedOnly"] as const;
export const pickCriteria = (p: Partial<SearchParams>) => Object.fromEntries(CRITERIA_KEYS.flatMap((k) => (p[k] === undefined ? [] : [[k, p[k]]])));
export const replaceCriteria = (c: Record<string, unknown>): Partial<SearchParams> => ({ ...Object.fromEntries(CRITERIA_KEYS.map((k) => [k, undefined])), ...c, page: 1 }) as Partial<SearchParams>;

/** What the page found for the latest message, so the chat can say it in words. */
export type AiResult = { total: number; nearest?: string[]; loading: boolean } | undefined;

type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "ai"; text: string; notes: string[]; changes: Change[]; chips: string[]; source: "ai" | "basic"; found?: { total: number; nearest?: string[] } };

type Props = { value: SearchParams; onApply: (next: Partial<SearchParams>) => void; result?: AiResult };

/**
 * Chat search. The conversation keeps its own filters: a new chat always starts from nothing, so filters picked by hand earlier can
 * never leak into it. Each answer says what it understood and what it added, changed or removed.
 */
export function useAiSearch({ value, onApply, result }: Props) {
  const { user } = useAuth();
  const back = useAuthReturn();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [out, setOut] = useState<{ resetsAt: string | null; limit: number } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const cd = useCountdown(out?.resetsAt);
  const history = useRef<Turn[]>([]);
  const mine = useRef<Record<string, unknown>>({}); // the chat's own filters
  const id = useRef(0);
  const latest = useRef(value); latest.current = value;
  const fresh = useRef(true);

  const run = useMutation({
    mutationFn: (t: string) => aiSearch({ data: { text: t, current: fresh.current ? {} : pickCriteria(latest.current), history: history.current } }),
    onSuccess: (r, t) => {
      void qc.invalidateQueries({ queryKey: aiStatusQuery.queryKey });
      if (!r.ok) { setOut({ resetsAt: r.status.resetsAt, limit: r.status.limit }); setMsgs((m) => m.slice(0, -1)); return; }
      history.current = [...history.current, { role: "user", content: t }, { role: "assistant", content: r.reply }].slice(-8) as Turn[];
      const before = criteriaChips(mine.current as Partial<SearchParams>);
      const after = criteriaChips(r.criteria as Partial<SearchParams>);
      const wasFresh = fresh.current;
      mine.current = r.criteria as Record<string, unknown>;
      fresh.current = false;
      setMsgs((m) => {
        // The answer before this one keeps the result it had, so scrolling back shows what each step found.
        const frozen = m.map((x) => (x.role === "ai" && !x.found && resultRef.current && !resultRef.current.loading ? { ...x, found: { total: resultRef.current.total, ...(resultRef.current.nearest ? { nearest: resultRef.current.nearest } : {}) } } : x));
        return [...frozen, { id: ++id.current, role: "ai", text: r.reply, notes: r.notes, changes: diffChips(before, after), chips: after.map((c) => c.label), source: r.source }];
      });
      setRemaining(r.source === "ai" ? r.status.remaining : null);
      onApply(wasFresh ? ({ ...CLEAR_ALL, ...r.criteria } as Partial<SearchParams>) : replaceCriteria(r.criteria as Record<string, unknown>));
    },
    onError: () => { setMsgs((m) => m.slice(0, -1)); toast.error("AI search is not available right now. Normal search still works."); },
  });
  const resultRef = useRef(result); resultRef.current = result;

  const send = (t: string) => {
    const text = t.trim();
    if (run.isPending) return;
    setOpen(true);
    if (text.length < 2) return; // nothing typed yet: just open the chat so they can start talking
    setMsgs((m) => [...m, { id: ++id.current, role: "user", text }]);
    run.mutate(text);
  };
  /** A new chat: forgets the conversation. The caller decides what happens to the filters. */
  const reset = () => { setMsgs([]); history.current = []; mine.current = {}; fresh.current = true; setRemaining(null); };
  const close = () => { setOpen(false); reset(); };

  const dialog = (
    <Dialog open={out !== null} onOpenChange={(o) => { if (!o) setOut(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You have used your AI searches</DialogTitle>
          <DialogDescription>
            {user ? "Your AI searches are used up for now." : "Visitors get a few AI searches. Sign in for more."} Normal search with filters is still free and unlimited, and your last filters are still on the page.
          </DialogDescription>
        </DialogHeader>
        {cd.text && cd.left !== 0 && <p className="rounded-xl bg-muted p-4 text-center"><span className="block font-mono text-3xl font-extrabold tabular-nums">{cd.text}</span><span className="text-xs font-semibold text-muted-foreground">until they come back</span></p>}
        {cd.left === 0 && <p className="text-sm font-semibold">Your AI searches are back. Try again.</p>}
        {!user && <Link to="/auth" search={back} className="rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-bold text-primary-foreground">Sign in or create an account</Link>}
      </DialogContent>
    </Dialog>
  );

  const panel = open ? <ChatPanel msgs={msgs} pending={run.isPending} result={result} remaining={remaining} onNew={() => { reset(); onApply({ ...CLEAR_ALL }); }} onClose={() => { close(); onApply({ ...CLEAR_ALL }); }} /> : null;
  return { open, pending: run.isPending, send, reset, close, panel, dialog, remaining, show: () => setOpen(true) };
}

const tone = { added: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", changed: "bg-amber-500/15 text-amber-700 dark:text-amber-300", removed: "bg-red-500/15 text-red-400 line-through dark:text-rose-300" } as const;
const KindIcon = { added: Plus, changed: RefreshCw, removed: Minus } as const;

function ResultLine({ r, final }: { r: NonNullable<AiResult> | { total: number; nearest?: string[]; loading?: false }; final?: boolean }) {
  if ("loading" in r && r.loading) return <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader size="xs" />Searching{final ? "" : "…"}</p>;
  if (r.nearest) return (
    <div className="mt-3 rounded-xl bg-amber-500/10 p-3 text-sm" role="status">
      <p className="flex items-center gap-2 font-bold"><SearchX className="size-4 shrink-0" aria-hidden />No exact match</p>
      <p className="mt-1 text-muted-foreground">Nothing matches all of that. What did not match: {r.nearest.join(", ")}. The closest matches are shown below the results.</p>
    </div>
  );
  if (r.total === 0) return <p className="mt-3 flex items-center gap-2 text-sm font-semibold" role="status"><SearchX className="size-4" aria-hidden />No properties found</p>;
  return <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300" role="status"><CheckCircle2 className="size-4" aria-hidden />Found {r.total.toLocaleString("en-KE")} {r.total === 1 ? "property" : "properties"} that match</p>;
}

function ChatPanel({ msgs, pending, result, remaining, onNew, onClose }: { msgs: Msg[]; pending: boolean; result: AiResult; remaining: number | null; onNew: () => void; onClose: () => void }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [msgs.length, pending, result?.total, result?.loading]);
  const lastAi = [...msgs].reverse().find((m) => m.role === "ai")?.id;
  return (
    <section aria-label="Chat with AI search" className="ai-chat mt-4 rounded-3xl bg-card p-3 shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_30px_60px_-30px_rgb(15_23_42/0.45)] sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-foreground" aria-hidden />
        <h3 className="text-sm font-extrabold">Chat search</h3>
        <button type="button" onClick={onNew} className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground"><RotateCcw className="size-3.5" aria-hidden />New search</button>
        <button type="button" aria-label="Close chat" onClick={onClose} className="close-circle shrink-0"><X className="size-4" /></button>
      </div>
      <div className="ai-log pad-fixed max-h-[22rem] space-y-3 overflow-y-auto overscroll-contain pr-1" role="log" aria-live="polite">
        {msgs.length === 0 && !pending && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Tell me what you want in your own words, like “4 bedroom in Ruiru with a balcony”. Then keep going: “make it Kiambu”, “balcony is not a must”, or “forget that, new search”.</p>}
        {msgs.map((m) => m.role === "user" ? (
          <div key={m.id} className="flex justify-end"><p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-white/15 px-3.5 py-2 text-sm text-foreground">{m.text}</p></div>
        ) : (
          <div key={m.id} className="rounded-2xl rounded-bl-md bg-muted p-3.5 text-sm">
            <p className="flex items-start gap-2"><Sparkles className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden /><span>{m.text}</span></p>
            {m.changes.length > 0 ? (
              <div className="mt-3"><p className="mb-1.5 text-xs font-bold uppercase text-muted-foreground">What I changed</p>
                <ul className="flex flex-wrap gap-1.5">{m.changes.map((c) => { const I = KindIcon[c.kind]; return (
                  <li key={c.kind + c.chip.key} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${tone[c.kind]}`}><I className="size-3" aria-hidden /><span className="sr-only">{c.kind}: </span>{c.chip.label}{c.was && <span className="font-medium opacity-70"> (was {c.was})</span>}</li>
                ); })}</ul></div>
            ) : <p className="mt-2 text-xs text-muted-foreground">The filters stayed the same.</p>}
            {m.chips.length > 0 && <div className="mt-3"><p className="mb-1.5 text-xs font-bold uppercase text-muted-foreground">Searching for</p><ul className="flex flex-wrap gap-1.5">{m.chips.map((c) => <li key={c} className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{c}</li>)}</ul></div>}
            {m.notes.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">{m.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            {m.id === lastAi ? (result ? <ResultLine r={result} final /> : null) : m.found ? <ResultLine r={m.found} /> : null}
          </div>
        ))}
        {pending && <div className="flex items-center gap-2 rounded-2xl bg-muted p-3 text-sm text-muted-foreground" role="status"><Loader size="xs" />Reading your message…</div>}
        <div ref={end} />
      </div>
      {remaining !== null && <p className="mt-2 text-xs text-muted-foreground">{remaining} AI search{remaining === 1 ? "" : "es"} left.</p>}
    </section>
  );
}
